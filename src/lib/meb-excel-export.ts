import * as XLSX from 'xlsx';
import { MEB_OFFICIAL_RISK_ITEMS } from './meb-risk-items';

// Sınıf Risk Haritasında 35. madde başlığı "yabancı uyruklu öğrenci" olarak geçer
export const MEB_CLASS_RISK_ITEMS = MEB_OFFICIAL_RISK_ITEMS.map((item, idx) => {
  if (idx === 34) return 'yabancı uyruklu öğrenci';
  return item;
});

export interface SchoolRiskExportData {
  schoolName: string;
  district?: string;
  academicYear: string;
  totalStudents: number;
  totalTeachers: number;
  classRows: Array<{
    orderNo?: number;
    className: string;
    risks: number[];
  }>;
  totals?: number[];
}

export interface ClassStudentRiskData {
  number: string;
  name: string;
  className?: string;
  risks: number[];
  otherRiskNote?: string;
}

export interface SingleClassExportData {
  schoolName: string;
  district?: string;
  academicYear: string;
  className: string;
  classTeacher?: string;
  students: ClassStudentRiskData[];
}

export interface AllClassesExportData {
  schoolName: string;
  district?: string;
  academicYear: string;
  classes: Array<{
    className: string;
    classTeacher?: string;
    students: ClassStudentRiskData[];
  }>;
}

/**
 * Excel sekme adları için geçersiz karakterleri temizler ve 31 karakterle sınırlar
 */
function sanitizeSheetName(name: string, fallback: string): string {
  const cleaned = (name || '')
    .replace(/[\\/*?:[\]]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return fallback.slice(0, 31);
  return cleaned.slice(0, 31);
}

/**
 * YÖNERGE Sekmesi Ekler (S.İ.2.a veya S.İ.4.a)
 */
function createYonergeSheet(formCode: 'S.İ.2.a' | 'S.İ.4.a'): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const isSchoolForm = formCode === 'S.İ.2.a';

  ws['C7'] = { t: 's', v: 'DİKKAT EDİLECEK HUSUSLAR; ' };
  ws['C9'] = { t: 's', v: 'KULLANIM AMACI' };
  ws['C10'] = {
    t: 's',
    v: isSchoolForm
      ? 'Okul/kurumlarda öğrencilerin risk gruplarında yer alma durumlarını,  grup ve birey bazında yapılacak çalışmaları belirlemek için kullanılır.  '
      : 'Sınıf/şubelerde öğrencilerin risk gruplarında yer alma durumlarını belirlemek için kullanılır.  '
  };

  ws['C13'] = { t: 's', v: 'KİMLER KULLANIR' };
  ws['C14'] = {
    t: 's',
    v: isSchoolForm
      ? 'Rehberlik öğretmeni tarafından doldurulur. Sınıf risk haritalarına ait verilerin birleştirilmesiyle oluşturulur.  '
      : 'Sınıf/şube rehber öğretmeni tarafından doldurulur. Bir örneği rehberlik servisine iletilir.  '
  };

  ws['C17'] = { t: 's', v: 'DİKKAT EDİLECEK HUSUSLAR' };
  ws['C18'] = {
    t: 's',
    v: isSchoolForm
      ? 'Risk haritasında yer alan risk alanları, objektif değerlendirmeyle belirlenebilecek durumlar dikkate alınarak hazırlanmıştır. Bununla birlikte gözlem, görüşme ve bireyi tanıma teknikleri sonucunda elde edilen bilgiler ile risk grubunda olduğu belirlenen öğrenciler de çalışmalara dahil edilir. Örneğin özgüven eksikliği olan, antisosyal davranış gösteren, okula karşı olumsuz tutum sergileyen, sınıfta dışlanan, akran zorbalığına maruz kalan, şiddet eğilimi olan, ailesinin olanaklarından dolayı sosyal yaşantı eksikliği olan, istismar türlerine (fiziksel, cinsel, duygusal, ekonomik) maruz kalan,  anne baba tutumları dolayısıyla olumsuz davranış gösteren, ihmal türlerine (duygusal, fiziksel, eğitim, sağlık) maruz kalan, alkol, madde ya da teknoloji bağımlılığı olan öğrenciler vb.  '
      : 'Risk haritasında yer alan risk alanları, objektif değerlendirmeyle belirlenebilecek durumlar dikkate alınarak hazırlanmıştır. Bununla birlikte gözlem, görüşme ve bireyi tanıma teknikleri sonucunda elde edilen bilgiler ile risk grubunda olduğu belirlenen öğrenciler de "diğer" kategorisi altında rehberlik servisine bildirilir. Örneğin özgüven eksikliği olan, antisosyal davranış gösteren, okula karşı olumsuz tutum sergileyen, sınıfta dışlanan, akran zorbalığına maruz kalan, şiddet eğilimi olan, ailesinin olanaklarından dolayı sosyal yaşantı eksikliği olan, istismar türlerine (fiziksel, cinsel, duygusal, ekonomik) maruz kalan,  anne baba tutumları dolayısıyla olumsuz davranış gösteren, ihmal türlerine (duygusal, fiziksel, eğitim, sağlık) maruz kalan, alkol, madde ya da teknoloji bağımlılığı olan öğrenciler vb. '
  };

  ws['A41'] = { t: 's', v: formCode };
  ws['A43'] = { t: 's', v: 'ÖZEL EĞİTİM VE REHBERLİK HİZMETLERİ GENEL MÜDÜRLÜĞÜ' };

  ws['!merges'] = [
    { s: { c: 2, r: 9 }, e: { c: 11, r: 10 } },
    { s: { c: 2, r: 13 }, e: { c: 11, r: 14 } },
    { s: { c: 2, r: 17 }, e: { c: 11, r: 22 } },
    { s: { c: 0, r: 42 }, e: { c: 12, r: 42 } }
  ];

  ws['!cols'] = [
    { wch: 10 },
    { wch: 4 },
    { wch: 20 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 }
  ];

  ws['!ref'] = 'A1:M44';
  return ws;
}

/**
 * 1. RESMİ MEB OKUL RİSK HARİTASI (15173010_okulriskharitasi.xlsx - S.İ.2.a)
 */
export function buildOfficialSchoolRiskMapWorkbook(data: SchoolRiskExportData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];

  const yearStr = data.academicYear || '2025-2026';
  const schoolName = data.schoolName || 'Okul Adı';
  const district = data.district || '-';

  // Üst Bilgiler
  ws['C1'] = { t: 's', v: `${yearStr} EĞİTİM ÖĞRETİM YILI OKUL RİSK HARİTASI ` };
  merges.push({ s: { c: 2, r: 0 }, e: { c: 39, r: 0 } });

  ws['C2'] = { t: 's', v: 'OKUL ADI' };
  merges.push({ s: { c: 2, r: 1 }, e: { c: 8, r: 1 } });
  ws['J2'] = { t: 's', v: schoolName };
  merges.push({ s: { c: 9, r: 1 }, e: { c: 28, r: 1 } });

  ws['C3'] = { t: 's', v: 'İLÇESİ' };
  merges.push({ s: { c: 2, r: 2 }, e: { c: 8, r: 2 } });
  ws['J3'] = { t: 's', v: district };
  merges.push({ s: { c: 9, r: 2 }, e: { c: 28, r: 2 } });

  ws['C4'] = { t: 's', v: 'TOPLAM ÖĞRENCİ SAYISI      ' };
  merges.push({ s: { c: 2, r: 3 }, e: { c: 8, r: 3 } });
  ws['J4'] = { t: 'n', v: data.totalStudents || 0 };
  merges.push({ s: { c: 9, r: 3 }, e: { c: 28, r: 3 } });

  ws['C5'] = { t: 's', v: 'TOPLAM ÖĞRETMEN SAYISI  ' };
  merges.push({ s: { c: 2, r: 4 }, e: { c: 8, r: 4 } });
  ws['J5'] = { t: 'n', v: data.totalTeachers || 0 };
  merges.push({ s: { c: 9, r: 4 }, e: { c: 28, r: 4 } });

  ws['C6'] = { t: 's', v: ' ' };
  merges.push({ s: { c: 2, r: 5 }, e: { c: 39, r: 5 } });

  // Tablo Başlıkları (Satır 8 / r = 7)
  const headerRowIdx = 7;
  ws[XLSX.utils.encode_cell({ r: headerRowIdx, c: 2 })] = { t: 's', v: 'Sıra No' };
  ws[XLSX.utils.encode_cell({ r: headerRowIdx, c: 3 })] = { t: 's', v: 'Sınıf/Şube' };

  MEB_OFFICIAL_RISK_ITEMS.forEach((item, idx) => {
    ws[XLSX.utils.encode_cell({ r: headerRowIdx, c: 4 + idx })] = { t: 's', v: item };
  });

  // Sınıf Satırları (Satır 9'dan başlar / r = 8)
  const classCount = Math.max(data.classRows.length, 32); // Şablonda en az 32 satır hazır bulunur
  const startRowIdx = 8;

  for (let i = 0; i < classCount; i++) {
    const rowIdx = startRowIdx + i;
    const cr = data.classRows[i];

    ws[XLSX.utils.encode_cell({ r: rowIdx, c: 2 })] = { t: 'n', v: i + 1 };
    ws[XLSX.utils.encode_cell({ r: rowIdx, c: 3 })] = { t: 's', v: cr ? cr.className : '' };

    for (let c = 0; c < 36; c++) {
      const val = cr && cr.risks ? Number(cr.risks[c]) || 0 : 0;
      ws[XLSX.utils.encode_cell({ r: rowIdx, c: 4 + c })] = {
        t: 'n',
        v: val
      };
    }
  }

  // TOPLAM Satırı
  const totalRowIdx = startRowIdx + classCount;
  ws[XLSX.utils.encode_cell({ r: totalRowIdx, c: 2 })] = { t: 's', v: 'TOPLAM' };
  ws[XLSX.utils.encode_cell({ r: totalRowIdx, c: 3 })] = { t: 's', v: '' };

  const firstExcelRowNum = startRowIdx + 1; // 9
  const lastExcelRowNum = totalRowIdx; // e.g. 40

  for (let c = 0; c < 36; c++) {
    const colLetter = XLSX.utils.encode_col(4 + c);
    const sumVal = data.totals && data.totals[c] !== undefined
      ? data.totals[c]
      : data.classRows.reduce((acc, curr) => acc + (Number(curr.risks?.[c]) || 0), 0);

    ws[XLSX.utils.encode_cell({ r: totalRowIdx, c: 4 + c })] = {
      t: 'n',
      f: `SUM(${colLetter}${firstExcelRowNum}:${colLetter}${lastExcelRowNum})`,
      v: sumVal
    };
  }

  // Alt Başlık (Özel Eğitim ve Rehberlik Hizmetleri Genel Müdürlüğü)
  const footerRowIdx = totalRowIdx + 2;
  ws[XLSX.utils.encode_cell({ r: footerRowIdx, c: 0 })] = {
    t: 's',
    v: 'ÖZEL EĞİTİM VE REHBERLİK HİZMETLERİ GENEL MÜDÜRLÜĞÜ'
  };
  merges.push({ s: { c: 0, r: footerRowIdx }, e: { c: 41, r: footerRowIdx } });

  // Sütun Genişlikleri
  const colsConfig: Array<{ wch: number }> = [
    { wch: 3 }, // A
    { wch: 3 }, // B
    { wch: 8 }, // C: Sıra No
    { wch: 22 }, // D: Sınıf/Şube
  ];
  for (let i = 0; i < 36; i++) {
    colsConfig.push({ wch: 14 }); // Risk Sütunları
  }

  ws['!merges'] = merges;
  ws['!cols'] = colsConfig;
  ws['!ref'] = `A1:${XLSX.utils.encode_col(41)}${footerRowIdx + 2}`;

  // 1. Sayfa: OKUL RİSK HARİTASI
  XLSX.utils.book_append_sheet(wb, ws, 'OKUL RİSK HARİTASI');

  // 2. Sayfa: YÖNERGE (S.İ.2.a)
  const yonergeWs = createYonergeSheet('S.İ.2.a');
  XLSX.utils.book_append_sheet(wb, yonergeWs, 'YÖNERGE');

  return wb;
}

/**
 * Tek bir sınıf için S.İ.4.a Sınıf Risk Haritası Excel Çalışma Sayfası (WorkSheet) üretir
 */
export function buildClassRiskMapSheet(data: SingleClassExportData): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];

  const yearStr = data.academicYear || '2025-2026';
  const schoolName = data.schoolName || 'Okul Adı';
  const className = data.className || 'Sınıf/Şube';
  const classTeacher = data.classTeacher || 'Sınıf Rehber Öğretmeni';
  const studentCount = data.students.length;

  // Üst Bilgiler
  ws['C1'] = { t: 's', v: `${yearStr} EĞİTİM ÖĞRETİM YILI SINIF RİSK HARİTASI` };
  merges.push({ s: { c: 2, r: 0 }, e: { c: 41, r: 0 } });

  ws['C2'] = { t: 's', v: 'OKUL ADI:' };
  merges.push({ s: { c: 2, r: 1 }, e: { c: 8, r: 1 } });
  ws['J2'] = { t: 's', v: schoolName };
  merges.push({ s: { c: 9, r: 1 }, e: { c: 28, r: 1 } });

  ws['C3'] = { t: 's', v: 'SINIF / ŞUBE:' };
  merges.push({ s: { c: 2, r: 2 }, e: { c: 8, r: 2 } });
  ws['J3'] = { t: 's', v: className };
  merges.push({ s: { c: 9, r: 2 }, e: { c: 28, r: 2 } });

  ws['C4'] = { t: 's', v: 'SINIF REHBER ÖĞRETMENİ:' };
  merges.push({ s: { c: 2, r: 3 }, e: { c: 8, r: 3 } });
  ws['J4'] = { t: 's', v: classTeacher };
  merges.push({ s: { c: 9, r: 3 }, e: { c: 28, r: 3 } });

  ws['C5'] = { t: 's', v: 'TOPLAM ÖĞRENCİ SAYISI:' };
  merges.push({ s: { c: 2, r: 4 }, e: { c: 8, r: 4 } });
  ws['J5'] = { t: 'n', v: studentCount };
  merges.push({ s: { c: 9, r: 4 }, e: { c: 28, r: 4 } });

  ws['C6'] = { t: 's', v: ' ' };
  merges.push({ s: { c: 2, r: 5 }, e: { c: 41, r: 5 } });

  // Tablo Başlıkları (Satır 8 / r = 7)
  const headerRowIdx = 7;
  ws[XLSX.utils.encode_cell({ r: headerRowIdx, c: 2 })] = { t: 's', v: 'Sıra No' };
  ws[XLSX.utils.encode_cell({ r: headerRowIdx, c: 3 })] = { t: 's', v: 'Sınıf/Şube' };
  ws[XLSX.utils.encode_cell({ r: headerRowIdx, c: 4 })] = { t: 's', v: 'Okul Numarası' };
  ws[XLSX.utils.encode_cell({ r: headerRowIdx, c: 5 })] = { t: 's', v: 'Öğrencinin Adı Soyadı' };

  MEB_CLASS_RISK_ITEMS.forEach((item, idx) => {
    ws[XLSX.utils.encode_cell({ r: headerRowIdx, c: 6 + idx })] = { t: 's', v: item };
  });

  // Öğrenci Satırları (Satır 9'dan başlar / r = 8)
  const minRows = Math.max(studentCount, 30); // MEB şablonunda en az 30 satır alan açılır
  const startRowIdx = 8;

  for (let i = 0; i < minRows; i++) {
    const rowIdx = startRowIdx + i;
    const st = data.students[i];

    ws[XLSX.utils.encode_cell({ r: rowIdx, c: 2 })] = { t: 'n', v: i + 1 };
    ws[XLSX.utils.encode_cell({ r: rowIdx, c: 3 })] = { t: 's', v: st ? (st.className || className) : '' };
    ws[XLSX.utils.encode_cell({ r: rowIdx, c: 4 })] = { t: 's', v: st ? String(st.number || '') : '' };
    ws[XLSX.utils.encode_cell({ r: rowIdx, c: 5 })] = { t: 's', v: st ? String(st.name || '') : '' };

    for (let c = 0; c < 36; c++) {
      const hasRisk = st && Array.isArray(st.risks) && st.risks.includes(c);
      if (hasRisk) {
        ws[XLSX.utils.encode_cell({ r: rowIdx, c: 6 + c })] = { t: 'n', v: 1 };
      } else {
        ws[XLSX.utils.encode_cell({ r: rowIdx, c: 6 + c })] = { t: 's', v: '' };
      }
    }
  }

  // TOPLAM Satırı
  const totalRowIdx = startRowIdx + minRows;
  ws[XLSX.utils.encode_cell({ r: totalRowIdx, c: 2 })] = { t: 's', v: 'TOPLAM' };
  ws[XLSX.utils.encode_cell({ r: totalRowIdx, c: 3 })] = { t: 's', v: '' };
  ws[XLSX.utils.encode_cell({ r: totalRowIdx, c: 4 })] = { t: 's', v: '' };
  ws[XLSX.utils.encode_cell({ r: totalRowIdx, c: 5 })] = { t: 's', v: '' };

  const firstExcelRowNum = startRowIdx + 1; // 9
  const lastExcelRowNum = totalRowIdx; // e.g. 38

  for (let c = 0; c < 36; c++) {
    const colLetter = XLSX.utils.encode_col(6 + c);
    const sumCount = data.students.filter(st => Array.isArray(st.risks) && st.risks.includes(c)).length;

    ws[XLSX.utils.encode_cell({ r: totalRowIdx, c: 6 + c })] = {
      t: 'n',
      f: `SUM(${colLetter}${firstExcelRowNum}:${colLetter}${lastExcelRowNum})`,
      v: sumCount
    };
  }

  // Alt Başlık (Özel Eğitim ve Rehberlik Hizmetleri Genel Müdürlüğü)
  const footerRowIdx = totalRowIdx + 2;
  ws[XLSX.utils.encode_cell({ r: footerRowIdx, c: 0 })] = {
    t: 's',
    v: 'ÖZEL EĞİTİM VE REHBERLİK HİZMETLERİ GENEL MÜDÜRLÜĞÜ'
  };
  merges.push({ s: { c: 0, r: footerRowIdx }, e: { c: 41, r: footerRowIdx } });

  // Sütun Genişlikleri
  const colsConfig: Array<{ wch: number }> = [
    { wch: 3 }, // A
    { wch: 3 }, // B
    { wch: 8 }, // C: Sıra No
    { wch: 16 }, // D: Sınıf/Şube
    { wch: 14 }, // E: Okul Numarası
    { wch: 26 }, // F: Öğrencinin Adı Soyadı
  ];
  for (let i = 0; i < 36; i++) {
    colsConfig.push({ wch: 14 }); // Risk Sütunları
  }

  ws['!merges'] = merges;
  ws['!cols'] = colsConfig;
  ws['!ref'] = `A1:${XLSX.utils.encode_col(41)}${footerRowIdx + 2}`;

  return ws;
}

/**
 * 2. TEK BİR SINIFIN SINIF RİSK HARİTASI ÇALIŞMA KİTABI (S.İ.4.a)
 */
export function buildOfficialSingleClassRiskMapWorkbook(data: SingleClassExportData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const classSheet = buildClassRiskMapSheet(data);
  const sheetName = sanitizeSheetName(data.className, 'SINIF RİSK HARİTASI');

  XLSX.utils.book_append_sheet(wb, classSheet, sheetName);

  // YÖNERGE Sekmesi (S.İ.4.a)
  const yonergeWs = createYonergeSheet('S.İ.4.a');
  XLSX.utils.book_append_sheet(wb, yonergeWs, 'YÖNERGE');

  return wb;
}

/**
 * 3. TÜM SINIFLARIN BİR ARADA OLDUĞU SINIF RİSK HARİTALARI ÇALIŞMA KİTABI (Yönetici İçin)
 * Her sınıf ayrı bir sekmede yer alır; en sonda YÖNERGE sekmesi bulunur.
 */
export function buildOfficialAllClassesRiskMapWorkbook(data: AllClassesExportData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();

  data.classes.forEach((cls, idx) => {
    const rawName = cls.className || `Sinif_${idx + 1}`;
    let sheetName = sanitizeSheetName(rawName, `Sinif_${idx + 1}`);

    // Benzersiz sekme adı kontrolü
    let counter = 2;
    while (usedSheetNames.has(sheetName.toLowerCase())) {
      const suffix = `_${counter}`;
      sheetName = `${sheetName.slice(0, 31 - suffix.length)}${suffix}`;
      counter++;
    }
    usedSheetNames.add(sheetName.toLowerCase());

    const classSheet = buildClassRiskMapSheet({
      schoolName: data.schoolName,
      district: data.district,
      academicYear: data.academicYear,
      className: cls.className,
      classTeacher: cls.classTeacher,
      students: cls.students
    });

    XLSX.utils.book_append_sheet(wb, classSheet, sheetName);
  });

  // YÖNERGE Sekmesi (S.İ.4.a)
  const yonergeWs = createYonergeSheet('S.İ.4.a');
  XLSX.utils.book_append_sheet(wb, yonergeWs, 'YÖNERGE');

  return wb;
}
