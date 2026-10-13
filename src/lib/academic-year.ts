/**
 * Mevcut tarihe göre aktif MEB Eğitim Öğretim Yılını hesaplar.
 * Örn: Eylül (ay >= 8) ve sonrası için YIL-(YIL+1), öncesi için (YIL-1)-YIL.
 */
export function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed: 8 is September
  if (month >= 8) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

/**
 * Eğitim öğretim yılına göre dinamik E-Tablo başlığı veya sayfa etiketi üretir.
 */
export function getAcademicYearLabel(): string {
  return `${getCurrentAcademicYear()} Eğitim Öğretim Yılı`;
}
