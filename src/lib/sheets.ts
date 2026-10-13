import { google } from 'googleapis';

/**
 * Hem OAuth2 Access Token hem de Service Account JSON ile Google Sheets istemcisi üretir.
 */
export function getSheetsClient(authParam: string | object) {
  if (typeof authParam === 'object' || (typeof authParam === 'string' && authParam.includes('"private_key"'))) {
    try {
      const creds = typeof authParam === 'string' ? JSON.parse(authParam) : authParam;
      const jwtClient = new google.auth.JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
      });
      return google.sheets({ version: 'v4', auth: jwtClient });
    } catch (e) {
      console.warn('Service Account JSON parse hatası, standart OAuth deneniyor:', e);
    }
  }

  const token = typeof authParam === 'string' ? authParam : '';
  const authClient = new google.auth.OAuth2();
  authClient.setCredentials({ access_token: token });
  return google.sheets({ version: 'v4', auth: authClient });
}

/**
 * Belirli bir sayfa adının (örn. 'OkulRisk') e-tabloda var olduğundan emin olur, yoksa oluşturur.
 */
export async function ensureSheetExists(accessToken: string | object, spreadsheetId: string, sheetTitle: string, headers?: string[]) {
  try {
    const sheets = getSheetsClient(accessToken);

    const metadata = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = metadata.data.sheets?.some(s => s.properties?.title === sheetTitle);

    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetTitle,
                },
              },
            },
          ],
        },
      });
    }

    if (headers && headers.length > 0) {
      // Başlık satırı A1'de var mı kontrol et
      const firstRow = await readFromSheet(accessToken, spreadsheetId, `${sheetTitle}!A1:H1`).catch(() => []);
      if (!firstRow || firstRow.length === 0 || firstRow[0]?.[0] !== headers[0]) {
        await updateSheetRange(accessToken, spreadsheetId, `${sheetTitle}!A1:H1`, [headers]);
      }
    }
  } catch (error) {
    console.warn(`Sayfa kontrol/oluşturma hatası (${sheetTitle}):`, error);
  }
}

/**
 * Belirli bir E-Tabloya satır(lar) ekler.
 */
export async function appendToSheet(accessToken: string | object, spreadsheetId: string, range: string, values: any[][]) {
  try {
    const sheets = getSheetsClient(accessToken);

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Google Sheets API append hatası:', error);
    throw error;
  }
}

/**
 * Belirli bir E-Tablodan veri okur.
 */
export async function readFromSheet(accessToken: string | object, spreadsheetId: string, range: string) {
  try {
    const sheets = getSheetsClient(accessToken);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return response.data.values || [];
  } catch (error) {
    console.error('Google Sheets API get hatası:', error);
    throw error;
  }
}

/**
 * Belirli bir aralığı temizler ve yeni değerleri yazar (Güncelleme işlemi için).
 */
export async function updateSheetRange(accessToken: string | object, spreadsheetId: string, range: string, values: any[][]) {
  try {
    const sheets = getSheetsClient(accessToken);

    // Önce o aralıktaki veriyi temizle
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });

    // Yeni verileri yaz
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Google Sheets API update hatası:', error);
    throw error;
  }
}

/**
 * Belirli bir aralığı temizler.
 */
export async function clearSheetRange(accessToken: string | object, spreadsheetId: string, range: string) {
  try {
    const sheets = getSheetsClient(accessToken);
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });
  } catch (error) {
    console.warn('Google Sheets API clear hatası:', error);
  }
}
