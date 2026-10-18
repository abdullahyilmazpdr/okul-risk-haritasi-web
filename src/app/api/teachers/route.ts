import { NextRequest, NextResponse } from 'next/server';
import { readFromSheet, updateSheetRange, clearSheetRange, ensureSheetExists } from '@/lib/sheets';
import { getLatestSchoolData } from '@/lib/db';
import { verifyTeacherToken } from '@/lib/session-token';
import {
  generateUsername,
  generatePassword,
  buildWhatsAppLink,
  slugifyTr,
  deduplicateClasses
} from '@/lib/pdf-parser';

function normalizeKey(str: string): string {
  return slugifyTr(str || '').replace(/[^a-z0-9]/g, '');
}

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
      sessionToken,
      teacher,
      originalUsername,
      originalName,
      existingTeachers,
      newPassword
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

    if (action === 'change-password') {
      const verifiedResult = sessionToken ? verifyTeacherToken(String(sessionToken)) : null;
      const verifiedPayload = verifiedResult?.valid ? verifiedResult.payload : null;
      if (!isAuthorizedAdmin && !verifiedPayload) {
        return NextResponse.json(
          { error: 'Oturum doğrulanamadı veya süresi doldu. Lütfen tekrar öğretmen girişi yapınız.' },
          { status: 401 }
        );
      }
      if (!isAuthorizedAdmin && verifiedPayload) {
        const reqUserKey = normalizeKey(originalUsername || teacher?.username || '');
        const reqNameKey = normalizeKey(originalName || teacher?.name || '');
        const tokenUserKey = normalizeKey(verifiedPayload.username || '');
        const tokenNameKey = normalizeKey(verifiedPayload.name || '');
        const isSelf =
          (reqUserKey && tokenUserKey && reqUserKey === tokenUserKey) ||
          (reqNameKey && tokenNameKey && reqNameKey === tokenNameKey);
        if (!isSelf) {
          return NextResponse.json(
            { error: 'Yalnızca kendi öğretmen hesabınızın şifresini değiştirebilirsiniz.' },
            { status: 403 }
          );
        }
      }
    } else if (action === 'add' || action === 'update' || action === 'delete') {
      if (!isAuthorizedAdmin) {
        return NextResponse.json(
          { error: 'Bu işlem için okul yöneticisi yetkisi gereklidir. Lütfen yönetici girişi yapınız.' },
          { status: 403 }
        );
      }
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
        { error: 'Google E-Tablo kimliği veya yönetici yetkilendirmesi eksik. Lütfen okul yöneticinizin sisteme giriş yapmasını sağlayınız.' },
        { status: 401 }
      );
    }

    await ensureSheetExists(accessToken, spreadsheetId, 'Öğretmenler', [
      'Adı Soyadı',
      'Girdiği Sınıflar',
      'Kullanıcı Adı',
      'Şifre',
      'Görevi / Branşı'
    ]);

    let rows: any[][] = [];
    try {
      rows = await readFromSheet(accessToken, spreadsheetId, 'Öğretmenler!A2:E');
    } catch (readErr) {
      if (serverFallbackToken && serverFallbackToken !== accessToken) {
        accessToken = serverFallbackToken;
        rows = await readFromSheet(accessToken, spreadsheetId, 'Öğretmenler!A2:E').catch(() => []);
      }
    }

    // Mevcut şifre yedekleri (istemciden gelen)
    const fallbackMap = new Map<string, any>();
    if (Array.isArray(existingTeachers)) {
      for (const et of existingTeachers) {
        if (et?.name) fallbackMap.set(normalizeKey(et.name), et);
        if (et?.username) fallbackMap.set(normalizeKey(et.username), et);
      }
    }

    let teachersList = (rows || [])
      .map((row: any[]) => {
        const name = (row[0] || '').trim();
        const classes = deduplicateClasses((row[1] || '').split(',').map((c: string) => c.trim()).filter(Boolean));
        const fb = fallbackMap.get(normalizeKey(name)) || (row[2] ? fallbackMap.get(normalizeKey(row[2])) : null);
        const username = (row[2] || '').trim() || fb?.username || (name ? generateUsername(name) : '');
        const password = (row[3] || '').trim() || fb?.password || (name ? generatePassword() : '');
        const roleOrBranch = (row[4] || '').trim() || fb?.roleOrBranch || fb?.role || 'Ders Öğretmeni';

        return {
          name,
          classes,
          username,
          password,
          roleOrBranch,
          role: roleOrBranch,
          whatsappLink: buildWhatsAppLink(name, username, password, classes, roleOrBranch)
        };
      })
      .filter((t: any) => t.name);

    // Eğer E-Tablo boşsa ama istemcide liste varsa onu baz al
    if (teachersList.length === 0 && Array.isArray(existingTeachers) && existingTeachers.length > 0) {
      teachersList = existingTeachers.map((t: any) => {
        const name = (t.name || '').trim();
        const classes = deduplicateClasses(Array.isArray(t.classes) ? t.classes : []);
        const username = (t.username || '').trim() || generateUsername(name);
        const password = (t.password || '').trim() || generatePassword();
        const roleOrBranch = (t.roleOrBranch || t.role || t.branch || 'Ders Öğretmeni').trim();
        return {
          name,
          classes,
          username,
          password,
          roleOrBranch,
          role: roleOrBranch,
          whatsappLink: buildWhatsAppLink(name, username, password, classes, roleOrBranch)
        };
      }).filter((t: any) => t.name);
    }

    if (action === 'change-password') {
      const cleanNewPass = String(newPassword || '').trim();
      if (!cleanNewPass || cleanNewPass.length < 6) {
        return NextResponse.json({ error: 'Yeni şifre en az 6 karakter olmalıdır.' }, { status: 400 });
      }

      const targetUserKey = normalizeKey(originalUsername || teacher?.username || '');
      const targetNameKey = normalizeKey(originalName || teacher?.name || '');

      const idx = teachersList.findIndex(
        (t: any) =>
          (targetUserKey && normalizeKey(t.username) === targetUserKey) ||
          (targetNameKey && normalizeKey(t.name) === targetNameKey)
      );

      if (idx === -1) {
        return NextResponse.json(
          { error: 'Öğretmen kaydınız E-Tabloda bulunamadı. Lütfen okul yöneticinizle iletişime geçiniz.' },
          { status: 404 }
        );
      }

      const current = teachersList[idx];
      teachersList[idx] = {
        ...current,
        password: cleanNewPass,
        whatsappLink: buildWhatsAppLink(current.name, current.username, cleanNewPass, current.classes, current.roleOrBranch)
      };

      const sheetValues = teachersList.map((t: any) => [
        t.name,
        t.classes.join(', '),
        t.username,
        t.password,
        t.roleOrBranch || ''
      ]);
      await updateSheetRange(accessToken, spreadsheetId, 'Öğretmenler!A2:E', sheetValues);

      return NextResponse.json({
        success: true,
        message: 'Şifreniz Google E-Tablo üzerinde başarıyla güncellendi!'
      });
    } else if (action === 'add') {
      if (!teacher || !teacher.name || !String(teacher.name).trim()) {
        return NextResponse.json({ error: 'Öğretmen adı soyadı zorunludur.' }, { status: 400 });
      }

      const cleanName = String(teacher.name).trim();
      const classes = deduplicateClasses(
        Array.isArray(teacher.classes)
          ? teacher.classes.map((c: string) => String(c).trim()).filter(Boolean)
          : String(teacher.classes || '').split(',').map((c: string) => c.trim()).filter(Boolean)
      );
      const roleOrBranch = String(teacher.roleOrBranch || teacher.role || 'Ders Öğretmeni').trim();

      let username = String(teacher.username || '').trim() || generateUsername(cleanName);
      const password = String(teacher.password || '').trim() || generatePassword();

      // Aynı isimde öğretmen varsa güncelle veya kullanıcı adı çakışmasını önle
      const existingIdx = teachersList.findIndex(
        (t: any) => normalizeKey(t.name) === normalizeKey(cleanName) || (username && normalizeKey(t.username) === normalizeKey(username))
      );

      if (existingIdx >= 0) {
        const existing = teachersList[existingIdx];
        const mergedClasses = deduplicateClasses([...existing.classes, ...classes]);
        const finalUsername = String(teacher.username || '').trim() || existing.username || username;
        const finalPassword = String(teacher.password || '').trim() || existing.password || password;
        const finalRole = roleOrBranch || existing.roleOrBranch;

        teachersList[existingIdx] = {
          name: cleanName,
          classes: mergedClasses,
          username: finalUsername,
          password: finalPassword,
          roleOrBranch: finalRole,
          role: finalRole,
          whatsappLink: buildWhatsAppLink(cleanName, finalUsername, finalPassword, mergedClasses, finalRole)
        };
      } else {
        // Kullanıcı adı benzersizliği kontrolü
        const usedUsernames = new Set(teachersList.map((t: any) => t.username.toLowerCase()));
        let uniqueUsername = username;
        let counter = 2;
        while (usedUsernames.has(uniqueUsername.toLowerCase())) {
          uniqueUsername = `${username}${counter}`;
          counter++;
        }

        teachersList.unshift({
          name: cleanName,
          classes,
          username: uniqueUsername,
          password,
          roleOrBranch,
          role: roleOrBranch,
          whatsappLink: buildWhatsAppLink(cleanName, uniqueUsername, password, classes, roleOrBranch)
        });
      }
    } else if (action === 'update') {
      if (!teacher || !teacher.name) {
        return NextResponse.json({ error: 'Güncellenecek öğretmen bilgileri eksik.' }, { status: 400 });
      }

      const targetUserKey = normalizeKey(originalUsername || teacher.username || '');
      const targetNameKey = normalizeKey(originalName || teacher.name || '');
      const idx = teachersList.findIndex(
        (t: any) =>
          (targetUserKey && normalizeKey(t.username) === targetUserKey) ||
          (targetNameKey && normalizeKey(t.name) === targetNameKey)
      );

      const cleanName = String(teacher.name).trim();
      const classes = deduplicateClasses(
        Array.isArray(teacher.classes)
          ? teacher.classes.map((c: string) => String(c).trim()).filter(Boolean)
          : String(teacher.classes || '').split(',').map((c: string) => c.trim()).filter(Boolean)
      );
      const username = String(teacher.username || '').trim() || generateUsername(cleanName);
      const password = String(teacher.password || '').trim() || generatePassword();
      const roleOrBranch = String(teacher.roleOrBranch || teacher.role || 'Ders Öğretmeni').trim();

      const updatedTeacherObj = {
        name: cleanName,
        classes,
        username,
        password,
        roleOrBranch,
        role: roleOrBranch,
        whatsappLink: buildWhatsAppLink(cleanName, username, password, classes, roleOrBranch)
      };

      if (idx === -1) {
        teachersList.unshift(updatedTeacherObj);
      } else {
        teachersList[idx] = updatedTeacherObj;
      }
    } else if (action === 'delete') {
      const targetUserKey = normalizeKey(originalUsername || teacher?.username || '');
      const targetNameKey = normalizeKey(originalName || teacher?.name || '');
      teachersList = teachersList.filter(
        (t: any) =>
          !(
            (targetUserKey && normalizeKey(t.username) === targetUserKey) ||
            (targetNameKey && normalizeKey(t.name) === targetNameKey)
          )
      );
    } else {
      return NextResponse.json({ error: 'Geçersiz işlem türü.' }, { status: 400 });
    }

    // E-Tabloya kaydet
    if (teachersList.length > 0) {
      const sheetValues = teachersList.map((t: any) => [
        t.name,
        t.classes.join(', '),
        t.username,
        t.password,
        t.roleOrBranch || ''
      ]);
      try {
        await updateSheetRange(accessToken, spreadsheetId, 'Öğretmenler!A2:E', sheetValues);
      } catch (writeErr) {
        if (serverFallbackToken && serverFallbackToken !== accessToken) {
          await updateSheetRange(serverFallbackToken, spreadsheetId, 'Öğretmenler!A2:E', sheetValues);
        } else {
          throw writeErr;
        }
      }
    } else {
      await clearSheetRange(accessToken, spreadsheetId, 'Öğretmenler!A2:E');
    }

    return NextResponse.json({
      success: true,
      message:
        action === 'add'
          ? 'Öğretmen başarıyla eklendi.'
          : action === 'update'
            ? 'Öğretmen bilgileri güncellendi.'
            : 'Öğretmen listeden silindi.',
      data: {
        teachers: teachersList
      }
    });
  } catch (error: any) {
    console.error('Öğretmen yönetim hatası:', error);
    return NextResponse.json(
      { error: error.message || 'Öğretmen işlemi sırasında bir hata oluştu.' },
      { status: 500 }
    );
  }
}
