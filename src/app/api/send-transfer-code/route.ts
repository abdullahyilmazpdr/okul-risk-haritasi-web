import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    // 1 dakikada en fazla 3 kod gönderme isteği
    const rateCheck = checkRateLimit(req, 3, 60 * 1000);
    if (!rateCheck.success) {
      return rateLimitResponse(rateCheck.retryAfter);
    }

    const { schoolKey, schoolName, targetEmail, code } = await req.json();

    if (!schoolKey || !targetEmail || !code) {
      return NextResponse.json({ error: 'Eksik parametre.' }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey) {
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Okul Risk Sistemi <onboarding@resend.dev>',
            to: [targetEmail],
            subject: `[${schoolKey}] Okul Yetkisi Devir Onay Kodu: ${code}`,
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                <h2 style="color: #1e293b; margin-bottom: 8px;">Okul Risk Haritası ve ŞÖK Sistemi</h2>
                <p style="color: #64748b; font-size: 14px;"><strong>${schoolName || schoolKey}</strong> için yönetim yetkisi devir talebinde bulunuldu.</p>
                <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2563eb;">${code}</span>
                </div>
                <p style="color: #64748b; font-size: 13px;">Bu onay kodu <strong>15 dakika</strong> boyunca geçerlidir.</p>
                <p style="color: #ef4444; font-size: 12px; margin-top: 16px;">* Eğer bu talebi okulunuzun yetkili personeli yapmadıysa lütfen bu e-postayı dikkate almayınız.</p>
              </div>
            `
          })
        });

        if (!emailRes.ok) {
          const errData = await emailRes.json().catch(() => ({}));
          console.warn('Resend API hatası:', errData);
        }
      } catch (err) {
        console.warn('E-posta gönderim istisnası:', err);
      }
    } else {
      // API Key henüz tanımlanmamışsa terminale log düş (Geliştirme / Test ortamı için)
      console.log(`=======================================================`);
      console.log(`[MEB EMAIL SIMULATOR]`);
      console.log(`Kime: ${targetEmail}`);
      console.log(`Okul: ${schoolKey} - ${schoolName}`);
      console.log(`Devir Kodu: ${code} (15 Dk geçerli)`);
      console.log(`=======================================================`);
    }

    return NextResponse.json({
      success: true,
      message: `${targetEmail} adresine 6 haneli onay kodu gönderildi.`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'E-posta gönderilemedi.' }, { status: 500 });
  }
}
