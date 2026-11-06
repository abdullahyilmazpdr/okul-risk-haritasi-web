import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const sharedSpreadsheetsCache = new Set<string>();
const expiredOAuthTokensCache = new Set<string>();
const verifiedSheetTabsCache = new Set<string>();

let cachedSysCreds: { client_email: string; private_key: string } | null | undefined = undefined;
let cachedSysSheetsClient: ReturnType<typeof google.sheets> | null = null;

/**
 * Vercel / ortam değişkeninde (veya yerel geliştirme ortamında) tanımlı
 * sistem Service Account bilgisini döndürür ve bellekte önbelleğe alır.
 */
export function getSystemServiceAccountCreds(): { client_email: string; private_key: string } | null {
  if (cachedSysCreds !== undefined) {
    return cachedSysCreds;
  }

  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';

  // Yerel geliştirme ortamında .env.local içinde yoksa üst dizindeki JSON dosyasını kontrol et
  if (!raw) {
    try {
      const localPath = path.resolve(process.cwd(), '../okul-risk-haritasi-etablo-firebase-adminsdk-fbsvc-9b3804341a.json');
      if (fs.existsSync(localPath)) {
        raw = fs.readFileSync(localPath, 'utf8');
      }
    } catch (e) {}
  }

  if (!raw) {
    cachedSysCreds = null;
    return null;
  }

  try {
    const trimmed = raw.trim().replace(/^['"]|['"]$/g, '');
    const parsed = JSON.parse(trimmed);
    if (parsed && parsed.client_email && parsed.private_key) {
      cachedSysCreds = {
        client_email: parsed.client_email,
        private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
      };
      return cachedSysCreds;
    }
  } catch (e) {
    console.warn('GOOGLE_SERVICE_ACCOUNT_KEY JSON parse hatası:', e);
  }

  cachedSysCreds = null;
  return null;
}

/**
 * Sistem Service Account için tekil (singleton) Google Sheets istemcisi döndürür.
 * Böylece her istekte yeniden JWT token alma maliyeti oluşmaz.
 */
function getSystemSheetsClient(): ReturnType<typeof google.sheets> | null {
  if (cachedSysSheetsClient) {
    return cachedSysSheetsClient;
  }
  const sysCreds = getSystemServiceAccountCreds();
  if (!sysCreds) return null;

  const jwtClient = new google.auth.JWT({
    email: sysCreds.client_email,
    key: sysCreds.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ]
  });
  cachedSysSheetsClient = google.sheets({ version: 'v4', auth: jwtClient });
  return cachedSysSheetsClient;
}

/**
 * Yönetici kendi Google token'ı ile işlem yaparken, E-Tablo'ya sistem servis hesabını
 * sessizce "Düzenleyen (writer)" olarak ekler. Böylece 60 dk sonra yönetici token'ı
 * dolsa bile öğretmenler 7/24 kesintisiz giriş yapıp veri kaydedebilir.
 */
export async function ensureServiceAccountShared(userAccessToken: string | object, spreadsheetId: string) {
  if (
    !spreadsheetId ||
    typeof userAccessToken !== 'string' ||
    !userAccessToken ||
    userAccessToken.includes('"private_key"') ||
    expiredOAuthTokensCache.has(userAccessToken)
  ) {
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
  } catch (e: any) {
    // Token süresi dolmuşsa bu token'ı kara listeye al ki tekrar tekrar denenmesin
    const msg = String(e?.message || '').toLowerCase();
    if (msg.includes('invalid credentials') || msg.includes('unauthenticated') || e?.code === 401 || e?.status === 401) {
      if (expiredOAuthTokensCache.size > 500) expiredOAuthTokensCache.clear();
      expiredOAuthTokensCache.add(userAccessToken);
    }
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
      const sysCreds = getSystemServiceAccountCreds();
      if (sysCreds && creds.client_email === sysCreds.client_email) {
        const sysClient = getSystemSheetsClient();
        if (sysClient) return sysClient;
      }
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
    const sysClient = getSystemSheetsClient();
    if (sysClient) return sysClient;
  }

  const token = typeof authParam === 'string' ? authParam : '';
  const authClient = new google.auth.OAuth2();
  authClient.setCredentials({ access_token: token });
  return google.sheets({ version: 'v4', auth: authClient });
}

function isTransientQuotaOrNetworkError(err: any): boolean {
  const code = Number(err?.code || err?.status || err?.response?.status || 0);
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 429 ||
    code === 500 ||
    code === 502 ||
    code === 503 ||
    code === 504 ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('ratelimit') ||
    msg.includes('too many requests') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up') ||
    msg.includes('etimedout')
  );
}

function isPermissionDeniedError(err: any): boolean {
  const code = Number(err?.code || err?.status || err?.response?.status || 0);
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 403 ||
    code === 404 ||
    msg.includes('caller does not have permission') ||
    msg.includes('insufficient permissions') ||
    msg.includes('not found')
  );
}

async function runWithQuotaRetry<T>(operation: () => Promise<T>, maxRetries = 2): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err: any) {
      if (attempt < maxRetries && isTransientQuotaOrNetworkError(err)) {
        attempt++;
        const delayMs = attempt * 1500 + Math.floor(Math.random() * 500);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
}

/**
 * ÖNCELİK 1: Süresi asla dolmayan Sistem Service Account (GOOGLE_SERVICE_ACCOUNT_KEY) ile doğrudan işlem yapar.
 * Böylece yöneticinin 60 dakikalık OAuth token'ı dolmuş olsa bile öğretmenler 7/24 sıfır gecikmeyle kayıt yapar.
 * ÖNCELİK 2: Eğer yeni oluşturulmuş bir E-Tablo henüz Service Account ile paylaşılmamışsa ve geçerli bir yönetici
 * OAuth token'ı varsa, tabloyu Service Account ile paylaşıp işlemi tamamlar.
 */
async function withSheetsFallback<T>(
  accessToken: string | object,
  spreadsheetId: string,
  fn: (sheets: ReturnType<typeof getSheetsClient>) => Promise<T>
): Promise<T> {
  const sysClient = getSystemSheetsClient();
  const hasUserOAuthToken =
    typeof accessToken === 'string' &&
    Boolean(accessToken) &&
    !accessToken.includes('"private_key"') &&
    !expiredOAuthTokensCache.has(accessToken);

  // 1. Özel bir okul Service Account JSON'ı verilmişse (sistem SA'dan farklı)
  const isCustomServiceAccount =
    accessToken &&
    (typeof accessToken === 'object' || (typeof accessToken === 'string' && accessToken.includes('"private_key"')));

  if (isCustomServiceAccount) {
    const customClient = getSheetsClient(accessToken);
    return await runWithQuotaRetry(() => fn(customClient));
  }

  // 2. Sistem Service Account mevcutsa HER ZAMAN ÖNCE onu kullan (7/24 kesintisiz, süresi asla dolmaz)
  if (sysClient) {
    try {
      const result = await runWithQuotaRetry(() => fn(sysClient));
      sharedSpreadsheetsCache.add(spreadsheetId);
      return result;
    } catch (sysErr: any) {
      // Eğer hata yalnızca yeni bir tablonun henüz Service Account ile paylaşılmamış olmasından kaynaklanıyorsa
      // ve elimizde geçerli bir yönetici OAuth token'ı varsa paylaşımı yapıp tekrar dene:
      if (hasUserOAuthToken && isPermissionDeniedError(sysErr)) {
        await ensureServiceAccountShared(accessToken, spreadsheetId).catch(() => {});
        try {
          const userClient = getSheetsClient(accessToken);
          return await runWithQuotaRetry(() => fn(userClient));
        } catch (userErr: any) {
          const uMsg = String(userErr?.message || '').toLowerCase();
          if (uMsg.includes('invalid credentials') || uMsg.includes('unauthenticated') || userErr?.code === 401) {
            expiredOAuthTokensCache.add(accessToken as string);
          }
          // Asıl hatayı (Service Account'un erişim hatasını) fırlat
          throw sysErr;
        }
      }
      // Kota (429) veya diğer hatalarda yanıltıcı 401 fırlatmak yerine gerçek hatayı fırlat
      throw sysErr;
    }
  }

  // 3. Sistem Service Account hiç tanımlı değilse standart OAuth token ile çalıştır
  const primaryClient = getSheetsClient(accessToken);
  return await runWithQuotaRetry(() => fn(primaryClient));
}

/**
 * Belirli bir sayfa adının (örn. 'OkulRisk') e-tabloda var olduğundan emin olur, yoksa oluşturur.
 * Bellek içi önbellek sayesinde aynı sunucu örneğinde her kayıtta tekrar tekrar API çağrısı yapmaz.
 */
export async function ensureSheetExists(accessToken: string | object, spreadsheetId: string, sheetTitle: string, headers?: string[]) {
  const cacheKey = `${spreadsheetId}:${sheetTitle}`;
  if (verifiedSheetTabsCache.has(cacheKey)) {
    return;
  }

  try {
    await withSheetsFallback(accessToken, spreadsheetId, async (sheets) => {
      const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
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
        await writeSheetRange(accessToken, spreadsheetId, `${sheetTitle}!A1`, [headers]);
      }
    }

    if (verifiedSheetTabsCache.size > 5000) verifiedSheetTabsCache.clear();
    verifiedSheetTabsCache.add(cacheKey);
  } catch (error) {
    console.warn(`Sayfa kontrol/oluşturma hatası (${sheetTitle}):`, error);
  }
}

export function markSheetTabVerified(spreadsheetId: string, sheetTitle: string) {
  if (!spreadsheetId || !sheetTitle) return;
  if (verifiedSheetTabsCache.size > 5000) verifiedSheetTabsCache.clear();
  verifiedSheetTabsCache.add(`${spreadsheetId}:${sheetTitle}`);
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
 * Belirli bir aralığa tek adımda (clear yapmadan) doğrudan veri yazar.
 * Kota kullanımını %50 azaltır ve eşzamanlı okumalarda tablonun anlık boş görünmesini engeller.
 */
export async function writeSheetRange(accessToken: string | object, spreadsheetId: string, range: string, values: any[][]) {
  try {
    return await withSheetsFallback(accessToken, spreadsheetId, async (sheets) => {
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
    console.error('Google Sheets API write hatası:', error);
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
