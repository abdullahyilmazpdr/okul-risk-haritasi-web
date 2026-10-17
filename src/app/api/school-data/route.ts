import { NextRequest, NextResponse } from 'next/server';
import { readFromSheet } from '@/lib/sheets';
import { getLatestSchoolData } from '@/lib/db';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { buildWhatsAppLink, generateUsername, generatePassword, deduplicateClasses } from '@/lib/pdf-parser';

export async function GET(req: NextRequest) {
  try {
    // 1. Rate Limiting: 1 dakikada en fazla 60 sorgu
    const rateCheck = checkRateLimit(req, 60, 60 * 1000);
    if (!rateCheck.success) {
      return rateLimitResponse(rateCheck.retryAfter);
    }
    const authHeader = req.headers.get('Authorization');
    let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : '';
    const { searchParams } = new URL(req.url);
    let spreadsheetId = searchParams.get('spreadsheetId');
    const schoolKey = searchParams.get('schoolKey');

    const verifyOnly = searchParams.get('verifyOnly') === 'true';
    const includePasswords = searchParams.get('includePasswords') === 'true';

    let latestSchool: any = null;
    try {
      latestSchool = await getLatestSchoolData(schoolKey || undefined);
    } catch (e) {}

    // 1. Aşama: Eğer sadece okul kodu doğrulaması yapılıyorsa (Öğretmen giriş ekranı 1. Adım),
    // Okulun veritabanında var olması yeterlidir, Google OAuth tokenına ihtiyaç duyulmaz.
    if (verifyOnly) {
      let foundName = latestSchool?.schoolName || '';
      let targetSchoolKey = latestSchool?.schoolKey || schoolKey || '';

      if (!foundName && spreadsheetId) {
        foundName = 'Okul Tanımlı';
      }

      if (!foundName) {
        return NextResponse.json({ 
          error: 'Belirtilen MEBBİS kurum koduna ait aktif bir okul kaydı bulunamadı. Lütfen okul yöneticinizle iletişime geçiniz.' 
        }, { status: 404 });
      }

      const maskText = (text: string) => {
        if (!text) return '';
        return text
          .split(' ')
          .filter(Boolean)
          .map(word => (word.length > 0 ? `${word[0]}***` : '***'))
          .join(' ');
      };

      const maskCode = (code: string) => {
        if (!code) return '';
        const str = String(code).trim();
        return str.length > 2 ? `${str.slice(0, 2)}***` : `${str[0] || ''}***`;
      };

      return NextResponse.json({
        success: true,
        data: {
          schoolName: maskText(foundName),
          maskedSchoolKey: maskCode(targetSchoolKey)
        }
      });
    }

    // 2. Aşama: Eğer token veya spreadsheetId yoksa Firestore'daki okuldan sadece bağlantı bilgilerini çek
    if (latestSchool) {
      if (!spreadsheetId && latestSchool.spreadsheetId) {
        spreadsheetId = latestSchool.spreadsheetId;
      }
      if (!token) {
        token = latestSchool.serviceAccountKey || latestSchool.accessToken || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
      }
    }

    if (!spreadsheetId || !token) {
      return NextResponse.json({ 
        error: 'Okulun Google E-Tablo kimliği veya yönetici yetkilendirmesi bulunamadı. Lütfen okul yöneticinizin sisteme Yönetici Girişi yapmasını sağlayınız.' 
      }, { status: 401 });
    }

    // E-Tablo'dan Öğrenciler, Öğretmenler ve OkulRisk sayfalarını doğrudan oku (Firestore'da öğrenci/öğretmen verisi tutulmaz)
    const [studentRows, teacherRows, evalRows] = await Promise.all([
      readFromSheet(token, spreadsheetId, 'Öğrenciler!A2:C').catch(() => []),
      readFromSheet(token, spreadsheetId, 'Öğretmenler!A2:E').catch(() => []),
      readFromSheet(token, spreadsheetId, 'OkulRisk!A2:B').catch(() => [])
    ]);

    const students = (studentRows || []).map((row: any[]) => ({
      className: row[0] || '',
      number: row[1] || '',
      name: row[2] || '',
    })).filter((s: any) => s.number || s.name);

    const evaluatedStudentNums = new Set<string>();
    for (const r of evalRows || []) {
      const sNum = String(r?.[0] || '').trim().replace(/^['"]|['"]$/g, '');
      if (sNum && !sNum.toLowerCase().includes('ogrenci') && !sNum.toLowerCase().includes('öğrenci')) {
        evaluatedStudentNums.add(sNum);
      }
    }
    const riskFilledRatio = students.length > 0
      ? Math.min(100, Math.round((evaluatedStudentNums.size / students.length) * 100))
      : 0;

    let needsSheetPasswordRepair = false;
    const rawTeachers = (teacherRows || []).map((row: any[]) => {
      const name = (row[0] || '').trim();
      const classes = deduplicateClasses((row[1] || '').split(',').map((c: string) => c.trim()).filter(Boolean));
      const username = (row[2] || '').trim() || (name ? generateUsername(name) : '');
      let password = (row[3] || '').trim();
      if (!password && name) {
        password = generatePassword();
        needsSheetPasswordRepair = true;
      }
      const roleOrBranch = (row[4] || '').trim();
      const whatsappLink = name && username && password
        ? buildWhatsAppLink(name, username, password, classes, roleOrBranch)
        : '';

      return {
        name,
        classes,
        username,
        password,
        roleOrBranch,
        role: roleOrBranch,
        whatsappLink
      };
    }).filter((t: any) => t.name);

    // Eğer E-Tabloda D sütununda (row[3]) şifresi boş kalmış satır varsa otomatik onarıp E-Tabloya geri yaz
    if (needsSheetPasswordRepair && spreadsheetId && token && rawTeachers.length > 0) {
      import('@/lib/sheets').then(({ updateSheetRange }) => {
        const repairedRows = rawTeachers.map((t: any) => [
          t.name,
          (t.classes || []).join(', '),
          t.username,
          t.password,
          t.roleOrBranch || ''
        ]);
        updateSheetRange(token, spreadsheetId!, 'Öğretmenler!A2:E', repairedRows).catch(err =>
          console.warn('Eksik öğretmen şifreleri E-Tabloya yazılırken hata:', err)
        );
      });
    }

    // Yönetici paneli (includePasswords=true) istediğinde E-Tablodaki şifre ve WhatsApp linklerini döndür;
    // normal öğretmen ekranlarında ise diğer öğretmenlerin şifrelerini gizle
    const teachers = rawTeachers.map((t: any) => {
      if (includePasswords) {
        return t;
      }
      return {
        name: t.name,
        classes: t.classes,
        username: t.username,
        roleOrBranch: t.roleOrBranch,
        role: t.role
      };
    });

    const schoolName = latestSchool?.schoolName || '';

    const maskText = (text: string) => {
      if (!text) return '';
      return text
        .split(' ')
        .filter(Boolean)
        .map(word => (word.length > 0 ? `${word[0]}***` : '***'))
        .join(' ');
    };

    const maskCode = (code: string) => {
      if (!code) return '';
      const str = String(code).trim();
      return str.length > 2 ? `${str.slice(0, 2)}***` : `${str[0] || ''}***`;
    };

    return NextResponse.json({
      success: true,
      data: {
        schoolName: maskText(schoolName),
        maskedSchoolKey: maskCode(schoolKey || latestSchool?.schoolKey || ''),
        students,
        teachers,
        stats: {
          totalStudents: students.length,
          totalTeachers: teachers.length,
          riskFilledRatio
        }
      }
    });
  } catch (error: any) {
    console.error('Veri getirme hatası:', error);
    return NextResponse.json(
      { error: error.message || 'E-Tablo verileri okunurken bir hata meydana geldi.' },
      { status: 500 }
    );
  }
}
