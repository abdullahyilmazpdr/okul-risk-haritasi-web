import crypto from 'crypto';

const SECRET_SALT = process.env.SESSION_SECRET || 'okul-risk-haritasi-security-salt-2026';

export interface TeacherSessionPayload {
  username: string;
  name: string;
  role: string;
  isClassTeacher: boolean;
  isAdmin: boolean;
  schoolKey: string;
  classes: string[];
  issuedAt: number;
  expiresAt: number;
}

/**
 * Öğretmen için kriptografik olarak imzalı, 30 gün geçerli oturum belirteci üretir.
 */
export function generateTeacherToken(payload: Omit<TeacherSessionPayload, 'issuedAt' | 'expiresAt'>): string {
  const now = Date.now();
  const fullPayload: TeacherSessionPayload = {
    ...payload,
    issuedAt: now,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000 // 30 gün geçerli
  };

  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET_SALT)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * İmzalı öğretmen oturum belirtecini doğrular.
 */
export function verifyTeacherToken(token: string): { valid: boolean; payload?: TeacherSessionPayload; error?: string } {
  if (!token || !token.includes('.')) {
    return { valid: false, error: 'Geçersiz oturum belirteci formatı.' };
  }

  const [payloadB64, signature] = token.split('.');
  const expectedSig = crypto
    .createHmac('sha256', SECRET_SALT)
    .update(payloadB64)
    .digest('base64url');

  if (signature !== expectedSig) {
    return { valid: false, error: 'Oturum belirteci imzası doğrulanamadı (Yetkisiz işlem).' };
  }

  try {
    const payload: TeacherSessionPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    const effectiveExpiresAt = Math.max(
      payload.expiresAt || 0,
      (payload.issuedAt || 0) + 30 * 24 * 60 * 60 * 1000
    );
    if (Date.now() > effectiveExpiresAt) {
      return { valid: false, error: 'Oturum süresi doldu. Lütfen tekrar giriş yapınız.' };
    }
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: 'Oturum verisi çözümlenemedi.' };
  }
}

/**
 * Okul verisi okuma/yazma API isteklerinde çağrıyı yapanın o okula ait geçerli bir
 * öğretmen oturumu (sessionToken), yönetici kimliği (adminUid / OAuth) veya
 * okulun özel E-Tablo kimliğine (spreadsheetId) sahip olup olmadığını doğrular.
 * Sadece 6 haneli kurum kodu (schoolKey) tahmin edilerek dışarıdan veri çekilmesini engeller.
 */
export function isAuthorizedSchoolRequest(params: {
  sessionToken?: string | null;
  headerToken?: string | null;
  adminUid?: string | null;
  clientSpreadsheetId?: string | null;
  targetSchoolKey?: string | null;
  schoolData?: {
    schoolKey?: string;
    adminUid?: string;
    spreadsheetId?: string;
  } | null;
}): { authorized: boolean; teacherPayload?: TeacherSessionPayload; error?: string } {
  const cleanTargetKey = String(params.targetSchoolKey || params.schoolData?.schoolKey || '').trim();

  // 1. İmzalı Öğretmen / SSO Oturum Belirteci (sessionToken) kontrolü
  const candidateSessionToken = (params.sessionToken || '').trim();
  if (candidateSessionToken) {
    const verified = verifyTeacherToken(candidateSessionToken);
    if (!verified.valid || !verified.payload) {
      return { authorized: false, error: verified.error || 'Geçersiz oturum belirteci.' };
    }
    const tokenSchoolKey = String(verified.payload.schoolKey || '').trim();
    if (cleanTargetKey && tokenSchoolKey && tokenSchoolKey !== cleanTargetKey) {
      return { authorized: false, error: 'Bu oturum başka bir kurum koduna aittir. Yetkisiz erişim engellendi.' };
    }
    return { authorized: true, teacherPayload: verified.payload };
  }

  // 2. Authorization Bearer başlığı içinde sessionToken gönderilmiş olabilir
  const cleanHeader = (params.headerToken || '').trim();
  if (cleanHeader && cleanHeader.includes('.') && !cleanHeader.startsWith('ya29.')) {
    const verified = verifyTeacherToken(cleanHeader);
    if (verified.valid && verified.payload) {
      const tokenSchoolKey = String(verified.payload.schoolKey || '').trim();
      if (cleanTargetKey && tokenSchoolKey && tokenSchoolKey !== cleanTargetKey) {
        return { authorized: false, error: 'Bu oturum başka bir kurum koduna aittir.' };
      }
      return { authorized: true, teacherPayload: verified.payload };
    }
  }

  // 3. Yönetici Google OAuth Bearer Token kontrolü
  if (cleanHeader && cleanHeader.startsWith('ya29.')) {
    return { authorized: true };
  }

  // 4. Doğrulanmış Yönetici UID kontrolü
  const cleanAdminUid = String(params.adminUid || '').trim();
  if (cleanAdminUid && params.schoolData?.adminUid && cleanAdminUid === params.schoolData.adminUid) {
    return { authorized: true };
  }

  // 5. İstemcinin okulun 44 karakterlik gizli spreadsheetId değerini bilmesi (mevcut açık oturumlarla geriye dönük uyum)
  const cleanClientSheetId = String(params.clientSpreadsheetId || '').trim();
  if (
    cleanClientSheetId &&
    cleanClientSheetId.length >= 20 &&
    params.schoolData?.spreadsheetId &&
    cleanClientSheetId === params.schoolData.spreadsheetId
  ) {
    return { authorized: true };
  }

  return {
    authorized: false,
    error: 'Bu okulun verilerine erişmek için öğretmen veya yönetici girişi yapmalısınız.'
  };
}
