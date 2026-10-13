import { NextRequest, NextResponse } from 'next/server';
import { readFromSheet } from '@/lib/sheets';
import { getLatestSchoolData } from '@/lib/db';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

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

    // Eğer token veya spreadsheetId yoksa Firestore'daki okuldan otomatik çek
    if (!token || !spreadsheetId) {
      try {
        const latestSchool = await getLatestSchoolData(schoolKey || undefined);
        if (latestSchool) {
          if (!spreadsheetId && latestSchool.spreadsheetId) {
            spreadsheetId = latestSchool.spreadsheetId;
          }
          if (!token) {
            token = latestSchool.serviceAccountKey || latestSchool.accessToken || '';
          }
        }
      } catch (dbErr) {
        console.warn('Aktif okul verisi Firestore\'dan alınamadı:', dbErr);
      }
    }

    if (!spreadsheetId || !token) {
      return NextResponse.json({ error: 'E-Tablo kimliği veya yetkilendirme bulunamadı.' }, { status: 401 });
    }

    const verifyOnly = searchParams.get('verifyOnly') === 'true';

    // 1. Aşama: Eğer sadece okul kodu doğrulaması yapılıyorsa (Öğretmen giriş ekranı 1. Adım),
    // asla öğrenci listesi veya öğretmen listesi çekilmez/dönülmez! Sadece maskeli okul bilgisi dönülür.
    if (verifyOnly) {
      let foundName = '';
      if (schoolKey) {
        try {
          const sc = await getLatestSchoolData(schoolKey);
          if (sc) {
            foundName = sc.schoolName || '';
          }
        } catch (e) {}
      }

      if (!foundName && spreadsheetId && token) {
        // Okul var mı teyit et
        foundName = 'Okul Tanımlı';
      }

      if (!foundName) {
        return NextResponse.json({ error: 'Belirtilen MEBBİS kurum koduna ait aktif bir okul bulunamadı.' }, { status: 404 });
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
          maskedSchoolKey: maskCode(schoolKey || '')
        }
      });
    }

    // E-Tablo'dan Öğrenciler ve Öğretmenler sayfalarını oku
    const [studentRows, teacherRows] = await Promise.all([
      readFromSheet(token, spreadsheetId, 'Öğrenciler!A2:C').catch(() => []),
      readFromSheet(token, spreadsheetId, 'Öğretmenler!A2:E').catch(() => [])
    ]);

    const students = (studentRows || []).map((row: any[]) => ({
      className: row[0] || '',
      number: row[1] || '',
      name: row[2] || '',
    })).filter((s: any) => s.number || s.name);

    // Öğretmen listesi döndürülürken şifreler ASLA istemciye verilmez!
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://okulrisk.vercel.app';
    const teachers = (teacherRows || []).map((row: any[]) => {
      const name = row[0] || '';
      const classes = (row[1] || '').split(',').map((c: string) => c.trim()).filter(Boolean);
      const username = row[2] || '';
      const roleOrBranch = row[4] || '';

      return {
        name,
        classes,
        username,
        roleOrBranch
      };
    }).filter((t: any) => t.name);

    let schoolName = '';
    if (schoolKey) {
      try {
        const sc = await getLatestSchoolData(schoolKey);
        if (sc?.schoolName) schoolName = sc.schoolName;
      } catch (e) {}
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
        schoolName: maskText(schoolName),
        maskedSchoolKey: maskCode(schoolKey || ''),
        students,
        teachers,
        stats: {
          totalStudents: students.length,
          totalTeachers: teachers.length
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
