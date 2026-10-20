import { NextRequest, NextResponse } from 'next/server';
import { findLocalAssistantAnswer } from '@/lib/assistant-knowledge';

const SYSTEM_INSTRUCTION = `Sen Milli Eğitim Bakanlığı (MEB) mevzuatına, Özel Eğitim ve Rehberlik Hizmetleri Genel Müdürlüğü (ÖRGM) standartlarına hakim akıllı yapay zeka asistanı PDRON'sun.
İsmin; psikolojik sağlamlığı, kurumsallığı ve rehberlik uzmanlığını temsil eden 'PDR' ile daima aktif, çözüm üreten ve açık bir zihni simgeleyen 'ON' kelimelerinin birleşiminden doğmuştur.

GÖREVLERİN:
1. Öğretmenlerin öğrencilere yönelik 36 risk faktörüne (parçalanmış aile, akran zorbalığı, disleksi, DEHB, devamsızlık, madde riski, ekonomik zorluk vb.) karşı sınıfta uygulayabileceği pedagojik yaklaşımlar, veli iletişim teknikleri ve RAM/Rehberlik servisi sevk kriterleri hakkında rehberlik etmek.
2. ŞÖK (Şube Öğretmenler Kurulu) toplantı tutanakları için resmi, yapıcı, somut ve doğrudan tutanağa yapıştırılabilecek kalitede MEB formatında görüş ve kararlar üretmek.
3. Sistemin teknik kullanımı (E-Okul'dan PDF indirme, E-Tablo entegrasyonu, karekodlu öğretmen giriş kartları, WhatsApp engeli çözümü vb.) hakkında adım adım yardımcı olmak.

İLKELERİN:
- Çocuk haklarına, gizlilik ve KVKK ilkelerine tam sadık kal.
- Etiketleyici, cezalandırıcı veya yargılayıcı değil; yapıcı, önleyici, profesyonel ve gelişimsel bir dil kullan.
- Karmaşık resmi evrak, BEP veya raporlama sorularında resmi ciddiyeti koruyan, güven verici ve yetkin bir üslup sergile.
- Cevaplarında net başlıklar ve madde imleri ile kolay okunabilir Markdown formatı kullan.
- ŞÖK görüşü üretirken hem akademik hem davranışsal eylem adımlarını (DYK, bireysel takip, veli iş birliği) somutlaştır.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [], customApiKey } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Lütfen bir mesaj giriniz.' }, { status: 400 });
    }

    const trimmedMessage = message.trim();
    const apiKey = customApiKey?.trim() || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

    // Eğer Gemini API anahtarı tanımlıysa Google Gemini API'ye başvur
    if (apiKey) {
      try {
        const formattedContents = [];

        // Önceki sohbet geçmişini formatla (son 6 mesaj)
        const recentHistory = Array.isArray(history) ? history.slice(-6) : [];
        for (const msg of recentHistory) {
          if (msg && msg.text) {
            formattedContents.push({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.text }]
            });
          }
        }

        // Güncel kullanıcı mesajını ekle
        formattedContents.push({
          role: 'user',
          parts: [{ text: trimmedMessage }]
        });

        // Gemini API çağrısı (önce gemini-2.5-flash dene)
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: formattedContents,
              systemInstruction: {
                parts: [{ text: SYSTEM_INSTRUCTION }]
              },
              generationConfig: {
                temperature: 0.6,
                maxOutputTokens: 1200
              }
            })
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const candidate = geminiData?.candidates?.[0];
          const textReply = candidate?.content?.parts?.[0]?.text;

          if (textReply) {
            return NextResponse.json({
              success: true,
              reply: textReply,
              source: 'ai',
              suggestions: [
                'Bunu ŞÖK tutanağına uygun resmi dille özetle',
                'Sınıfta atılabilecek ilk 3 somut adım nedir?',
                'Veli ile görüşmede nasıl bir yol izlemeliyim?'
              ]
            });
          }
        } else {
          console.warn('Gemini API isteği başarısız oldu, yerel bilgi bankasına geçiliyor. Durum:', geminiRes.status);
        }
      } catch (aiErr) {
        console.warn('Gemini API bağlantı hatası, yerel bilgi bankasına geçiliyor:', aiErr);
      }
    }

    // AI anahtarı yoksa veya çağrı başarısız olduysa kesintisiz Yerel Bilgi Bankasını kullan
    const localResult = findLocalAssistantAnswer(trimmedMessage);
    return NextResponse.json({
      success: true,
      reply: localResult.answer,
      title: localResult.title,
      suggestions: localResult.suggestions,
      source: 'knowledge_base'
    });

  } catch (error: any) {
    console.error('Asistan API genel hatası:', error);
    const fallback = findLocalAssistantAnswer('');
    return NextResponse.json({
      success: true,
      reply: fallback.answer,
      suggestions: fallback.suggestions,
      source: 'knowledge_base'
    });
  }
}
