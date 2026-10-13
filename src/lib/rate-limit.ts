import { NextRequest, NextResponse } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory rate limiting tablosu
const ipRequests = new Map<string, RateLimitRecord>();

/**
 * Belirli bir IP veya kimlik için istek sınırlandırması uygular.
 * @param req NextRequest
 * @param limit İzin verilen maksimum istek sayısı
 * @param windowMs Zaman penceresi (milisaniye cinsinden, örn. 60000 = 1 dakika)
 * @returns { success: boolean, retryAfter?: number, current: number, limit: number }
 */
export function checkRateLimit(req: NextRequest, limit: number = 30, windowMs: number = 60 * 1000) {
  // İstemci IP adresini güvenli şekilde al
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : realIp || 'unknown-ip';

  const now = Date.now();
  const record = ipRequests.get(ip);

  // Eski zaman penceresi temizliği
  if (!record || now > record.resetAt) {
    ipRequests.set(ip, {
      count: 1,
      resetAt: now + windowMs
    });
    return { success: true, count: 1, limit };
  }

  // İstek sayısını artır
  record.count += 1;

  if (record.count > limit) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return {
      success: false,
      retryAfter,
      count: record.count,
      limit
    };
  }

  return { success: true, count: record.count, limit };
}

/**
 * 429 Too Many Requests yanıtı üretir.
 */
export function rateLimitResponse(retryAfter: number = 60) {
  return NextResponse.json(
    {
      error: 'Çok fazla istek gönderildi. Lütfen bir süre sonra tekrar deneyiniz.',
      retryAfter
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter)
      }
    }
  );
}
