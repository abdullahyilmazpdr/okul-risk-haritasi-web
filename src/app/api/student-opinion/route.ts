import { NextRequest, NextResponse } from 'next/server';
import { readFromSheet, updateSheetRange, clearSheetRange, ensureSheetExists } from '@/lib/sheets';
import { getLatestSchoolData } from '@/lib/db';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { logAuditEvent } from '@/lib/audit-logger';
import { verifyTeacherToken } from '@/lib/session-token';

const RISK_SHEET_HEADERS = [
  'Öğrenci No',
  'Öğrenci Adı',
  'Sınıf',
  'Öğretmen Adı',
  'Görevi / Branşı',
  'ŞÖK Görüşü',
  'Risk Haritası Maddeleri',
  'Kayıt Tarihi',
  'Grup Eğitimi Günleri'
];

function cleanTr(str: string): string {
  if (!str) return '';
  return str
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseRisks(val: any): number[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return Array.from(new Set(val.map(Number).filter(n => !isNaN(n) && Number.isInteger(n))));
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '[]') return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return Array.from(new Set(parsed.map(Number).filter(n => !isNaN(n) && Number.isInteger(n))));
        }
      } catch (e) {}
    }
    if (trimmed.includes(',')) {
      return Array.from(new Set(trimmed.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && Number.isInteger(n))));
    }
    const num = Number(trimmed);
    if (!isNaN(num) && Number.isInteger(num)) {
      return [num];
    }
  }
  return [];
}

function extractRecordFromRow(r: any[]) {
  if (!Array.isArray(r) || r.length === 0) return null;
  const nonEmpties = r.filter(c => c !== undefined && c !== null && String(c).trim() !== '');
  if (nonEmpties.length === 0) return null;

  const firstCellStr = cleanTr(String(r[0] || ''));
  if (firstCellStr.includes('ogrenci no') || firstCellStr === 'ogrenci' || firstCellStr === 'no') {
    return null;
  }

  let sNum = '';
  let colOffset = 0;

  if (r[0] && String(r[0]).trim() !== '' && !cleanTr(String(r[0])).includes('ogrenci')) {
    sNum = String(r[0]).trim().replace(/^['"]|['"]$/g, '');
    colOffset = 0;
  } else if (r[1] && String(r[1]).trim() !== '' && !cleanTr(String(r[1])).includes('ogrenci')) {
    sNum = String(r[1]).trim().replace(/^['"]|['"]$/g, '');
    colOffset = 1;
  } else if (r[7] && String(r[7]).trim() !== '' && !cleanTr(String(r[7])).includes('ogrenci')) {
    sNum = String(r[7]).trim().replace(/^['"]|['"]$/g, '');
    colOffset = 7;
  }

  if (!sNum) return null;
  if (sNum.endsWith('.0')) {
    sNum = sNum.slice(0, -2);
  }

  let groupDays: string[] = [];
  const rawGroupDays = r[colOffset + 8];
  if (rawGroupDays) {
    const str = String(rawGroupDays).trim();
    if (str.startsWith('[')) {
      try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) groupDays = parsed.map(String);
      } catch (e) {}
    } else if (str) {
      groupDays = str.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  return {
    num: sNum,
    name: String(r[colOffset + 1] || '').trim(),
    className: String(r[colOffset + 2] || '').trim(),
    teacher: String(r[colOffset + 3] || '').trim(),
    branch: String(r[colOffset + 4] || '').trim(),
    opinion: String(r[colOffset + 5] || '').trim(),
    risks: parseRisks(r[colOffset + 6]),
    date: String(r[colOffset + 7] || '').trim(),
    groupTrainingDays: groupDays
  };
}

// Öğrencinin ŞÖK görüşlerini veya tüm görüşleri çekme
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let spreadsheetId = searchParams.get('spreadsheetId');
    const studentNumber = searchParams.get('studentNumber');
    const schoolKey = searchParams.get('schoolKey');
    const authHeader = req.headers.get('Authorization');
    let token = authHeader?.startsWith('Bearer ') 
      ? authHeader.split('Bearer ')[1] 
      : searchParams.get('token');

    if (!spreadsheetId || !token) {
      const schoolData = await getLatestSchoolData(schoolKey || undefined);
      if (schoolData) {
        if (!spreadsheetId) spreadsheetId = schoolData.spreadsheetId;
        if (!token) token = schoolData.serviceAccountKey || schoolData.accessToken;
      }
    }

    if (token && spreadsheetId) {
      try {
        const rows = await readFromSheet(token, spreadsheetId, 'OkulRisk!A:Z');
        if (rows && rows.length > 0) {
          const recordMap = new Map<string, any>();
          for (const row of rows) {
            const rec = extractRecordFromRow(row);
            if (rec && rec.num) {
              const key = `${cleanTr(rec.num)}_${cleanTr(rec.teacher) || 'genel'}`;
              recordMap.set(key, rec);
            }
          }

          let allRecords = Array.from(recordMap.values());
          if (studentNumber && studentNumber !== 'all') {
            const targetNum = String(studentNumber).trim();
            allRecords = allRecords.filter(r => cleanTr(r.num) === cleanTr(targetNum));
          }

          const opinions = allRecords.map(r => ({
            studentNumber: r.num,
            studentName: r.name,
            className: r.className,
            teacherName: r.teacher,
            branch: r.branch,
            opinion: r.opinion,
            risks: parseRisks(r.risks),
            date: r.date,
            groupTrainingDays: r.groupTrainingDays || []
          })).filter(o => o.opinion || (o.risks && o.risks.length > 0) || (o.groupTrainingDays && o.groupTrainingDays.length > 0));

          return NextResponse.json({
            success: true,
            opinions
          });
        }
      } catch (err) {
        console.warn('OkulRisk sayfası okuma hatası (GET):', err);
      }
    }

    return NextResponse.json({
      success: true,
      opinions: []
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting: 1 dakikada en fazla 60 kayıt isteği
    const rateCheck = checkRateLimit(req, 60, 60 * 1000);
    if (!rateCheck.success) {
      return rateLimitResponse(rateCheck.retryAfter);
    }

    const body = await req.json();
    let { 
      studentNumber, 
      studentName, 
      className, 
      teacherName, 
      branch, 
      opinion, 
      risks, 
      spreadsheetId, 
      accessToken,
      schoolKey,
      sessionToken
    } = body;

    // 2. Güvenlik: Session Token Doğrulaması (Kimlik sahteciliğini önler)
    if (sessionToken) {
      const tokenVerification = verifyTeacherToken(sessionToken);
      if (!tokenVerification.valid || !tokenVerification.payload) {
        return NextResponse.json({ error: tokenVerification.error || 'Geçersiz öğretmen oturum belirteci.' }, { status: 401 });
      }
      // Yetkili öğretmen adı ve rolü doğrudan imzalı tokendan güvenceye alınır
      teacherName = tokenVerification.payload.name || teacherName;
      if (tokenVerification.payload.role) {
        branch = tokenVerification.payload.role;
      }
    }

    if (!studentNumber) {
      return NextResponse.json({ error: 'Öğrenci numarası zorunludur.' }, { status: 400 });
    }

    if (!spreadsheetId || !accessToken) {
      const schoolData = await getLatestSchoolData(schoolKey || undefined);
      if (schoolData) {
        if (!spreadsheetId) spreadsheetId = schoolData.spreadsheetId;
        if (!accessToken) accessToken = schoolData.serviceAccountKey || schoolData.accessToken;
      }
    }

    if (!spreadsheetId || !accessToken) {
      return NextResponse.json({ 
        error: 'E-Tablo bağlantısı veya yetki tokenı bulunamadı. Lütfen önce Yönetici Girişi yapıp E-Tabloyu sisteme bağlayınız.' 
      }, { status: 400 });
    }

    // Google Sheets 'OkulRisk' sayfasının var olduğundan ve başlık satırının A1'de olduğundan emin ol
    await ensureSheetExists(accessToken, spreadsheetId, 'OkulRisk', RISK_SHEET_HEADERS);

    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    // Mevcut satırları oku
    let rawRows: any[][] = [];
    try {
      rawRows = await readFromSheet(accessToken, spreadsheetId, 'OkulRisk!A:Z');
    } catch (e: any) {
      const errMsg = (e?.message || '').toLowerCase();
      if (errMsg.includes('not found') || errMsg.includes('unable to parse range')) {
        rawRows = [];
      } else {
        console.error('OkulRisk tablosu okunurken kritik hata:', e);
        throw new Error('E-Tablo mevcut verileri okunamadı: ' + (e?.message || 'Bağlantı hatası'));
      }
    }

    // Mevcut tüm geçerli kayıtları haritala
    const recordsMap = new Map<string, any>();
    for (const row of rawRows) {
      const rec = extractRecordFromRow(row);
      if (rec && rec.num) {
        const key = `${cleanTr(rec.num)}_${cleanTr(rec.teacher) || 'genel'}`;
        recordsMap.set(key, rec);
      }
    }

    const sNum = String(studentNumber).trim().replace(/^['"]|['"]$/g, '');
    const incomingTeacher = (teacherName || 'Öğretmen').trim();
    const incomingBranch = (branch || '').trim();
    const incomingKey = `${cleanTr(sNum)}_${cleanTr(incomingTeacher) || 'genel'}`;

    // Öğretmenin rolünü kontrol et: Sınıf Rehber Öğretmeni veya İdareci mi, yoksa Ders Öğretmeni mi?
    const bLower = cleanTr(incomingBranch);
    const tLower = cleanTr(incomingTeacher);
    const isCounselorOrAdmin = 
      bLower.includes('sinif') || 
      bLower.includes('rehber') || 
      bLower.includes('ozel egitim') || 
      bLower.includes('ozelegitim') || 
      bLower.includes('mudur') || 
      bLower.includes('idare') ||
      tLower.includes('sinif') ||
      tLower.includes('rehber') ||
      tLower.includes('mudur') ||
      tLower.includes('idare');

    const existingRec = recordsMap.get(incomingKey);

    // Risk maddeleri belirleme:
    // Ders Öğretmeni ise risk maddesi kaydetmez ([] bırakılır).
    // Sınıf Öğretmeni veya İdareci ise gelen riskler kaydedilir.
    let risksToSave: number[] = [];
    if (isCounselorOrAdmin) {
      if (Array.isArray(risks)) {
        risksToSave = parseRisks(risks);
      } else if (existingRec && existingRec.risks) {
        risksToSave = parseRisks(existingRec.risks);
      }
    } else {
      // Ders öğretmeni için risk kaydedilmez
      risksToSave = [];
    }

    // Grup Eğitimi Günleri: Sınıf Rehber Öğretmeni veya İdareci tarafından belirlenir
    let groupDaysToSave: string[] = [];
    if (isCounselorOrAdmin) {
      if (Array.isArray(body.groupTrainingDays)) {
        groupDaysToSave = body.groupTrainingDays.map(String);
      } else if (existingRec && existingRec.groupTrainingDays) {
        groupDaysToSave = existingRec.groupTrainingDays;
      }
    } else if (existingRec && existingRec.groupTrainingDays) {
      groupDaysToSave = existingRec.groupTrainingDays;
    }

    recordsMap.set(incomingKey, {
      num: sNum,
      name: studentName || existingRec?.name || '',
      className: className || existingRec?.className || '',
      teacher: incomingTeacher,
      branch: incomingBranch || existingRec?.branch || (isCounselorOrAdmin ? 'Sınıf Rehber Öğretmeni' : 'Ders Öğretmeni'),
      opinion: opinion !== undefined ? String(opinion).trim() : (existingRec?.opinion || ''),
      risks: risksToSave,
      date: dateStr,
      groupTrainingDays: groupDaysToSave
    });

    // Kayıtları öğrenci numarasına göre sırala
    const sortedRecords = Array.from(recordsMap.values());
    sortedRecords.sort((a, b) => {
      const numA = Number(String(a.num).replace(/\D/g, '')) || 0;
      const numB = Number(String(b.num).replace(/\D/g, '')) || 0;
      return numA - numB;
    });

    // A:I aralığına yazılacak temiz tablo
    const cleanSheetRows = [
      RISK_SHEET_HEADERS,
      ...sortedRecords.map(r => [
        r.num,
        r.name,
        r.className,
        r.teacher,
        r.branch,
        r.opinion || '',
        JSON.stringify(parseRisks(r.risks)),
        r.date,
        JSON.stringify(r.groupTrainingDays || [])
      ])
    ];

    // Temiz tabloyu A1'den itibaren nizami şekilde yaz (A'dan I'ya)
    await updateSheetRange(accessToken, spreadsheetId, `OkulRisk!A1:I${cleanSheetRows.length}`, cleanSheetRows);

    // Eğer eski satır sayısı fazlaysa alt satırlardaki eski verileri temizle
    if (rawRows.length > cleanSheetRows.length && cleanSheetRows.length > 1) {
      await clearSheetRange(accessToken, spreadsheetId, `OkulRisk!A${cleanSheetRows.length + 1}:I${rawRows.length + 5}`);
    }

    // KVKK Denetim İzi: Risk veya Görüş girişini arka planda kaydet
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'İstemci';
    const actionType = isCounselorOrAdmin && risksToSave.length > 0 ? 'RISK_KAYIT' : 'GORUS_KAYIT';
    const detailMsg = actionType === 'RISK_KAYIT' 
      ? `${risksToSave.length} risk maddesi ve görüş kaydedildi` 
      : 'ŞÖK öğretmen görüşü kaydedildi';

    logAuditEvent(accessToken, spreadsheetId, {
      performedBy: incomingTeacher,
      role: incomingBranch || 'Öğretmen',
      action: actionType,
      studentNo: String(sNum),
      studentName: String(studentName || existingRec?.name || '-'),
      details: detailMsg,
      ip: clientIp
    }).catch(err => console.warn('KVKK Denetim izi yazılamadı:', err));

    return NextResponse.json({
      success: true,
      message: 'Öğrenci görüşü ve risk haritası Google E-Tabloya başarıyla kaydedildi.'
    });
  } catch (error: any) {
    console.error('E-Tabloya kayıt hatası:', error);
    const msg = (error?.message || '').toLowerCase();
    if (msg.includes('invalid authentication') || msg.includes('401') || msg.includes('token') || msg.includes('credential')) {
      return NextResponse.json({ 
        error: 'Google E-Tablo yetki süresi dolmuş. Lütfen okul idarecisinin Yönetici Girişi yapmasını sağlayınız.' 
      }, { status: 401 });
    }
    return NextResponse.json({ 
      error: 'Google E-Tabloya kaydedilemedi: ' + (error?.message || 'Yetkilendirme veya bağlantı hatası') 
    }, { status: 500 });
  }
}
