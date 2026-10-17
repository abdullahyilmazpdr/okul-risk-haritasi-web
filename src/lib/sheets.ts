import { google } from 'googleapis';

const sharedSpreadsheetsCache = new Set<string>();

/**
 * Vercel / ortam değişkeninde tanımlı sistem Service Account bilgisini döndürür.
 */
export function getSystemServiceAccountCreds(): { client_email: string; private_key: string } | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.client_email && parsed.private_key) {
      return {
        client_email: parsed.client_email,
        private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
      };
    }
  } catch (e) {
    console.warn('GOOGLE_SERVICE_ACCOUNT_KEY JSON parse hatası:', e);
  }
  return null;
}

/**
 * Yönetici kendi Google token'ı ile işlem yaparken, E-Tablo'ya sistem servis hesabını
 * sessizce "Düzenleyen (writer)" olarak ekler. Böylece 60 dk sonra yönetici token'ı
 * dolsa bile öğretmenler 7/24 kesintisiz giriş yapıp veri kaydedebilir.
 */
export async function ensureServiceAccountShared(userAccessToken: string | object, spreadsheetId: string) {
  if (!spreadsheetId || typeof userAccessToken !== 'string' || userAccessToken.includes('"private_key"')) {
    return;
  }
  const sysCreds = getSystemServiceAccountCreds();
  if (!sysCreds || sharedSpreadsheetsCache.has(spreadsheetId)) {
    return;
  }

  sharedSpreadsheetsCache.add(spreadsheetId);
  try {
    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: userAccessToken });
    const drive = google.drive({ version: 'v3', auth: authClient });

    await drive.permissions.create({
      fileId: spreadsheetId,
      sendNotificationEmail: false,
      requestBody: {
        role: 'writer',
        type: 'user',
        emailAddress: sysCreds.client_email,
      },
    });
  } catch (e) {
    // Token süresi dolmuşsa önbellekten çıkar ki yönetici tekrar girdiğinde paylaşım yapılabilsin
    sharedSpreadsheetsCache.delete(spreadsheetId);
  }
}

/**
 * Hem OAuth2 Access Token hem de Service Account JSON ile Google Sheets istemcisi üretir.
 */
export function getSheetsClient(authParam?: string | object | null) {
  if (authParam && (typeof authParam === 'object' || (typeof authParam === 'string' && authParam.includes('"private_key"')))) {
    try {
      const creds = typeof authParam === 'string' ? JSON.parse(authParam) : (authParam as any);
      const jwtClient = new google.auth.JWT({
        email: creds.client_email,
        key: String(creds.private_key).replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
      });
      return google.sheets({ version: 'v4', auth: jwtClient });
    } catch (e) {
      console.warn('Service Account JSON parse hatası, standart OAuth deneniyor:', e);
    }
  }

  // Eğer authParam boşsa ve sistem servis hesabı varsa doğrudan servis hesabını kullan
  if (!authParam) {
    const sysCreds = getSystemServiceAccountCreds();
    if (sysCreds) {
      const jwtClient = new google.auth.JWT({
        email: sysCreds.client_email,
        key: sysCreds.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
      });
      return google.sheets({ version: 'v4', auth: jwtClient });
    }
  }

  const token = typeof authParam === 'string' ? authParam : '';
  const authClient = new google.auth.OAuth2();
  authClient.setCredentials({ access_token: token });
  return google.sheets({ version: 'v4', auth: authClient });
}

/**
 * Önce verilen token ile dener; eğer 60 dakikalık OAuth token süresi dolmuşsa
 * otomatik olarak sistem Service Account (GOOGLE_SERVICE_ACCOUNT_KEY) ile işlemi tamamlar.
 */
async function withSheetsFallback<T>(
  accessToken: string | object,
  spreadsheetId: string,
  fn: (sheets: ReturnType<typeof getSheetsClient>) => Promise<T>
): Promise<T> {
  // Arka planda servis hesabına yetki tanımlamasını tetikle
  if (typeof accessToken === 'string' && accessToken && !accessToken.includes('"private_key"')) {
    ensureServiceAccountShared(accessToken, spreadsheetId).catch(() => {});
  }

  try {
    const primaryClient = getSheetsClient(accessToken);
    return await fn(primaryClient);
  } catch (primaryErr: any) {
    const sysCreds = getSystemServiceAccountCreds();
    if (sysCreds) {
      try {
        const fallbackClient = getSheetsClient(sysCreds);
        return await fn(fallbackClient);
      } catch (fallbackErr) {
        throw primaryErr;
      }
    }
    throw primaryErr;
  }
}

/**
 * Belirli bir sayfa adının (örn. 'OkulRisk') e-tabloda var olduğundan emin olur, yoksa oluşturur.
 */
export async function ensureSheetExists(accessToken: string | object, spreadsheetId: string, sheetTitle: string, headers?: string[]) {
  try {
    await withSheetsFallback(accessToken, spreadsheetId, async (sheets) => {
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
    });

    if (headers && headers.length > 0) {
      // Başlık satırı A1'de var mı kontrol et
      const firstRow = await readFromSheet(accessToken, spreadsheetId, `${sheetTitle}!A1:AZ1`).catch(() => []);
      if (!firstRow || firstRow.length === 0 || firstRow[0]?.[0] !== headers[0] || firstRow[0]?.length < headers.length) {
        await updateSheetRange(accessToken, spreadsheetId, `${sheetTitle}!A1`, [headers]);
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
    return await withSheetsFallback(accessToken, spreadsheetId, async (sheets) => {
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });
      return response.data;
    });
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
    return await withSheetsFallback(accessToken, spreadsheetId, async (sheets) => {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      return response.data.values || [];
    });
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
    return await withSheetsFallback(accessToken, spreadsheetId, async (sheets) => {
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
    });
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
    await withSheetsFallback(accessToken, spreadsheetId, async (sheets) => {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range,
      });
    });
  } catch (error) {
    console.warn('Google Sheets API clear hatası:', error);
  }
}
