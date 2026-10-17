import { NextRequest, NextResponse } from 'next/server';
import {
  parseStudentList,
  parseTeacherSchedule,
  Teacher,
  Student,
  slugifyTr,
  generateUsername,
  generatePassword,
  buildWhatsAppLink
} from '@/lib/pdf-parser';
import { updateSheetRange, readFromSheet, ensureSheetExists } from '@/lib/sheets';

function normalizeTeacherKey(name: string): string {
  return slugifyTr(name || '').replace(/[^a-z0-9]/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const studentFile = formData.get('studentFile') as File | null;
    const scheduleFile = formData.get('scheduleFile') as File | null;
    const regeneratePasswords = formData.get('regeneratePasswords') === 'true';
    const existingTeachersJson = formData.get('existingTeachersJson') as string | null;

    const spreadsheetId = formData.get('spreadsheetId') as string | null;
    const accessToken = req.headers.get('Authorization')?.split('Bearer ')[1];

    if ((!studentFile && !scheduleFile) || !spreadsheetId || !accessToken) {
      return NextResponse.json(
        { error: 'Lütfen en az bir PDF dosyası (Öğrenci Listesi veya Ders Programı) seçiniz.' },
        { status: 400 }
      );
    }

    // 1. Mevcut E-Tablo verilerini doğrudan oku (kısmi yükleme ve şifre koruma için)
    const [existingStudentRows, existingTeacherRows] = await Promise.all([
      readFromSheet(accessToken, spreadsheetId, 'Öğrenciler!A2:C').catch(() => []),
      readFromSheet(accessToken, spreadsheetId, 'Öğretmenler!A2:E').catch(() => [])
    ]);

    const existingStudents: Student[] = (existingStudentRows || [])
      .map((row: any[]) => ({
        className: (row[0] || '').trim(),
        number: (row[1] || '').trim(),
        name: (row[2] || '').trim()
      }))
      .filter((s: Student) => s.number || s.name);

    // Mevcut öğretmenlerin şifre ve kullanıcı adlarını koruma haritası
    const existingCredentialsMap = new Map<string, { username: string; password: string; classes: string[]; roleOrBranch: string; name: string }>();

    // İstemciden gelen mevcut öğretmen listesini ekle
    if (existingTeachersJson) {
      try {
        const parsed = JSON.parse(existingTeachersJson);
        if (Array.isArray(parsed)) {
          for (const t of parsed) {
            if (!t?.name) continue;
            const key = normalizeTeacherKey(t.name);
            if (!key) continue;
            const prev = existingCredentialsMap.get(key);
            existingCredentialsMap.set(key, {
              name: t.name.trim(),
              username: (t.username || prev?.username || '').trim(),
              password: (t.password || prev?.password || '').trim(),
              classes: Array.isArray(t.classes) ? t.classes : (prev?.classes || []),
              roleOrBranch: (t.roleOrBranch || t.role || t.branch || prev?.roleOrBranch || '').trim()
            });
          }
        }
      } catch (e) {}
    }

    // E-Tablodan gelen öğretmen satırlarını üzerine birleştir (şifre boşsa mevcuttan tamamla)
    for (const row of existingTeacherRows || []) {
      const name = (row[0] || '').trim();
      if (!name) continue;
      const key = normalizeTeacherKey(name);
      const prev = existingCredentialsMap.get(key);
      const classes = (row[1] || '').split(',').map((c: string) => c.trim()).filter(Boolean);
      const username = (row[2] || '').trim() || prev?.username || '';
      const password = (row[3] || '').trim() || prev?.password || '';
      const roleOrBranch = (row[4] || '').trim() || prev?.roleOrBranch || '';

      existingCredentialsMap.set(key, {
        name,
        username,
        password,
        classes: classes.length > 0 ? classes : (prev?.classes || []),
        roleOrBranch
      });
    }

    // 2. Yüklenen PDF dosyalarını ayrıştır
    const [studentResult, scheduleTeachers] = await Promise.all([
      studentFile
        ? studentFile.arrayBuffer().then(buf => parseStudentList(Buffer.from(buf)))
        : Promise.resolve(null),
      scheduleFile
        ? scheduleFile.arrayBuffer().then(buf => parseTeacherSchedule(Buffer.from(buf)))
        : Promise.resolve(null)
    ]);

    // Öğrenci listesi: Yeni yüklendiyse yenisini kullan, yüklenmediyse mevcut öğrencileri koru
    const students: Student[] = studentResult ? studentResult.students : existingStudents;

    // 3. Öğretmenleri birleştir
    const teacherMap = new Map<string, Teacher>();

    // Yardımcı: Öğretmeni haritaya ekle veya birleştir
    const upsertTeacher = (t: {
      name: string;
      classes: string[];
      role?: string;
      branch?: string;
      username?: string;
      password?: string;
    }, replaceClasses = false) => {
      const key = normalizeTeacherKey(t.name);
      if (!key) return;

      if (teacherMap.has(key)) {
        const existing = teacherMap.get(key)!;
        existing.classes = replaceClasses
          ? Array.from(new Set(t.classes))
          : Array.from(new Set([...existing.classes, ...t.classes]));
        if (t.role && (!existing.role || existing.role === 'Ders Öğretmeni')) {
          existing.role = t.role;
        }
        if (t.branch && !existing.branch) {
          existing.branch = t.branch;
        }
      } else {
        const saved = existingCredentialsMap.get(key);
        const finalUsername = (!regeneratePasswords && saved?.username)
          ? saved.username
          : (t.username || generateUsername(t.name));
        const finalPassword = (!regeneratePasswords && saved?.password)
          ? saved.password
          : (t.password || generatePassword());
        const role = t.role || '';
        const branch = t.branch || '';
        const roleLabel = role ? `${role}${branch ? ` - ${branch}` : ''}` : (branch || saved?.roleOrBranch || 'Ders Öğretmeni');
        const classes = Array.from(new Set(t.classes));

        teacherMap.set(key, {
          name: t.name.trim(),
          classes,
          role: role || undefined,
          branch: branch || undefined,
          username: finalUsername,
          password: finalPassword,
          whatsappLink: buildWhatsAppLink(t.name.trim(), finalUsername, finalPassword, classes, roleLabel)
        });
      }
    };

    if (studentResult && scheduleTeachers) {
      // Her iki dosya da yüklendi
      for (const t of studentResult.teachers) {
        upsertTeacher(t);
      }
      for (const t of scheduleTeachers) {
        upsertTeacher(t);
      }
    } else if (studentResult && !scheduleTeachers) {
      // Sadece Öğrenci Listesi yüklendi -> Sınıf öğretmenleri ve Md. Yrd. güncellenir, mevcut Ders Öğretmenleri korunur
      for (const t of studentResult.teachers) {
        upsertTeacher(t);
      }
      for (const [, saved] of existingCredentialsMap.entries()) {
        const key = normalizeTeacherKey(saved.name);
        if (teacherMap.has(key)) {
          // Sınıf öğretmeni aynı zamanda başka sınıfların dersine giriyorsa sınıflarını ve branşını koru
          const current = teacherMap.get(key)!;
          current.classes = Array.from(new Set([...current.classes, ...saved.classes]));
          if (!current.branch && saved.roleOrBranch && !saved.roleOrBranch.includes('Sınıf Öğretmeni') && !saved.roleOrBranch.includes('Müdür')) {
            current.branch = saved.roleOrBranch;
          }
        } else {
          // Mevcut ders öğretmenlerini koru
          upsertTeacher({
            name: saved.name,
            classes: saved.classes,
            role: saved.roleOrBranch || 'Ders Öğretmeni',
            username: saved.username,
            password: saved.password
          });
        }
      }
    } else if (!studentResult && scheduleTeachers) {
      // Sadece Ders Programı yüklendi -> Mevcut Sınıf Öğretmenleri ve Md. Yrd. korunur, Ders Programı öğretmenleri güncellenir
      for (const [, saved] of existingCredentialsMap.entries()) {
        const r = (saved.roleOrBranch || '').toLowerCase();
        if (r.includes('sınıf') || r.includes('müdür') || r.includes('idare') || r.includes('rehber')) {
          upsertTeacher({
            name: saved.name,
            classes: saved.classes,
            role: saved.roleOrBranch,
            username: saved.username,
            password: saved.password
          });
        }
      }
      for (const t of scheduleTeachers) {
        upsertTeacher(t);
      }
    }

    // Tüm öğretmenlerin WhatsApp linklerini ve şifrelerini son kez doğrula
    const usedUsernames = new Set<string>();
    const allTeachers = Array.from(teacherMap.values()).map((t) => {
      const saved = existingCredentialsMap.get(normalizeTeacherKey(t.name));
      let username = (!regeneratePasswords && saved?.username) ? saved.username : (t.username || generateUsername(t.name));
      if (usedUsernames.has(username)) {
        let counter = 2;
        while (usedUsernames.has(`${username}${counter}`)) counter++;
        username = `${username}${counter}`;
      }
      usedUsernames.add(username);

      const password = (!regeneratePasswords && saved?.password) ? saved.password : (t.password || generatePassword());
      const roleOrBranch = t.role ? `${t.role}${t.branch ? ` - ${t.branch}` : ''}` : (t.branch || saved?.roleOrBranch || 'Ders Öğretmeni');
      const whatsappLink = buildWhatsAppLink(t.name, username, password, t.classes, roleOrBranch);

      return {
        ...t,
        username,
        password,
        roleOrBranch,
        role: roleOrBranch,
        whatsappLink
      };
    });

    // 4. Google Sheets başlıklarını garanti altına al ve verileri temizleyerek yaz
    await Promise.all([
      ensureSheetExists(accessToken, spreadsheetId, 'Öğrenciler', ['Sınıf', 'Numara', 'Adı Soyadı']),
      ensureSheetExists(accessToken, spreadsheetId, 'Öğretmenler', ['Adı Soyadı', 'Girdiği Sınıflar', 'Kullanıcı Adı', 'Şifre', 'Görevi / Branşı'])
    ]);

    if (studentResult && students.length > 0) {
      const studentValues = students.map((s: any) => [s.className, s.number, s.name]);
      await updateSheetRange(accessToken, spreadsheetId, 'Öğrenciler!A2:C', studentValues);
    }

    if (allTeachers.length > 0) {
      const teacherValues = allTeachers.map((t: any) => [
        t.name,
        t.classes.join(', '),
        t.username,
        t.password,
        t.roleOrBranch || ''
      ]);
      await updateSheetRange(accessToken, spreadsheetId, 'Öğretmenler!A2:E', teacherValues);
    }

    const uploadedParts: string[] = [];
    if (studentFile) uploadedParts.push(`Öğrenci Listesi (${students.length} öğrenci)`);
    if (scheduleFile) uploadedParts.push(`Ders Programı (${allTeachers.length} öğretmen)`);

    return NextResponse.json({
      success: true,
      message: `${uploadedParts.join(' ve ')} başarıyla güncellendi.${!regeneratePasswords ? ' Mevcut öğretmen şifreleri korundu.' : ' Tüm öğretmen şifreleri yenilendi.'}`,
      data: {
        students,
        teachers: allTeachers
      }
    });
  } catch (error: any) {
    console.error('PDF Parse Hatası:', error);
    return NextResponse.json(
      { error: error.message || 'Dosyalar analiz edilirken bir hata oluştu.' },
      { status: 500 }
    );
  }
}
