import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getLatestSchoolData, getSchoolByKey } from '@/lib/db';
import { readFromSheet } from '@/lib/sheets';
import { generateTeacherToken } from '@/lib/session-token';
import { deduplicateClasses } from '@/lib/pdf-parser';

const SSO_SECRET = process.env.SSO_SECRET || 'meram-oeuo-risk-sso-bridge-key-2026';

// Türkçe ve özel karakterleri latin küçük harflere çevirici
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { schoolKey = '752927', name = '', email = '', role = 'teacher', uid = '', ts, sig, source = 'meram-mobil' } = body;

    // Güvenlik 1: Zaman Aşımı Kontrolü (Replay Attack Koruması - Maksimum 5 dakika)
    const now = Date.now();
    const requestTime = Number(ts) || 0;
    if (!requestTime || Math.abs(now - requestTime) > 5 * 60 * 1000) {
      return NextResponse.json(
        { error: 'Geçiş bağlantısının süresi dolmuş (5 dakikalık güvenlik süresi). Lütfen Meram Mobil uygulamasından butona tekrar tıklayınız.' },
        { status: 401 }
      );
    }

    // Güvenlik 2: Kriptografik İmza Doğrulama (URL Tahrifatı Koruması)
    const expectedSig = crypto
      .createHash('sha256')
      .update(`${uid}:${role}:${ts}:${SSO_SECRET}`)
      .digest('hex');

    if (!sig || sig !== expectedSig) {
      return NextResponse.json(
        { error: 'Güvenlik doğrulaması başarısız oldu (Yetkisiz geçiş denemesi veya tahrif edilmiş bağlantı).' },
        { status: 403 }
      );
    }

    const cleanSchoolKey = String(schoolKey || '752927').trim();
    const cleanName = String(name || '').trim();
    const normName = cleanTr(cleanName);
    const isAdminOrCounselor = role === 'admin' || role === 'rehber';

    // 1. Okul Bilgilerini Çek
    let schoolData: any = null;
    try {
      schoolData = await getLatestSchoolData(cleanSchoolKey);
      if (!schoolData) {
        schoolData = await getSchoolByKey(cleanSchoolKey);
      }
    } catch (dbErr) {
      console.warn('Okul sorgulama hatası:', dbErr);
    }

    const schoolName = schoolData?.schoolName || 'Meram Özel Eğitim Uygulama Okulu III. Kademe';
    const spreadsheetId = schoolData?.spreadsheetId || '';
    const accessToken = schoolData?.serviceAccountKey || schoolData?.accessToken || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';

    let sheetStudents: any[] = [];
    let allTeachers: any[] = [];

    // 2. E-Tablo bağlıysa mevcut öğrenci ve öğretmenleri oku
    if (spreadsheetId && accessToken) {
      try {
        const studentRows = await readFromSheet(accessToken, spreadsheetId, 'Öğrenciler!A2:D');
        if (studentRows && studentRows.length > 0) {
          sheetStudents = studentRows
            .map((r: any[]) => ({
              className: (r[0] || '').trim(),
              number: (r[1] || '').trim(),
              name: (r[2] || '').trim(),
              gender: (r[3] || '').trim()
            }))
            .filter((s: any) => s.number || s.name);
        }

        const teacherRows = await readFromSheet(accessToken, spreadsheetId, 'Öğretmenler!A2:E');
        if (teacherRows && teacherRows.length > 0) {
          allTeachers = teacherRows
            .map((row: any[]) => ({
              name: (row[0] || '').trim(),
              classes: deduplicateClasses((row[1] || '').split(',').map((c: string) => c.trim()).filter(Boolean)),
              username: (row[2] || '').trim(),
              password: (row[3] || '').trim(),
              roleOrBranch: (row[4] || '').trim()
            }))
            .filter((t: any) => t.name || t.username);
        }
      } catch (sheetErr) {
        console.warn('E-Tablo verisi okunamadı:', sheetErr);
      }
    }

    // Okuldaki tüm sınıflar
    const allDistinctClasses = deduplicateClasses([
      ...sheetStudents.map(s => s.className).filter(Boolean),
      ...allTeachers.flatMap(t => t.classes || []).filter(Boolean)
    ]);

    // 3. YÖNETİCİ / REHBER ÖĞRETMEN İSE
    if (isAdminOrCounselor) {
      // Sadece Meram Özel Eğitim Uygulama Okulu'na (752927) özel kural:
      // Meram-mobil uygulamasından gelen e-posta ne olursa olsun, resmi okul yönetici e-posta hesabı
      // meramisuygulamamerkezi@gmail.com olarak atanır.
      const officialAdminEmail = cleanSchoolKey === '752927'
        ? 'meramisuygulamamerkezi@gmail.com'
        : (email || '');

      const effectiveAdminUid = (cleanSchoolKey === '752927' && schoolData?.adminUid)
        ? schoolData.adminUid
        : (uid || 'meram-admin-uid');

      const adminSessionPayload = {
        name: cleanName || 'Okul Yöneticisi',
        email: officialAdminEmail,
        originalMobileEmail: email || '',
        uid: effectiveAdminUid,
        schoolKey: cleanSchoolKey,
        schoolName,
        spreadsheetId,
        role: role === 'rehber' ? 'Rehber Öğretmen / Psikolojik Danışman' : 'Okul Yöneticisi / İdareci',
        isAdmin: true,
        source: source || 'meram-mobil'
      };

      // Ayrıca öğretmen paneline geçiş yapabilmesi için tüm sınıfları gören bir öğretmen oturumu da üret
      const teacherToken = generateTeacherToken({
        username: cleanTr(cleanName).replace(/\s+/g, '.') || 'admin',
        name: cleanName || 'Okul Yöneticisi',
        role: role === 'rehber' ? 'Rehber Öğretmen' : 'Müdür Yardımcısı',
        isClassTeacher: false,
        isAdmin: true,
        schoolKey: cleanSchoolKey,
        classes: allDistinctClasses
      });

      return NextResponse.json({
        success: true,
        role: 'admin',
        targetUrl: '/admin',
        schoolKey: cleanSchoolKey,
        schoolName,
        spreadsheetId,
        admin: adminSessionPayload,
        students: sheetStudents,
        teacherSessionToken: teacherToken,
        teacher: {
          name: cleanName || 'Okul Yöneticisi',
          username: cleanTr(cleanName).replace(/\s+/g, '.') || 'admin',
          classes: allDistinctClasses,
          role: role === 'rehber' ? 'Rehber Öğretmen' : 'Müdür Yardımcısı',
          isClassTeacher: false,
          isAdmin: true,
          schoolKey: cleanSchoolKey,
          schoolName,
          spreadsheetId
        }
      });
    }

    // 4. ÖĞRETMEN İSE
    // İsme göre eşleştir
    let matched = allTeachers.find((t: any) => {
      const tNorm = cleanTr(t.name || '');
      return tNorm === normName || tNorm.includes(normName) || normName.includes(tNorm);
    });

    let assignedClasses = matched && Array.isArray(matched.classes) && matched.classes.length > 0
      ? deduplicateClasses(matched.classes)
      : allDistinctClasses; // Eşleşmeyen veya genel öğretmen için okul sınıfları hazır gelir

    const teacherRole = matched?.roleOrBranch || 'Özel Eğitim / Branş Öğretmeni';
    const teacherUsername = matched?.username || cleanTr(cleanName).replace(/\s+/g, '.') || `ogretmen.${Math.floor(100 + Math.random() * 900)}`;

    const sessionToken = generateTeacherToken({
      username: teacherUsername,
      name: cleanName || matched?.name || 'Öğretmen',
      role: teacherRole,
      isClassTeacher: true,
      isAdmin: false,
      schoolKey: cleanSchoolKey,
      classes: assignedClasses
    });

    return NextResponse.json({
      success: true,
      role: 'teacher',
      targetUrl: '/teacher',
      sessionToken,
      students: sheetStudents,
      teacher: {
        name: cleanName || matched?.name || 'Öğretmen',
        username: teacherUsername,
        classes: assignedClasses,
        role: teacherRole,
        isClassTeacher: true,
        isAdmin: false,
        schoolKey: cleanSchoolKey,
        schoolName,
        spreadsheetId
      }
    });

  } catch (error: any) {
    console.error('SSO API hatası:', error);
    return NextResponse.json({ error: error.message || 'SSO oturumu oluşturulamadı.' }, { status: 500 });
  }
}
