import { NextRequest, NextResponse } from 'next/server';
import { readFromSheet, updateSheetRange, clearSheetRange, ensureSheetExists } from '@/lib/sheets';
import { getLatestSchoolData } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit-logger';

export async function POST(req: NextRequest) {
  try {
    const headerToken = req.headers.get('Authorization')?.split('Bearer ')[1]?.trim() || '';
    let accessToken = headerToken;
    const body = await req.json();
    const {
      action,
      spreadsheetId: bodySpreadsheetId,
      schoolKey,
      adminUid,
      student,
      originalNumber,
      existingStudents = []
    } = body;

    let spreadsheetId = bodySpreadsheetId || '';
    let latestSchool: any = null;
    try {
      latestSchool = await getLatestSchoolData(schoolKey || undefined);
    } catch (e) {
      console.warn('Okul bağlantı bilgisi alınamadı:', e);
    }

    const isAuthorizedAdmin = Boolean(
      headerToken ||
      (adminUid && latestSchool?.adminUid && adminUid === latestSchool.adminUid)
    );

    if (!isAuthorizedAdmin) {
      return NextResponse.json(
        { error: 'Bu işlem için okul yöneticisi yetkisi gereklidir. Lütfen yönetici girişi yapınız.' },
        { status: 403 }
      );
    }

    const serverFallbackToken =
      latestSchool?.serviceAccountKey ||
      latestSchool?.accessToken ||
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
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
    await ensureSheetExists(accessToken, spreadsheetId, 'Öğrenciler', ['Sınıf', 'Numara', 'Adı Soyadı', 'Cinsiyet']);

    // Mevcut satırları E-Tablodan oku
    let rows: any[][] = [];
    try {
      rows = await readFromSheet(accessToken, spreadsheetId, 'Öğrenciler!A2:D');
    } catch (readErr) {
      if (serverFallbackToken && serverFallbackToken !== accessToken) {
        accessToken = serverFallbackToken;
        rows = await readFromSheet(accessToken, spreadsheetId, 'Öğrenciler!A2:D').catch(() => []);
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
      if (num && name) {
        studentMap.set(num, {
          number: num,
          name,
          className: cls,
          gender
        });
      }
    }

    // Eylemleri uygula: add, update, delete
    if (action === 'add') {
      if (!student?.number || !student?.name || !student?.className) {
        return NextResponse.json({ error: 'Öğrenci numarası, adı soyadı ve sınıfı zorunludur.' }, { status: 400 });
      }
      const targetNum = String(student.number).trim();
      studentMap.set(targetNum, {
        number: targetNum,
        name: String(student.name).trim(),
        className: String(student.className).trim(),
        gender: String(student.gender || 'Belirtilmedi').trim()
      });
    } else if (action === 'update') {
      if (!student?.number || !student?.name || !student?.className) {
        return NextResponse.json({ error: 'Öğrenci numarası, adı soyadı ve sınıfı zorunludur.' }, { status: 400 });
      }
      const oldNum = String(originalNumber || student.number).trim();
      const newNum = String(student.number).trim();

      if (oldNum !== newNum) {
        studentMap.delete(oldNum);
      }

      studentMap.set(newNum, {
        number: newNum,
        name: String(student.name).trim(),
        className: String(student.className).trim(),
        gender: String(student.gender || 'Belirtilmedi').trim()
      });
    } else if (action === 'delete') {
      const targetNum = String(originalNumber || student?.number || '').trim();
      if (!targetNum) {
        return NextResponse.json({ error: 'Silinecek öğrenci numarası belirtilmedi.' }, { status: 400 });
      }
      studentMap.delete(targetNum);
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
    const sheetValues = updatedStudents.map(s => [s.className, s.number, s.name, s.gender || 'Belirtilmedi']);
    await updateSheetRange(accessToken, spreadsheetId, `Öğrenciler!A2:D${sheetValues.length + 1}`, sheetValues);

    // Eski fazla satırlar varsa temizle
    if (rows.length > sheetValues.length) {
      await clearSheetRange(accessToken, spreadsheetId, `Öğrenciler!A${sheetValues.length + 2}:D${rows.length + 5}`);
    }

    // KVKK denetim izi
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'İstemci';
    logAuditEvent(accessToken, spreadsheetId, {
      performedBy: 'Okul Yöneticisi',
      role: 'Yönetici',
      action: action === 'add' ? 'OGRENCI_EKLE' : action === 'update' ? 'OGRENCI_GUNCELLE' : 'OGRENCI_SIL',
      studentNo: student?.number || originalNumber || '',
      studentName: student?.name || '',
      details: `${student?.name || originalNumber} öğrencisi için ${action} işlemi yapıldı`,
      ip: clientIp
    }).catch(err => console.warn('Öğrenci işlem audit log hatası:', err));

    return NextResponse.json({
      success: true,
      message: action === 'add'
        ? `${student.name} başarıyla E-Tabloya eklendi.`
        : action === 'update'
        ? `${student.name} bilgileri güncellendi.`
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
