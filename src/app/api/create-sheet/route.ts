import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Yetkilendirme token bulunamadı.' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];

    // Google API istemcisini token ile yapılandır
    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: token });

    const drive = google.drive({ version: 'v3', auth: authClient });
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {}

    const schoolName = body?.schoolName?.trim() || '';
    const schoolKey = body?.schoolKey?.trim() || '';
    const oldSpreadsheetId = body?.oldSpreadsheetId?.trim() || '';
    const oldAccessToken = body?.oldAccessToken?.trim() || '';

    // Her okul için Drive'da benzersiz dosya adı oluştur
    // Örn: "Okul Risk Haritası - Meram Özel Eğitim III. Kademe (765432) - 2026"
    const currentYear = new Date().getFullYear();
    const title = schoolName 
      ? `Okul Risk Haritası ve ŞÖK - ${schoolName}${schoolKey ? ` (${schoolKey})` : ''} - ${currentYear}`
      : `Okul Risk Haritası ve ŞÖK - ${currentYear}`;

    // 1. Önce kullanıcının Google Drive'ında tam bu isimde aktif bir tablo var mı kontrol et
    const existing = await drive.files.list({
      q: `name = '${title.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
      fields: 'files(id, name, webViewLink)',
    });

    if (existing.data.files && existing.data.files.length > 0) {
      const existingFile = existing.data.files[0];
      return NextResponse.json({
        success: true,
        alreadyExisted: true,
        message: 'Drive üzerinde mevcut olan E-Tablonuz bağlandı.',
        spreadsheetId: existingFile.id,
        spreadsheetUrl: existingFile.webViewLink,
      });
    }

    // 2. Eğer yoksa yeni bir e-tablo oluştur (Okul Risk Haritası Şablonu)
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title,
        },
        sheets: [
          { properties: { title: 'Öğrenciler' } },
          { properties: { title: 'Öğretmenler' } },
          { properties: { title: 'OkulRisk' } },
        ],
      },
    });

    const fileId = spreadsheet.data.spreadsheetId;

    if (fileId) {
      // Eğer devir işleminden geliyorsa ve eski E-Tablo okunabiliyorsa verileri yeni E-Tabloya aktar
      if (oldSpreadsheetId && oldAccessToken && oldSpreadsheetId !== fileId) {
        try {
          const oldAuth = new google.auth.OAuth2();
          oldAuth.setCredentials({ access_token: oldAccessToken });
          const oldSheets = google.sheets({ version: 'v4', auth: oldAuth });

          const tabNames = ['Öğrenciler', 'Öğretmenler', 'OkulRisk'];
          for (const tab of tabNames) {
            const oldData = await oldSheets.spreadsheets.values.get({
              spreadsheetId: oldSpreadsheetId,
              range: `${tab}!A1:Z`
            }).catch(() => null);

            const rows = oldData?.data?.values;
            if (rows && rows.length > 0) {
              await sheets.spreadsheets.values.update({
                spreadsheetId: fileId,
                range: `${tab}!A1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: rows }
              }).catch(() => {});
            }
          }
        } catch (migrateErr) {
          console.warn('Eski E-Tablodan veri aktarımı yapılamadı (yeni boş E-Tablo kullanılacak):', migrateErr);
        }
      }

      return NextResponse.json({
        success: true,
        alreadyExisted: false,
        message: 'E-Tablo başarıyla oluşturuldu.',
        spreadsheetId: fileId,
        spreadsheetUrl: spreadsheet.data.spreadsheetUrl,
      });
    } else {
      throw new Error('Dosya ID alınamadı.');
    }
  } catch (error: any) {
    console.error('E-Tablo oluşturma hatası:', error);
    return NextResponse.json(
      { error: error.message || 'E-Tablo oluşturulurken bir hata meydana geldi.' },
      { status: 500 }
    );
  }
}
