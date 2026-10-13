import { NextRequest, NextResponse } from 'next/server';
import { readFromSheet, updateSheetRange, ensureSheetExists } from '@/lib/sheets';
import { MEB_OFFICIAL_RISK_ITEMS } from '@/lib/meb-risk-items';
import { FALLBACK_STUDENTS, FALLBACK_CLASSES } from '@/lib/school-constants';
import { getLatestSchoolData } from '@/lib/db';

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

  return {
    num: sNum,
    name: String(r[colOffset + 1] || '').trim(),
    className: String(r[colOffset + 2] || '').trim(),
    teacher: String(r[colOffset + 3] || '').trim(),
    branch: String(r[colOffset + 4] || '').trim(),
    opinion: String(r[colOffset + 5] || '').trim(),
    risks: parseRisks(r[colOffset + 6]),
    date: String(r[colOffset + 7] || '').trim()
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let spreadsheetId = searchParams.get('spreadsheetId');
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

    let students: Array<{ number: string; name: string; className: string }> = [];
    let teachers: Array<{ name: string; classes: string[]; roleOrBranch: string }> = [];
    let riskRows: any[][] = [];

    if (token && spreadsheetId) {
      try {
        const [studentRes, teacherRes, evalRes] = await Promise.all([
          readFromSheet(token, spreadsheetId, 'Öğrenciler!A2:C').catch(() => []),
          readFromSheet(token, spreadsheetId, 'Öğretmenler!A2:E').catch(() => []),
          readFromSheet(token, spreadsheetId, 'OkulRisk!A:Z').catch(() => [])
        ]);

        if (Array.isArray(studentRes) && studentRes.length > 0) {
          students = studentRes
            .map(r => ({ className: String(r[0] || '').trim(), number: String(r[1] || '').trim(), name: String(r[2] || '').trim() }))
            .filter(s => s.number || s.name);
        }

        if (Array.isArray(teacherRes) && teacherRes.length > 0) {
          teachers = teacherRes.map(r => ({
            name: String(r[0] || '').trim(),
            classes: String(r[1] || '').split(',').map(c => c.trim()).filter(Boolean),
            roleOrBranch: String(r[4] || '').trim()
          })).filter(t => t.name);
        }

        if (Array.isArray(evalRes)) {
          riskRows = evalRes;
        }
      } catch (err) {
        console.warn('E-Tablo okunurken hata oluştu:', err);
      }
    }

    // Eğer E-Tablo'dan öğrenci gelmediyse fallback öğrencileri kullan
    if (students.length === 0) {
      students = FALLBACK_STUDENTS.map(s => ({
        number: s.number,
        name: s.name,
        className: s.className
      }));
    }

    // 1. Öğrenci numarasına göre en güncel risk listesini haritala
    const studentRiskMap = new Map<string, number[]>();
    const opinionsList: any[] = [];

    for (const row of riskRows) {
      const rec = extractRecordFromRow(row);
      if (!rec) continue;

      if (rec.opinion) {
        opinionsList.push({
          studentNumber: rec.num,
          studentName: rec.name,
          className: rec.className,
          teacherName: rec.teacher,
          branch: rec.branch,
          opinion: rec.opinion,
          date: rec.date
        });
      }

      if (rec.risks && Array.isArray(rec.risks) && rec.risks.length > 0) {
        studentRiskMap.set(rec.num, rec.risks);
      }
    }

    // 2. Sınıfları belirle ve her sınıf için 36 risk maddesini say
    const uniqueClassNames = Array.from(new Set(students.map(s => s.className).filter(Boolean)));
    if (uniqueClassNames.length === 0) {
      uniqueClassNames.push(...FALLBACK_CLASSES.map(c => c.name));
    }

    const classRows = uniqueClassNames.map((className, idx) => {
      const classStudents = students.filter(s => s.className === className);
      const studentCount = classStudents.length;

      // Sınıf rehber öğretmenini bul
      const classTeacherObj = teachers.find(t => 
        (t.roleOrBranch.toLowerCase().includes('sınıf') || t.roleOrBranch.toLowerCase().includes('rehber')) &&
        t.classes.some(c => c.toLowerCase().includes(className.toLowerCase()) || className.toLowerCase().includes(c.toLowerCase()))
      );
      const classTeacher = classTeacherObj ? classTeacherObj.name : 'Belirlenmedi';

      // 36 risk maddesi için öğrenci sayıları
      const risks = Array.from({ length: 36 }, (_, itemIdx) => {
        let count = 0;
        for (const st of classStudents) {
          const stRisks = studentRiskMap.get(st.number);
          if (stRisks && stRisks.includes(itemIdx)) {
            count++;
          }
        }
        return count;
      });

      return {
        orderNo: idx + 1,
        className,
        studentCount,
        classTeacher,
        risks
      };
    });

    // Toplam satırını hesapla
    const totals = Array.from({ length: 36 }, (_, colIdx) => {
      return classRows.reduce((sum, row) => sum + (row.risks[colIdx] || 0), 0);
    });

    return NextResponse.json({
      success: true,
      classRows,
      totals,
      opinions: opinionsList,
      stats: {
        totalStudents: students.length,
        totalTeachers: teachers.length || 14
      }
    });
  } catch (error: any) {
    console.error('School risk matrix GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let { spreadsheetId, accessToken, classSummaries, schoolInfo } = await req.json();

    if (!spreadsheetId || !accessToken) {
      const schoolData = await getLatestSchoolData();
      if (schoolData) {
        if (!spreadsheetId) spreadsheetId = schoolData.spreadsheetId;
        if (!accessToken) accessToken = schoolData.accessToken;
      }
    }

    if (!spreadsheetId || !accessToken) {
      return NextResponse.json({ error: 'Spreadsheet ID ve token gereklidir. Lütfen önce Yönetici Girişi yapınız.' }, { status: 400 });
    }

    // Başlık satırı
    const headerRow = ["Sıra No", "Sınıf/Şube", ...MEB_OFFICIAL_RISK_ITEMS];
    
    // Sınıf satırları
    const dataRows = (classSummaries || []).map((cs: any, idx: number) => {
      const counts = MEB_OFFICIAL_RISK_ITEMS.map((item, itemIdx) => {
        return cs.risks?.[itemIdx] || cs.riskCounts?.[itemIdx] || 0;
      });
      return [idx + 1, cs.className, ...counts];
    });

    // Toplam satırı
    const totalRow = ["TOPLAM", "Tüm Okul"];
    for (let c = 0; c < MEB_OFFICIAL_RISK_ITEMS.length; c++) {
      let sum = 0;
      for (const row of dataRows) {
        sum += Number(row[c + 2]) || 0;
      }
      totalRow.push(String(sum));
    }

    const allSheetValues = [headerRow, ...dataRows, totalRow];

    // E-Tablo'da OkulRiskHaritasi sayfasını oluştur/güncelle
    await ensureSheetExists(accessToken, spreadsheetId, 'OkulRiskHaritasi', headerRow);
    await updateSheetRange(accessToken, spreadsheetId, 'OkulRiskHaritasi!A8:AN', allSheetValues);

    return NextResponse.json({
      success: true,
      message: 'Okul Risk Haritası E-Tabloya başarıyla işlendi.'
    });
  } catch (error: any) {
    console.error('Okul Risk Haritası oluşturma hatası:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
