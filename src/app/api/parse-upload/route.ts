import { NextRequest, NextResponse } from 'next/server';
import { parseStudentList, parseTeacherSchedule, Teacher } from '@/lib/pdf-parser';
import { appendToSheet, updateSheetRange, readFromSheet } from '@/lib/sheets';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const studentFile = formData.get('studentFile') as File | null;
    const scheduleFile = formData.get('scheduleFile') as File | null;
    const isUpdate = formData.get('isUpdate') === 'true';

    const spreadsheetId = formData.get('spreadsheetId') as string | null;
    const accessToken = req.headers.get('Authorization')?.split('Bearer ')[1];

    if (!studentFile || !scheduleFile || !spreadsheetId || !accessToken) {
      return NextResponse.json(
        { error: 'Gerekli dosyalar, Spreadsheet ID veya yetki tokenı eksik.' },
        { status: 400 }
      );
    }

    const studentBuffer = Buffer.from(await studentFile.arrayBuffer());
    const scheduleBuffer = Buffer.from(await scheduleFile.arrayBuffer());

    // Paralel olarak parse et
    const [studentResult, scheduleTeachers] = await Promise.all([
      parseStudentList(studentBuffer),
      parseTeacherSchedule(scheduleBuffer)
    ]);

    const students = studentResult.students;

    // Öğretmenleri tekilleştirerek birleştir (Sınıf Öğretmeni, Müdür Yardımcısı ve Ders Programındaki Öğretmenler)
    // Map anahtarı: öğretmen adı (aynı müdür yardımcısı veya öğretmen birden fazla sınıfta geçebilir)
    const teacherMap = new Map<string, Teacher>();

    // 1. Öğrenci listesinden gelen Sınıf Öğretmeni ve Müdür Yardımcısı
    for (const t of studentResult.teachers) {
      if (teacherMap.has(t.name)) {
        const existing = teacherMap.get(t.name)!;
        // Sınıfları birleştir
        const combinedClasses = Array.from(new Set([...existing.classes, ...t.classes]));
        existing.classes = combinedClasses;
      } else {
        teacherMap.set(t.name, { ...t });
      }
    }

    // 2. Ders programından gelen öğretmenler
    for (const t of scheduleTeachers) {
      if (teacherMap.has(t.name)) {
        const existing = teacherMap.get(t.name)!;
        const combinedClasses = Array.from(new Set([...existing.classes, ...t.classes]));
        existing.classes = combinedClasses;
        if (t.branch && !existing.branch) {
          existing.branch = t.branch;
        }
      } else {
        teacherMap.set(t.name, { ...t });
      }
    }

    const allTeachers = Array.from(teacherMap.values());

    // Google Sheets için veri hazırlığı
    // Öğrenciler: Sınıf, Numara, Adı Soyadı
    const studentValues = students.map((s: any) => [s.className, s.number, s.name]);

    // Öğretmenler: Adı Soyadı, Girdiği Sınıflar, Kullanıcı Adı, Şifre, Görevi/Branşı
    const teacherValues = allTeachers.map((t: any) => [
      t.name, 
      t.classes.join(', '), 
      t.username, 
      t.password,
      t.role ? `${t.role}${t.branch ? ` - ${t.branch}` : ''}` : (t.branch || '')
    ]);

    if (isUpdate) {
      // Güncelleme: Başlık hariç (A2'den itibaren) temizle ve yeni verileri yaz
      if (studentValues.length > 0) {
        await updateSheetRange(accessToken, spreadsheetId, 'Öğrenciler!A2:C', studentValues);
      }
      if (teacherValues.length > 0) {
        await updateSheetRange(accessToken, spreadsheetId, 'Öğretmenler!A2:E', teacherValues);
      }
    } else {
      // İlk yükleme: Başlık kontrolü yap
      const existingHeaders = await readFromSheet(accessToken, spreadsheetId, 'Öğrenciler!A1:C1').catch(() => []);
      if (!existingHeaders || existingHeaders.length === 0 || !existingHeaders[0] || existingHeaders[0].length === 0) {
        await appendToSheet(accessToken, spreadsheetId, 'Öğrenciler!A1:C1', [['Sınıf', 'Numara', 'Adı Soyadı']]);
      }
      const existingTeacherHeaders = await readFromSheet(accessToken, spreadsheetId, 'Öğretmenler!A1:E1').catch(() => []);
      if (!existingTeacherHeaders || existingTeacherHeaders.length === 0 || !existingTeacherHeaders[0] || existingTeacherHeaders[0].length === 0) {
        await appendToSheet(accessToken, spreadsheetId, 'Öğretmenler!A1:E1', [['Adı Soyadı', 'Girdiği Sınıflar', 'Kullanıcı Adı', 'Şifre', 'Görevi / Branşı']]);
      }

      if (studentValues.length > 0) {
        await appendToSheet(accessToken, spreadsheetId, 'Öğrenciler!A:C', studentValues);
      }
      if (teacherValues.length > 0) {
        await appendToSheet(accessToken, spreadsheetId, 'Öğretmenler!A:E', teacherValues);
      }
    }

    return NextResponse.json({
      success: true,
      message: isUpdate 
        ? 'Mevcut veriler başarıyla güncellendi.' 
        : 'Veriler başarıyla Google E-Tabloya aktarıldı.',
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
