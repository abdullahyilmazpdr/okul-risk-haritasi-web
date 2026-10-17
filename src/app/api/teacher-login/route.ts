import { NextRequest, NextResponse } from 'next/server';
import { readFromSheet } from '@/lib/sheets';
import { deduplicateClasses } from '@/lib/pdf-parser';

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

// Rol belirleme yardımcısı
function determineRole(roleOrBranch: string, username: string, name?: string) {
  const r = cleanTr(roleOrBranch);
  const u = cleanTr(username);
  const n = cleanTr(name || '');
  const rAlpha = r.replace(/[^a-z0-9]/g, '');
  const uAlpha = u.replace(/[^a-z0-9]/g, '');
  const nAlpha = n.replace(/[^a-z0-9]/g, '');

  // 1. İdareci / Müdür Yardımcısı
  const isAdmin = 
    r.includes('mudur') || 
    r.includes('idare') || 
    u.includes('mudur') || 
    u.includes('idare') || 
    uAlpha.startsWith('ia') || 
    uAlpha === 'admin' ||
    n.includes('mudur') ||
    nAlpha.startsWith('ia') ||
    (nAlpha.length >= 2 && nAlpha[0] === 'i' && nAlpha[1] === 'a');

  // 2. Sınıf Rehber Öğretmeni (Özel Eğitim okullarında bir sınıftaki iki Özel Eğitim öğretmeni de Sınıf Öğretmenidir)
  const isClassTeacher = !isAdmin && (
    r.includes('sinif') || 
    r.includes('rehber') || 
    r.includes('ozel egitim') ||
    rAlpha.includes('ozelegitim') ||
    u.includes('sinif') || 
    u.includes('rehber') || 
    uAlpha.startsWith('io') || 
    nAlpha.startsWith('io') ||
    (nAlpha.length >= 2 && nAlpha[0] === 'i' && nAlpha[1] === 'o')
  );

  let roleTitle = 'Ders Öğretmeni';
  if (isAdmin) {
    roleTitle = (roleOrBranch && roleOrBranch.toLowerCase().includes('müdür')) ? roleOrBranch : 'Müdür Yardımcısı';
  } else if (isClassTeacher) {
    roleTitle = (roleOrBranch && roleOrBranch.toLowerCase().includes('sınıf')) ? roleOrBranch : 'Sınıf Öğretmeni';
  } else if (roleOrBranch) {
    roleTitle = roleOrBranch;
  }

  return { isAdmin, isClassTeacher, roleTitle };
}

import { getLatestSchoolData } from '@/lib/db';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { logAuditEvent } from '@/lib/audit-logger';
import { generateTeacherToken } from '@/lib/session-token';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting: 1 dakikada en fazla 15 giriş denemesine izin ver
    const rateCheck = checkRateLimit(req, 15, 60 * 1000);
    if (!rateCheck.success) {
      return rateLimitResponse(rateCheck.retryAfter);
    }

    const { username, password, cachedTeachers, spreadsheetId, accessToken, schoolKey } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Kullanıcı adı ve şifre zorunludur.' }, { status: 400 });
    }

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();
    const cleanSchoolKey = schoolKey ? String(schoolKey).trim() : '';
    const normUsername = cleanTr(cleanUsername);
    const normUsernameAlpha = normUsername.replace(/[^a-z0-9]/g, '');

    let allTeachers: any[] = [];
    let targetSpreadsheetId = spreadsheetId;
    let targetToken = accessToken;
    let foundSchoolName = '';

    // 1. Eğer schoolKey (MEBBIS Kurum Kodu) verilmişse okulun E-Tablo bağlantı bilgilerini bul
    if (cleanSchoolKey) {
      try {
        const schoolByKey = await getLatestSchoolData(cleanSchoolKey);
        if (schoolByKey) {
          if (schoolByKey.spreadsheetId) targetSpreadsheetId = schoolByKey.spreadsheetId;
          targetToken = schoolByKey.serviceAccountKey || schoolByKey.accessToken || targetToken;
          foundSchoolName = schoolByKey.schoolName || '';
        }
      } catch (e) {
        console.warn('Kurum koduna göre okul arama hatası:', e);
      }
    }

    // 2. İstemciden gelen yerel önbellek öğretmenleri (aynı cihazdan test edilirse yedek)
    if (Array.isArray(cachedTeachers) && cachedTeachers.length > 0) {
      allTeachers = [...cachedTeachers];
    }

    // 3. Eğer hala hedef tablo yoksa Firestore aktif okulundan sadece E-Tablo bağlantı bilgisini yükle
    if (!targetSpreadsheetId || !targetToken) {
      try {
        const latest = await getLatestSchoolData(cleanSchoolKey || undefined);
        if (latest) {
          if (!targetSpreadsheetId && latest.spreadsheetId) targetSpreadsheetId = latest.spreadsheetId;
          if (!targetToken) targetToken = latest.serviceAccountKey || latest.accessToken || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
          if (!foundSchoolName && latest.schoolName) foundSchoolName = latest.schoolName;
        }
      } catch (e) {
        console.warn('Aktif okul verisi alınamadı:', e);
      }
    }

    // 4. Öğretmen kullanıcı adı ve şifrelerini doğrudan okulun Google E-Tablosundan (Öğretmenler!A2:E) oku
    if (targetSpreadsheetId && targetToken) {
      try {
        const rows = await readFromSheet(targetToken, targetSpreadsheetId, 'Öğretmenler!A2:E');
        if (rows && rows.length > 0) {
          const sheetTeachers = rows.map((row: any[]) => ({
            name: (row[0] || '').trim(),
            classes: deduplicateClasses((row[1] || '').split(',').map((c: string) => c.trim()).filter(Boolean)),
            username: (row[2] || '').trim(),
            password: (row[3] || '').trim(),
            roleOrBranch: (row[4] || '').trim()
          })).filter((t: any) => t.name || t.username);

          for (const st of sheetTeachers) {
            const idx = allTeachers.findIndex(
              (t: any) =>
                (t.username && st.username && cleanTr(t.username) === cleanTr(st.username)) ||
                (t.name && st.name && cleanTr(t.name) === cleanTr(st.name))
            );
            if (idx >= 0) {
              allTeachers[idx] = {
                ...allTeachers[idx],
                ...st,
                username: st.username || allTeachers[idx].username,
                password: st.password || allTeachers[idx].password || ''
              };
            } else {
              allTeachers.push(st);
            }
          }
        }
      } catch (sheetErr) {
        console.warn('E-Tablodan öğretmenler okunamadı:', sheetErr);
      }
    }

    // 3. Kullanıcı adına göre öğretmeni bul
    const matchedTeacher = allTeachers.find((t: any) => {
      const u = cleanTr(t.username || '');
      const uAlpha = u.replace(/[^a-z0-9]/g, '');
      const n = cleanTr(t.name || '');
      const nAlpha = n.replace(/[^a-z0-9]/g, '');

      return (
        u === normUsername || 
        uAlpha === normUsernameAlpha ||
        n === normUsername ||
        nAlpha === normUsernameAlpha
      );
    });

    if (!matchedTeacher) {
      // Brute-force yavaşlatma (Timing-attack ve robot taramalarını engeller)
      await new Promise(r => setTimeout(r, 600));
      return NextResponse.json(
        { error: 'Kullanıcı adı veya şifre hatalı. Lütfen giriş bilgilerinizi kontrol ediniz.' }, 
        { status: 401 }
      );
    }

    // 4. KESİN ŞİFRE KONTROLÜ (Boş veya rastgele şifrelere asla izin verilmez)
    const expectedPassword = String(matchedTeacher.password || '').trim();
    if (!expectedPassword || cleanPassword !== expectedPassword) {
      // Hatalı şifre denemelerinde bilinçli gecikme ekleyerek kaba kuvvet (brute-force) saldırılarını engelle
      await new Promise(r => setTimeout(r, 600));
      return NextResponse.json(
        { error: 'Kullanıcı adı veya şifre hatalı. Lütfen giriş bilgilerinizi kontrol ediniz.' }, 
        { status: 401 }
      );
    }

    // 5. Doğrulama başarılı -> Rol ve sınıf yetkilerini hesapla
    const roleOrBranch = matchedTeacher.roleOrBranch || matchedTeacher.role || matchedTeacher.branch || '';
    const { isAdmin, isClassTeacher, roleTitle } = determineRole(
      roleOrBranch, 
      matchedTeacher.username || cleanUsername, 
      matchedTeacher.name || ''
    );

    const uniqueTeacherClasses = deduplicateClasses(
      Array.isArray(matchedTeacher.classes) ? matchedTeacher.classes : []
    );

    // KVKK Denetim İzi: Giriş etkinliğini arka planda kaydet
    if (targetSpreadsheetId && targetToken) {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'İstemci';
      logAuditEvent(targetToken, targetSpreadsheetId, {
        performedBy: matchedTeacher.name || cleanUsername,
        role: roleTitle,
        action: 'GIRIS',
        details: `${cleanSchoolKey} kurum kodlu okul oturumu açıldı`,
        ip: clientIp
      }).catch(err => console.warn('Giriş logu yazılamadı:', err));
    }

    // 6. Kriptografik Oturum Belirteci (Session Token / JWT alternatifi HMAC)
    const sessionToken = generateTeacherToken({
      username: matchedTeacher.username || cleanUsername,
      name: matchedTeacher.name || cleanUsername,
      role: roleTitle,
      isClassTeacher,
      isAdmin,
      schoolKey: cleanSchoolKey,
      classes: uniqueTeacherClasses
    });

    return NextResponse.json({
      success: true,
      sessionToken,
      teacher: {
        name: matchedTeacher.name || cleanUsername,
        username: matchedTeacher.username || cleanUsername,
        classes: uniqueTeacherClasses,
        role: roleTitle,
        isClassTeacher,
        isAdmin,
        spreadsheetId: targetSpreadsheetId,
        schoolName: foundSchoolName,
        schoolKey: cleanSchoolKey
      }
    });
  } catch (error: any) {
    console.error('Öğretmen giriş hatası:', error);
    return NextResponse.json({ error: error.message || 'Giriş sırasında bir hata oluştu.' }, { status: 500 });
  }
}
