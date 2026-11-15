import type ExcelJS from 'exceljs';
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

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF475569' } },
  left: { style: 'thin', color: { argb: 'FF475569' } },
  bottom: { style: 'thin', color: { argb: 'FF475569' } },
  right: { style: 'thin', color: { argb: 'FF475569' } },
};

const MEDIUM_TOTAL_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'medium', color: { argb: 'FF1E293B' } },
  left: { style: 'thin', color: { argb: 'FF475569' } },
  bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
  right: { style: 'thin', color: { argb: 'FF475569' } },
};

async function createWorkbook(): Promise<ExcelJS.Workbook> {
  const mod: any = await import('exceljs');
  const WorkbookCtor = mod?.Workbook || mod?.default?.Workbook;
  if (!WorkbookCtor) {
    throw new Error('ExcelJS yüklenemedi.');
  }
  const wb: ExcelJS.Workbook = new WorkbookCtor();
  wb.creator = 'Okul Risk Haritası ve ŞÖK Sistemi';
  wb.created = new Date();
  return wb;
}

/**
 * Ortak Yatay (Landscape) & Yatayda 1 Sayfaya Sığdır + Minimum Kenar Boşluğu Ayarı
 */
function configureLandscapePrintSetup(ws: ExcelJS.Worksheet) {
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.12,
      right: 0.12,
      top: 0.18,
      bottom: 0.18,
      header: 0.08,
      footer: 0.08,
    },
  };
  ws.views = [{ showGridLines: true }];
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
 * Tarayıcıda ArrayBuffer'ı .xlsx dosyası olarak indirir
 */
export function downloadExcelBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * YÖNERGE Sekmesi Ekler (S.İ.2.a veya S.İ.4.a)
 */
function addYonergeSheet(wb: ExcelJS.Workbook, formCode: 'S.İ.2.a' | 'S.İ.4.a') {
  const ws = wb.addWorksheet('YÖNERGE');
  const isSchoolForm = formCode === 'S.İ.2.a';
  configureLandscapePrintSetup(ws);

  ws.getColumn(1).width = 10;
  ws.getColumn(2).width = 4;
  ws.getColumn(3).width = 24;
  for (let c = 4; c <= 12; c++) {
    ws.getColumn(c).width = 14;
  }

  ws.getCell('C7').value = 'DİKKAT EDİLECEK HUSUSLAR;';
  ws.getCell('C7').font = { name: 'Calibri', size: 12, bold: true };

  ws.getCell('C9').value = 'KULLANIM AMACI';
  ws.getCell('C9').font = { name: 'Calibri', size: 11, bold: true };
  ws.mergeCells('C10:L11');
  ws.getCell('C10').value = isSchoolForm
    ? 'Okul/kurumlarda öğrencilerin risk gruplarında yer alma durumlarını, grup ve birey bazında yapılacak çalışmaları belirlemek için kullanılır.'
    : 'Sınıf/şubelerde öğrencilerin risk gruplarında yer alma durumlarını belirlemek için kullanılır.';
  ws.getCell('C10').alignment = { wrapText: true, vertical: 'top' };

  ws.getCell('C13').value = 'KİMLER KULLANIR';
  ws.getCell('C13').font = { name: 'Calibri', size: 11, bold: true };
  ws.mergeCells('C14:L15');
  ws.getCell('C14').value = isSchoolForm
    ? 'Rehberlik öğretmeni tarafından doldurulur. Sınıf risk haritalarına ait verilerin birleştirilmesiyle oluşturulur.'
    : 'Sınıf/şube rehber öğretmeni tarafından doldurulur. Bir örneği rehberlik servisine iletilir.';
  ws.getCell('C14').alignment = { wrapText: true, vertical: 'top' };

  ws.getCell('C17').value = 'DİKKAT EDİLECEK HUSUSLAR';
  ws.getCell('C17').font = { name: 'Calibri', size: 11, bold: true };
  ws.mergeCells('C18:L23');
  ws.getCell('C18').value = isSchoolForm
    ? 'Risk haritasında yer alan risk alanları, objektif değerlendirmeyle belirlenebilecek durumlar dikkate alınarak hazırlanmıştır. Bununla birlikte gözlem, görüşme ve bireyi tanıma teknikleri sonucunda elde edilen bilgiler ile risk grubunda olduğu belirlenen öğrenciler de çalışmalara dahil edilir. Örneğin özgüven eksikliği olan, antisosyal davranış gösteren, okula karşı olumsuz tutum sergileyen, sınıfta dışlanan, akran zorbalığına maruz kalan, şiddet eğilimi olan, ailesinin olanaklarından dolayı sosyal yaşantı eksikliği olan, istismar türlerine (fiziksel, cinsel, duygusal, ekonomik) maruz kalan, anne baba tutumları dolayısıyla olumsuz davranış gösteren, ihmal türlerine (duygusal, fiziksel, eğitim, sağlık) maruz kalan, alkol, madde ya da teknoloji bağımlılığı olan öğrenciler vb.'
    : 'Risk haritasında yer alan risk alanları, objektif değerlendirmeyle belirlenebilecek durumlar dikkate alınarak hazırlanmıştır. Bununla birlikte gözlem, görüşme ve bireyi tanıma teknikleri sonucunda elde edilen bilgiler ile risk grubunda olduğu belirlenen öğrenciler de "diğer" kategorisi altında rehberlik servisine bildirilir. Örneğin özgüven eksikliği olan, antisosyal davranış gösteren, okula karşı olumsuz tutum sergileyen, sınıfta dışlanan, akran zorbalığına maruz kalan, şiddet eğilimi olan, ailesinin olanaklarından dolayı sosyal yaşantı eksikliği olan, istismar türlerine (fiziksel, cinsel, duygusal, ekonomik) maruz kalan, anne baba tutumları dolayısıyla olumsuz davranış gösteren, ihmal türlerine (duygusal, fiziksel, eğitim, sağlık) maruz kalan, alkol, madde ya da teknoloji bağımlılığı olan öğrenciler vb.';
  ws.getCell('C18').alignment = { wrapText: true, vertical: 'top' };

  ws.getCell('A41').value = formCode;
  ws.getCell('A41').font = { name: 'Calibri', size: 10, bold: true };

  ws.mergeCells('A43:M43');
  ws.getCell('A43').value = 'ÖZEL EĞİTİM VE REHBERLİK HİZMETLERİ GENEL MÜDÜRLÜĞÜ';
  ws.getCell('A43').font = { name: 'Calibri', size: 11, bold: true };
  ws.getCell('A43').alignment = { horizontal: 'center', vertical: 'middle' };
}

/**
 * 1. RESMİ MEB OKUL RİSK HARİTASI (S.İ.2.a) — Dikey Başlık, Dar Sütunlar, Yatay 1 Sayfaya Sığdır
 */
export async function buildOfficialSchoolRiskMapBuffer(data: SchoolRiskExportData): Promise<ArrayBuffer> {
  const wb = await createWorkbook();
  const ws = wb.addWorksheet('OKUL RİSK HARİTASI');
  configureLandscapePrintSetup(ws);

  const yearStr = data.academicYear || '2025-2026';
  const schoolName = data.schoolName || 'Okul Adı';
  const district = data.district || '-';
  const totalStudents = Number.isFinite(Number(data.totalStudents)) ? Number(data.totalStudents) : 0;
  const totalTeachers = Number.isFinite(Number(data.totalTeachers)) ? Number(data.totalTeachers) : 0;

  // Sütun Genişlikleri (Dikey başlıklar sayesinde 36 risk sütunu 4.1 karakter genişliğinde!)
  ws.getColumn(1).width = 2; // A
  ws.getColumn(2).width = 2; // B
  ws.getColumn(3).width = 7.5; // C: Sıra No
  ws.getColumn(4).width = 27; // D: Sınıf/Şube
  for (let i = 0; i < 36; i++) {
    ws.getColumn(5 + i).width = 4.1; // E..AN: 36 Risk Maddesi
  }

  // Başlık Satırı 1
  ws.mergeCells('C1:AN1');
  const titleCell = ws.getCell('C1');
  titleCell.value = `${yearStr} EĞİTİM ÖĞRETİM YILI OKUL RİSK HARİTASI`;
  titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  titleCell.border = THIN_BORDER;
  ws.getRow(1).height = 28;

  // Üst Bilgi Satırları (C:D etiket -> ~34.5 genislik; E:AN sola dayalı değer!)
  const metaRows: Array<{ row: number; label: string; value: string | number; isNum?: boolean }> = [
    { row: 2, label: 'OKUL ADI', value: schoolName },
    { row: 3, label: 'İLÇESİ', value: district },
    { row: 4, label: 'TOPLAM ÖĞRENCİ SAYISI', value: totalStudents, isNum: true },
    { row: 5, label: 'TOPLAM ÖĞRETMEN SAYISI', value: totalTeachers, isNum: true },
  ];

  for (const m of metaRows) {
    ws.getRow(m.row).height = 20;
    ws.mergeCells(`C${m.row}:D${m.row}`);
    const lblCell = ws.getCell(`C${m.row}`);
    lblCell.value = m.label;
    lblCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    lblCell.alignment = { horizontal: 'left', vertical: 'middle' };
    lblCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    lblCell.border = THIN_BORDER;
    ws.getCell(`D${m.row}`).border = THIN_BORDER;

    ws.mergeCells(`E${m.row}:AN${m.row}`);
    const valCell = ws.getCell(`E${m.row}`);
    valCell.value = m.value;
    valCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    valCell.alignment = { horizontal: 'left', vertical: 'middle' };
    if (m.isNum) {
      valCell.numFmt = '0';
    }
    for (let col = 5; col <= 40; col++) {
      ws.getCell(m.row, col).border = THIN_BORDER;
    }
  }

  ws.mergeCells('C6:AN6');
  ws.getRow(6).height = 8;
  ws.getRow(7).height = 6;

  // Tablo Başlıkları (Satır 8)
  const headerRowNum = 8;
  ws.getRow(headerRowNum).height = 175;

  const hSira = ws.getCell(headerRowNum, 3);
  hSira.value = 'Sıra No';
  hSira.font = { name: 'Calibri', size: 9.5, bold: true };
  hSira.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  hSira.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  hSira.border = THIN_BORDER;

  const hSinif = ws.getCell(headerRowNum, 4);
  hSinif.value = 'Sınıf/Şube';
  hSinif.font = { name: 'Calibri', size: 9.5, bold: true };
  hSinif.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  hSinif.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  hSinif.border = THIN_BORDER;

  MEB_OFFICIAL_RISK_ITEMS.forEach((item, idx) => {
    const cell = ws.getCell(headerRowNum, 5 + idx);
    cell.value = item;
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = {
      textRotation: 90,
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = THIN_BORDER;
  });

  // Sınıf Satırları (Satır 9'dan başlar; en az sınıf sayısı veya 15 satır)
  const classCount = Math.max(data.classRows.length, 15);
  const startRowNum = 9;

  for (let i = 0; i < classCount; i++) {
    const r = startRowNum + i;
    const cr = data.classRows[i];
    const rowObj = ws.getRow(r);
    const clsName = cr ? cr.className : '';
    rowObj.height = clsName.length > 36 ? 26 : 18;

    const cOrder = ws.getCell(r, 3);
    cOrder.value = i + 1;
    cOrder.font = { name: 'Calibri', size: 9.5 };
    cOrder.alignment = { horizontal: 'center', vertical: 'middle' };
    cOrder.border = THIN_BORDER;

    const cClass = ws.getCell(r, 4);
    cClass.value = clsName;
    cClass.font = { name: 'Calibri', size: 9.5, bold: Boolean(clsName) };
    cClass.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    cClass.border = THIN_BORDER;

    for (let c = 0; c < 36; c++) {
      const val = cr && cr.risks ? Number(cr.risks[c]) || 0 : 0;
      const cell = ws.getCell(r, 5 + c);
      cell.value = val;
      cell.numFmt = '0';
      cell.font = {
        name: 'Calibri',
        size: 9.5,
        bold: val > 0,
        color: { argb: val > 0 ? 'FF1E3A8A' : 'FF64748B' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = THIN_BORDER;
    }
  }

  // TOPLAM Satırı
  const totalRowNum = startRowNum + classCount;
  const lastDataRowNum = totalRowNum - 1;
  ws.getRow(totalRowNum).height = 22;

  ws.mergeCells(`C${totalRowNum}:D${totalRowNum}`);
  const totLabel = ws.getCell(totalRowNum, 3);
  totLabel.value = 'TOPLAM';
  totLabel.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  totLabel.alignment = { horizontal: 'center', vertical: 'middle' };
  totLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  totLabel.border = MEDIUM_TOTAL_BORDER;
  ws.getCell(totalRowNum, 4).border = MEDIUM_TOTAL_BORDER;

  for (let c = 0; c < 36; c++) {
    const colLetter = ws.getColumn(5 + c).letter;
    const sumVal =
      data.totals && data.totals[c] !== undefined
        ? Number(data.totals[c]) || 0
        : data.classRows.reduce((acc, curr) => acc + (Number(curr.risks?.[c]) || 0), 0);

    const cell = ws.getCell(totalRowNum, 5 + c);
    cell.value = {
      formula: `SUM(${colLetter}${startRowNum}:${colLetter}${lastDataRowNum})`,
      result: sumVal,
    };
    cell.numFmt = '0';
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    cell.border = MEDIUM_TOTAL_BORDER;
  }

  // Alt Kurum Bilgisi
  const footerRowNum = totalRowNum + 2;
  ws.getRow(footerRowNum).height = 22;
  ws.mergeCells(`C${footerRowNum}:AN${footerRowNum}`);
  const footerCell = ws.getCell(footerRowNum, 3);
  footerCell.value = 'ÖZEL EĞİTİM VE REHBERLİK HİZMETLERİ GENEL MÜDÜRLÜĞÜ';
  footerCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
  footerCell.alignment = { horizontal: 'center', vertical: 'middle' };

  addYonergeSheet(wb, 'S.İ.2.a');

  const out = await wb.xlsx.writeBuffer();
  return out instanceof ArrayBuffer ? out : new Uint8Array(out).buffer;
}

/**
 * Tek bir sınıf için S.İ.4.a Sınıf Risk Haritası çalışma sayfasını (Sheet) çalışma kitabına ekler
 */
function buildClassRiskMapSheetOnWorkbook(
  wb: ExcelJS.Workbook,
  sheetName: string,
  data: SingleClassExportData
) {
  const ws = wb.addWorksheet(sheetName);
  configureLandscapePrintSetup(ws);

  const yearStr = data.academicYear || '2025-2026';
  const schoolName = data.schoolName || 'Okul Adı';
  const className = data.className || 'Sınıf/Şube';
  const classTeacher =
    data.classTeacher && data.classTeacher !== 'Belirlenmedi'
      ? data.classTeacher
      : 'Sınıf Rehber Öğretmeni';
  const studentCount = Array.isArray(data.students) ? data.students.length : 0;

  // Sütun Genişlikleri (Dikey başlıklar sayesinde G..AP arası 36 risk sütunu 4.0 genişliğinde!)
  ws.getColumn(1).width = 2; // A
  ws.getColumn(2).width = 2; // B
  ws.getColumn(3).width = 6.5; // C: Sıra No
  ws.getColumn(4).width = 18; // D: Sınıf/Şube
  ws.getColumn(5).width = 10.5; // E: Okul Numarası
  ws.getColumn(6).width = 24; // F: Öğrencinin Adı Soyadı
  for (let i = 0; i < 36; i++) {
    ws.getColumn(7 + i).width = 4.0; // G..AP: 36 Risk Maddesi
  }

  // Başlık Satırı 1
  ws.mergeCells('C1:AP1');
  const titleCell = ws.getCell('C1');
  titleCell.value = `${yearStr} EĞİTİM ÖĞRETİM YILI SINIF RİSK HARİTASI`;
  titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  titleCell.border = THIN_BORDER;
  ws.getRow(1).height = 28;

  // Üst Bilgiler (C:E etiket -> ~35 genislik; F:AP sola dayalı değer!)
  const infoRows: Array<{ row: number; label: string; value: string | number; isNum?: boolean }> = [
    { row: 2, label: 'OKUL ADI:', value: schoolName },
    { row: 3, label: 'SINIF / ŞUBE:', value: className },
    { row: 4, label: 'SINIF REHBER ÖĞRETMENİ:', value: classTeacher },
    { row: 5, label: 'TOPLAM ÖĞRENCİ SAYISI:', value: studentCount, isNum: true },
  ];

  for (const info of infoRows) {
    ws.getRow(info.row).height = 20;
    ws.mergeCells(`C${info.row}:E${info.row}`);
    const lbl = ws.getCell(`C${info.row}`);
    lbl.value = info.label;
    lbl.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    lbl.alignment = { horizontal: 'left', vertical: 'middle' };
    lbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    for (let col = 3; col <= 5; col++) {
      ws.getCell(info.row, col).border = THIN_BORDER;
    }

    ws.mergeCells(`F${info.row}:AP${info.row}`);
    const valCell = ws.getCell(`F${info.row}`);
    valCell.value = info.value;
    valCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    valCell.alignment = { horizontal: 'left', vertical: 'middle' };
    if (info.isNum) {
      valCell.numFmt = '0';
    }
    for (let col = 6; col <= 42; col++) {
      ws.getCell(info.row, col).border = THIN_BORDER;
    }
  }

  ws.mergeCells('C6:AP6');
  ws.getRow(6).height = 8;
  ws.getRow(7).height = 6;

  // Tablo Başlıkları (Satır 8)
  const headerRowNum = 8;
  ws.getRow(headerRowNum).height = 175;

  const fixedHeaders: Array<{ col: number; text: string }> = [
    { col: 3, text: 'Sıra No' },
    { col: 4, text: 'Sınıf/Şube' },
    { col: 5, text: 'Okul Numarası' },
    { col: 6, text: 'Öğrencinin Adı Soyadı' },
  ];

  for (const h of fixedHeaders) {
    const cell = ws.getCell(headerRowNum, h.col);
    cell.value = h.text;
    cell.font = { name: 'Calibri', size: 9.5, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = THIN_BORDER;
  }

  MEB_CLASS_RISK_ITEMS.forEach((item, idx) => {
    const cell = ws.getCell(headerRowNum, 7 + idx);
    cell.value = item;
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = {
      textRotation: 90,
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = THIN_BORDER;
  });

  // Öğrenci Satırları (Satır 9'dan başlar; en az öğrenci sayısı veya 15 satır)
  const minRows = Math.max(studentCount, 15);
  const startRowNum = 9;

  for (let i = 0; i < minRows; i++) {
    const r = startRowNum + i;
    const st = data.students[i];
    const rowCls = st ? st.className || className : '';
    ws.getRow(r).height = rowCls.length > 26 || (st?.name || '').length > 26 ? 24 : 18;

    const cOrder = ws.getCell(r, 3);
    cOrder.value = i + 1;
    cOrder.font = { name: 'Calibri', size: 9.5 };
    cOrder.alignment = { horizontal: 'center', vertical: 'middle' };
    cOrder.border = THIN_BORDER;

    const cClass = ws.getCell(r, 4);
    cClass.value = rowCls;
    cClass.font = { name: 'Calibri', size: 9 };
    cClass.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    cClass.border = THIN_BORDER;

    const cNo = ws.getCell(r, 5);
    cNo.value = st ? String(st.number || '') : '';
    cNo.font = { name: 'Calibri', size: 9.5 };
    cNo.alignment = { horizontal: 'center', vertical: 'middle' };
    cNo.border = THIN_BORDER;

    const cName = ws.getCell(r, 6);
    cName.value = st ? String(st.name || '') : '';
    cName.font = { name: 'Calibri', size: 9.5, bold: Boolean(st) };
    cName.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    cName.border = THIN_BORDER;

    for (let c = 0; c < 36; c++) {
      const hasRisk = Boolean(st && Array.isArray(st.risks) && st.risks.includes(c));
      const cell = ws.getCell(r, 7 + c);
      if (hasRisk) {
        cell.value = 1;
        cell.numFmt = '0';
        cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF1E3A8A' } };
      } else {
        cell.value = '';
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = THIN_BORDER;
    }
  }

  // TOPLAM Satırı
  const totalRowNum = startRowNum + minRows;
  const lastDataRowNum = totalRowNum - 1;
  ws.getRow(totalRowNum).height = 22;

  ws.mergeCells(`C${totalRowNum}:F${totalRowNum}`);
  const totLbl = ws.getCell(totalRowNum, 3);
  totLbl.value = 'TOPLAM';
  totLbl.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
  totLbl.alignment = { horizontal: 'center', vertical: 'middle' };
  totLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  for (let col = 3; col <= 6; col++) {
    ws.getCell(totalRowNum, col).border = MEDIUM_TOTAL_BORDER;
  }

  for (let c = 0; c < 36; c++) {
    const colLetter = ws.getColumn(7 + c).letter;
    const sumCount = data.students.filter((st) => Array.isArray(st.risks) && st.risks.includes(c)).length;

    const cell = ws.getCell(totalRowNum, 7 + c);
    cell.value = {
      formula: `SUM(${colLetter}${startRowNum}:${colLetter}${lastDataRowNum})`,
      result: sumCount,
    };
    cell.numFmt = '0';
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    cell.border = MEDIUM_TOTAL_BORDER;
  }

  // Alt Kurum Bilgisi
  const footerRowNum = totalRowNum + 2;
  ws.getRow(footerRowNum).height = 22;
  ws.mergeCells(`C${footerRowNum}:AP${footerRowNum}`);
  const footerCell = ws.getCell(footerRowNum, 3);
  footerCell.value = 'ÖZEL EĞİTİM VE REHBERLİK HİZMETLERİ GENEL MÜDÜRLÜĞÜ';
  footerCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
  footerCell.alignment = { horizontal: 'center', vertical: 'middle' };
}

/**
 * 2. TEK BİR SINIFIN SINIF RİSK HARİTASI ÇALIŞMA KİTABI (S.İ.4.a)
 */
export async function buildOfficialSingleClassRiskMapBuffer(data: SingleClassExportData): Promise<ArrayBuffer> {
  const wb = await createWorkbook();
  const sheetName = sanitizeSheetName(data.className, 'SINIF RİSK HARİTASI');
  buildClassRiskMapSheetOnWorkbook(wb, sheetName, data);
  addYonergeSheet(wb, 'S.İ.4.a');

  const out = await wb.xlsx.writeBuffer();
  return out instanceof ArrayBuffer ? out : new Uint8Array(out).buffer;
}

/**
 * 3. TÜM SINIFLARIN BİR ARADA OLDUĞU SINIF RİSK HARİTALARI ÇALIŞMA KİTABI (Yönetici İçin)
 */
export async function buildOfficialAllClassesRiskMapBuffer(data: AllClassesExportData): Promise<ArrayBuffer> {
  const wb = await createWorkbook();
  const usedSheetNames = new Set<string>();

  data.classes.forEach((cls, idx) => {
    const rawName = cls.className || `Sinif_${idx + 1}`;
    let sheetName = sanitizeSheetName(rawName, `Sinif_${idx + 1}`);

    let counter = 2;
    while (usedSheetNames.has(sheetName.toLowerCase())) {
      const suffix = `_${counter}`;
      sheetName = `${sheetName.slice(0, 31 - suffix.length)}${suffix}`;
      counter++;
    }
    usedSheetNames.add(sheetName.toLowerCase());

    buildClassRiskMapSheetOnWorkbook(wb, sheetName, {
      schoolName: data.schoolName,
      district: data.district,
      academicYear: data.academicYear,
      className: cls.className,
      classTeacher: cls.classTeacher,
      students: cls.students,
    });
  });

  addYonergeSheet(wb, 'S.İ.4.a');

  const out = await wb.xlsx.writeBuffer();
  return out instanceof ArrayBuffer ? out : new Uint8Array(out).buffer;
}
