import { appendToSheet, ensureSheetExists } from './sheets';

export const AUDIT_LOG_HEADERS = [
  'Tarih & Saat',
  'İşlemi Yapan',
  'Rol / Görev',
  'İşlem Türü',
  'Öğrenci No',
  'Öğrenci Adı',
  'Detay / Açıklama',
  'IP / İstemci'
];

interface AuditLogEntry {
  performedBy: string;
  role: string;
  action: 'GIRIS' | 'RISK_KAYIT' | 'GORUS_KAYIT' | 'VERI_INCELEME' | 'CIKIS';
  studentNo?: string;
  studentName?: string;
  details?: string;
  ip?: string;
}

/**
 * KVKK denetim izini Google Sheets 'DenetimIzi' sayfasına asenkron olarak yazar.
 * Bu işlem ana akışı bloklamadan (fire-and-forget) arka planda çalıştırılabilir.
 */
export async function logAuditEvent(
  accessToken: string | object,
  spreadsheetId: string,
  entry: AuditLogEntry
) {
  try {
    if (!accessToken || !spreadsheetId) return;

    await ensureSheetExists(accessToken, spreadsheetId, 'DenetimIzi', AUDIT_LOG_HEADERS);

    const now = new Date();
    const timestamp = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    const row = [
      timestamp,
      entry.performedBy || 'Bilinmeyen Kullanıcı',
      entry.role || 'Öğretmen',
      entry.action,
      entry.studentNo || '-',
      entry.studentName || '-',
      entry.details || '-',
      entry.ip || '-'
    ];

    await appendToSheet(accessToken, spreadsheetId, 'DenetimIzi!A:H', [row]);
  } catch (error) {
    console.warn('KVKK Denetim İzi kaydı oluşturulamadı:', error);
  }
}
