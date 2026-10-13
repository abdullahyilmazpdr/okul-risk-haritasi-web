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
 * Öğretmen için kriptografik olarak imzalı, 4 saat geçerli oturum belirteci üretir.
 */
export function generateTeacherToken(payload: Omit<TeacherSessionPayload, 'issuedAt' | 'expiresAt'>): string {
  const now = Date.now();
  const fullPayload: TeacherSessionPayload = {
    ...payload,
    issuedAt: now,
    expiresAt: now + 4 * 60 * 60 * 1000 // 4 saat geçerli
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
    if (Date.now() > payload.expiresAt) {
      return { valid: false, error: 'Oturum süresi doldu. Lütfen tekrar giriş yapınız.' };
    }
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: 'Oturum verisi çözümlenemedi.' };
  }
}
