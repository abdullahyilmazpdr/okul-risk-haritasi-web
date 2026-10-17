import { NextRequest, NextResponse } from 'next/server';
import { readFromSheet, updateSheetRange, clearSheetRange, ensureSheetExists } from '@/lib/sheets';
import {
  generateUsername,
  generatePassword,
  buildWhatsAppLink,
  slugifyTr
} from '@/lib/pdf-parser';

function normalizeKey(str: string): string {
  return slugifyTr(str || '').replace(/[^a-z0-9]/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const accessToken = req.headers.get('Authorization')?.split('Bearer ')[1];
    const body = await req.json();
    const {
      action,
      spreadsheetId,
      teacher,
      originalUsername,
      originalName,
      existingTeachers
    } = body;

    if (!spreadsheetId || !accessToken) {
      return NextResponse.json(
        { error: 'Google E-Tablo kimliği veya yönetici oturumu eksik. Lütfen yeniden giriş yapınız.' },
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

    const rows = await readFromSheet(accessToken, spreadsheetId, 'Öğretmenler!A2:E').catch(() => []);

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
        const classes = (row[1] || '').split(',').map((c: string) => c.trim()).filter(Boolean);
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
        const classes = Array.isArray(t.classes) ? t.classes : [];
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

    if (action === 'add') {
      if (!teacher || !teacher.name || !String(teacher.name).trim()) {
        return NextResponse.json({ error: 'Öğretmen adı soyadı zorunludur.' }, { status: 400 });
      }

      const cleanName = String(teacher.name).trim();
      const classes = Array.isArray(teacher.classes)
        ? teacher.classes.map((c: string) => String(c).trim()).filter(Boolean)
        : String(teacher.classes || '').split(',').map((c: string) => c.trim()).filter(Boolean);
      const roleOrBranch = String(teacher.roleOrBranch || teacher.role || 'Ders Öğretmeni').trim();

      let username = String(teacher.username || '').trim() || generateUsername(cleanName);
      const password = String(teacher.password || '').trim() || generatePassword();

      // Aynı isimde öğretmen varsa güncelle veya kullanıcı adı çakışmasını önle
      const existingIdx = teachersList.findIndex(
        (t: any) => normalizeKey(t.name) === normalizeKey(cleanName) || (username && normalizeKey(t.username) === normalizeKey(username))
      );

      if (existingIdx >= 0) {
        const existing = teachersList[existingIdx];
        const mergedClasses = Array.from(new Set([...existing.classes, ...classes]));
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

      const targetKey = normalizeKey(originalUsername || originalName || teacher.username || teacher.name);
      const idx = teachersList.findIndex(
        (t: any) => normalizeKey(t.username) === targetKey || normalizeKey(t.name) === targetKey
      );

      if (idx === -1) {
        return NextResponse.json({ error: 'Güncellenecek öğretmen bulunamadı.' }, { status: 404 });
      }

      const cleanName = String(teacher.name).trim();
      const classes = Array.isArray(teacher.classes)
        ? teacher.classes.map((c: string) => String(c).trim()).filter(Boolean)
        : String(teacher.classes || '').split(',').map((c: string) => c.trim()).filter(Boolean);
      const username = String(teacher.username || '').trim() || generateUsername(cleanName);
      const password = String(teacher.password || '').trim() || generatePassword();
      const roleOrBranch = String(teacher.roleOrBranch || teacher.role || 'Ders Öğretmeni').trim();

      teachersList[idx] = {
        name: cleanName,
        classes,
        username,
        password,
        roleOrBranch,
        role: roleOrBranch,
        whatsappLink: buildWhatsAppLink(cleanName, username, password, classes, roleOrBranch)
      };
    } else if (action === 'delete') {
      const targetKey = normalizeKey(originalUsername || originalName || teacher?.username || teacher?.name || '');
      teachersList = teachersList.filter(
        (t: any) => normalizeKey(t.username) !== targetKey && normalizeKey(t.name) !== targetKey
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
      await updateSheetRange(accessToken, spreadsheetId, 'Öğretmenler!A2:E', sheetValues);
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
