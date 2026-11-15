import { NextRequest, NextResponse } from 'next/server';
import { readFromSheet, updateSheetRange, clearSheetRange, ensureSheetExists, getSystemServiceAccountCreds } from '@/lib/sheets';
import { getLatestSchoolData } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit-logger';
import { verifyTeacherToken } from '@/lib/session-token';

function cleanClassKey(raw: string): string {
  return (raw || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/^ÖE[İI]U\s*-\s*/i, '')
    .replace(/Sınıf\s*Listesi.*$/i, '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .replace(/Ç/g, 'ç')
    .replace(/Ğ/g, 'ğ')
    .replace(/Ö/g, 'ö')
    .replace(/Ş/g, 'ş')
    .replace(/Ü/g, 'ü')
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşü]/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const headerToken = req.headers.get('Authorization')?.split('Bearer ')[1]?.trim() || '';
    const sessionTokenHeader = req.headers.get('x-session-token') || '';
    let accessToken = headerToken;
    const body = await req.json();
    const {
      action,
      spreadsheetId: bodySpreadsheetId,
      schoolKey,
      adminUid,
      sessionToken: bodySessionToken,
      addedByTeacher,
      student,
      originalNumber,
      numbers,
      existingStudents = []
    } = body;

    let spreadsheetId = bodySpreadsheetId || '';
    let latestSchool: any = null;
    try {
      latestSchool = await getLatestSchoolData(schoolKey || undefined);
    } catch (e) {
      console.warn('Okul bağlantı bilgisi alınamadı:', e);
    }

    const effectiveSessionToken = String(bodySessionToken || sessionTokenHeader || '').trim();
    const tokenCheck = effectiveSessionToken ? verifyTeacherToken(effectiveSessionToken) : { valid: false, payload: undefined };
    const cleanTargetKey = schoolKey ? String(schoolKey).trim() : '';
    const tokenMatchesSchool = Boolean(
      tokenCheck.valid &&
      tokenCheck.payload &&
      (!cleanTargetKey || !tokenCheck.payload.schoolKey || tokenCheck.payload.schoolKey === cleanTargetKey)
    );

    const isAuthorizedAdmin = Boolean(
      headerToken ||
      (adminUid && latestSchool?.adminUid && adminUid === latestSchool.adminUid) ||
      (tokenMatchesSchool && tokenCheck.payload?.isAdmin)
    );

    let isAuthorizedTeacherForAdd = false;
    if (action === 'add' && tokenMatchesSchool && tokenCheck.payload) {
      const assignedClasses = Array.isArray(tokenCheck.payload.classes) ? tokenCheck.payload.classes : [];
      const targetClassKey = cleanClassKey(student?.className || '');
      isAuthorizedTeacherForAdd =
        Boolean(tokenCheck.payload.isAdmin) ||
        assignedClasses.length === 0 ||
        assignedClasses.some((c: string) => cleanClassKey(c) === targetClassKey);
    }

    if (action === 'add') {
      if (!isAuthorizedAdmin && !isAuthorizedTeacherForAdd) {
        return NextResponse.json(
          { error: 'Bu işlem için geçerli öğretmen veya yönetici oturumu gereklidir.' },
          { status: 403 }
        );
      }
    } else if (!isAuthorizedAdmin) {
      return NextResponse.json(
        { error: 'Bu işlem için okul yöneticisi yetkisi gereklidir. Lütfen yönetici girişi yapınız.' },
        { status: 403 }
      );
    }

    const sysCreds = getSystemServiceAccountCreds();
    const serverFallbackToken =
      latestSchool?.serviceAccountKey ||
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      (sysCreds ? JSON.stringify(sysCreds) : '') ||
      latestSchool?.accessToken ||
      '';

    if (!spreadsheetId && latestSchool?.spreadsheetId) {
      spreadsheetId = latestSchool.spreadsheetId;
    }
    if (!accessToken) {
      accessToken = serverFallbackToken;
    }

    if (!spreadsheetId || !accessToken) {
      return NextResponse.json(
        { error: 'Google E-Tablo kimliği veya yönetici yetkilendirmesi eksik.' },
        { status: 401 }
      );
    }

    // Google Sheets 'Öğrenciler' sayfasının varlığını kontrol et
    await ensureSheetExists(accessToken, spreadsheetId, 'Öğrenciler', ['Sınıf', 'Numara', 'Adı Soyadı', 'Cinsiyet', 'Ekleme Bilgisi']);

    // Mevcut satırları E-Tablodan oku (A: Sınıf, B: Numara, C: Ad Soyad, D: Cinsiyet, E: Öğretmen Ekleme Bildirim Durumu)
    let rows: any[][] = [];
    try {
      rows = await readFromSheet(accessToken, spreadsheetId, 'Öğrenciler!A2:E');
    } catch (readErr) {
      if (serverFallbackToken && serverFallbackToken !== accessToken) {
        accessToken = serverFallbackToken;
        rows = await readFromSheet(accessToken, spreadsheetId, 'Öğrenciler!A2:E').catch(() => []);
      }
    }

    // Tablodaki veya istemciden gelen mevcut öğrencileri topla
    const studentMap = new Map<string, any>();

    // 1. İstemciden gelen yedekler
    if (Array.isArray(existingStudents)) {
      for (const s of existingStudents) {
        const num = String(s.number || '').trim();
        if (num) studentMap.set(num, s);
      }
    }

    // 2. Canlı E-Tablodan okunanlar
    for (const r of rows) {
      if (!Array.isArray(r) || r.length < 2) continue;
      const cls = String(r[0] || '').trim();
      const num = String(r[1] || '').trim();
      const name = String(r[2] || '').trim();
      const gender = String(r[3] || '').trim() || (num && studentMap.get(num)?.gender) || 'Belirtilmedi';
      const addedMeta = String(r[4] || '').trim();
      if (num && name) {
        studentMap.set(num, {
          number: num,
          name,
          className: cls,
          gender,
          addedMeta
        });
      }
    }

    const isAddedFromTeacher = Boolean(action === 'add' && (!isAuthorizedAdmin || addedByTeacher));
    const performerName = isAddedFromTeacher
      ? String(addedByTeacher || tokenCheck.payload?.name || tokenCheck.payload?.username || 'Öğretmen').trim()
      : 'Okul Yöneticisi';

    // Eylemleri uygula: add, update, delete, bulk-delete, acknowledge-teacher-added
    if (action === 'add') {
      if (!student?.number || !student?.name || !student?.className) {
        return NextResponse.json({ error: 'Öğrenci numarası, adı soyadı ve sınıfı zorunludur.' }, { status: 400 });
      }
      const targetNum = String(student.number).trim();
      const existingSameNum = studentMap.get(targetNum);
      if (isAddedFromTeacher && existingSameNum) {
        return NextResponse.json(
          {
            error: `${targetNum} numaralı öğrenci (${existingSameNum.name} - ${existingSameNum.className}) okul listesinde zaten kayıtlı.`
          },
          { status: 409 }
        );
      }

      const trNow = new Date().toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      studentMap.set(targetNum, {
        number: targetNum,
        name: String(student.name).trim(),
        className: String(student.className).trim(),
        gender: String(student.gender || 'Belirtilmedi').trim(),
        addedMeta: isAddedFromTeacher ? `BEKLEYEN|${performerName}|${trNow}` : (existingSameNum?.addedMeta || '')
      });
    } else if (action === 'update') {
      if (!student?.number || !student?.name || !student?.className) {
        return NextResponse.json({ error: 'Öğrenci numarası, adı soyadı ve sınıfı zorunludur.' }, { status: 400 });
      }
      const oldNum = String(originalNumber || student.number).trim();
      const newNum = String(student.number).trim();
      const prevMeta = studentMap.get(oldNum)?.addedMeta || studentMap.get(newNum)?.addedMeta || '';

      if (oldNum !== newNum) {
        studentMap.delete(oldNum);
      }

      studentMap.set(newNum, {
        number: newNum,
        name: String(student.name).trim(),
        className: String(student.className).trim(),
        gender: String(student.gender || 'Belirtilmedi').trim(),
        addedMeta: prevMeta
      });
    } else if (action === 'delete') {
      const targetNum = String(originalNumber || student?.number || '').trim();
      if (!targetNum) {
        return NextResponse.json({ error: 'Silinecek öğrenci numarası belirtilmedi.' }, { status: 400 });
      }
      studentMap.delete(targetNum);
    } else if (action === 'bulk-delete') {
      const targetNums = Array.isArray(numbers)
        ? numbers.map((n: any) => String(n || '').trim()).filter(Boolean)
        : [];
      if (targetNums.length === 0) {
        return NextResponse.json({ error: 'Silinecek öğrenciler seçilmedi.' }, { status: 400 });
      }
      const targetSet = new Set(targetNums);
      for (const k of Array.from(studentMap.keys())) {
        if (targetSet.has(String(k).trim())) {
          studentMap.delete(k);
        }
      }
    } else if (action === 'acknowledge-teacher-added') {
      const targetSet = Array.isArray(numbers) && numbers.length > 0
        ? new Set(numbers.map((n: any) => String(n || '').trim()).filter(Boolean))
        : null;
      for (const [k, s] of studentMap.entries()) {
        if (targetSet && !targetSet.has(String(k).trim())) continue;
        const meta = String(s.addedMeta || '').trim();
        if (meta.startsWith('BEKLEYEN|')) {
          studentMap.set(k, {
            ...s,
            addedMeta: meta.replace(/^BEKLEYEN\|/, 'ONAYLI|')
          });
        }
      }
    }

    // Güncel listeyi sınıfa ve numaraya göre sırala
    const updatedStudents = Array.from(studentMap.values()).sort((a, b) => {
      const clsComp = (a.className || '').localeCompare(b.className || '', 'tr');
      if (clsComp !== 0) return clsComp;
      const numA = Number(String(a.number).replace(/\D/g, '')) || 0;
      const numB = Number(String(b.number).replace(/\D/g, '')) || 0;
      return numA - numB;
    });

    // E-Tabloya yaz
    const sheetValues = updatedStudents.map(s => [
      s.className,
      s.number,
      s.name,
      s.gender || 'Belirtilmedi',
      s.addedMeta || ''
    ]);
    if (sheetValues.length > 0) {
      await updateSheetRange(accessToken, spreadsheetId, `Öğrenciler!A2:E${sheetValues.length + 1}`, sheetValues);
    }

    // Eski fazla satırlar varsa temizle
    if (rows.length > sheetValues.length) {
      await clearSheetRange(accessToken, spreadsheetId, `Öğrenciler!A${sheetValues.length + 2}:E${rows.length + 5}`);
    }

    // KVKK denetim izi
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'İstemci';
    const auditAction =
      action === 'add'
        ? isAddedFromTeacher
          ? 'OGRETMEN_OGRENCI_EKLE'
          : 'OGRENCI_EKLE'
        : action === 'update'
        ? 'OGRENCI_GUNCELLE'
        : action === 'bulk-delete'
        ? 'TOPLU_OGRENCI_SIL'
        : action === 'acknowledge-teacher-added'
        ? 'OGRETMEN_EKLEME_ONAY'
        : 'OGRENCI_SIL';

    const bulkCount = Array.isArray(numbers) ? numbers.length : 0;
    logAuditEvent(accessToken, spreadsheetId, {
      performedBy: performerName,
      role: isAddedFromTeacher ? (tokenCheck.payload?.role || 'Öğretmen') : 'Yönetici',
      action: auditAction,
      studentNo: student?.number || originalNumber || (Array.isArray(numbers) ? numbers.join(',') : ''),
      studentName: student?.name || '',
      details:
        action === 'bulk-delete'
          ? `${bulkCount} öğrenci (nakil/ayrılan) toplu olarak listeden çıkarıldı`
          : action === 'acknowledge-teacher-added'
          ? 'Öğretmen tarafından eklenen öğrenci bildirimi yönetici tarafından onaylandı'
          : `${student?.name || originalNumber} öğrencisi için ${action} işlemi yapıldı`,
      ip: clientIp
    }).catch(err => console.warn('Öğrenci işlem audit log hatası:', err));

    return NextResponse.json({
      success: true,
      message:
        action === 'add'
          ? `${student.name} başarıyla E-Tabloya eklendi.`
          : action === 'update'
          ? `${student.name} bilgileri güncellendi.`
          : action === 'bulk-delete'
          ? `Seçilen ${bulkCount} öğrenci okul listesinden çıkarıldı.`
          : action === 'acknowledge-teacher-added'
          ? 'Bildirim görüldü olarak işaretlendi.'
          : `Öğrenci listeden silindi.`,
      data: {
        students: updatedStudents
      }
    });
  } catch (error: any) {
    console.error('Öğrenci API hatası:', error);
    return NextResponse.json({ error: error.message || 'Öğrenci kaydedilirken bir hata oluştu.' }, { status: 500 });
  }
}
