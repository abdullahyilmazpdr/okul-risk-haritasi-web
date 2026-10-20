import { MEB_OFFICIAL_RISK_ITEMS } from './meb-risk-items';

export interface AssistantFAQ {
  keywords: string[];
  title: string;
  category: 'sistem' | 'rehberlik' | 'sok' | 'mevzuat';
  summary: string;
  answer: string;
  quickActions?: { label: string; prompt: string }[];
}

export const SYSTEM_FAQS: AssistantFAQ[] = [
  {
    category: 'sistem',
    keywords: ['e-okul', 'ogrenci listesi', 'sube listesi', 'pdf', 'nereden', 'nasil indirilir'],
    title: 'E-Okul\'dan Öğrenci Listesi Nasıl İndirilir?',
    summary: 'E-Okul Şube Listesi (Öğrenci No Sıralı) raporunu PDF olarak alma adımları.',
    answer: `**E-Okul Öğrenci Listesi PDF İndirme Adımları:**
1. **E-Okul** sistemine okul/kurum yetkisiyle giriş yapın.
2. Sol menüden **Öğrenci İşlemleri** modülüne tıklayın.
3. Sağ üst köşedeki **Yazıcı (Raporlar)** simgesine basın.
4. Açılan rapor penceresinden **Şube Listesi (Öğrenci No Sıralı)** raporunu seçin.
5. Rapor açıldığında sol üstteki disket/kaydet simgesinden **PDF** formatında bilgisayarınıza kaydedin.
6. Bu PDF dosyasını sistemimizdeki **Veri Yükleme** ekranına sürükleyip bırakın.`,
    quickActions: [
      { label: 'Ders Programı PDF Nereden Alınır?', prompt: 'Ders programı PDF dosyasını e-okuldan nasıl alırım?' },
      { label: 'E-Tablo Nasıl Oluşturulur?', prompt: 'Google E-Tablo nasıl oluşturulur ve bağlanır?' }
    ]
  },
  {
    category: 'sistem',
    keywords: ['ders programi', 'ogretmen ders programi', 'brans', 'haftalik', 'e-okul'],
    title: 'E-Okul\'dan Öğretmen Ders Programı Nasıl İndirilir?',
    summary: 'Öğretmenlerin sorumlu oldukları sınıfları içeren haftalık ders programı PDF raporu.',
    answer: `**E-Okul Öğretmen Ders Programı PDF İndirme Adımları:**
1. **E-Okul** yönetim paneline giriş yapın.
2. **Kurum İşlemleri** > **Ders İşlemleri** > **Ders Öğretmenleri** yolunu izleyin.
3. Sağ üstteki **Yazıcı (Raporlar)** simgesine tıklayın.
4. **Öğretmen Ders Programları** raporunu açın.
5. Raporu **PDF** formatında kaydedin.
6. Bu dosyayı **Veri Yükleme** ekranında "Öğretmen Ders Programı (PDF)" alanına yükleyin.
*Not: Bu sayede branş öğretmenleri ve sorumlu oldukları tüm sınıflar otomatik eşleşir.*`,
    quickActions: [
      { label: 'Öğrenci Listesi PDF Nereden Alınır?', prompt: 'E-okuldan öğrenci listesini nasıl indiririm?' }
    ]
  },
  {
    category: 'sistem',
    keywords: ['karekod', 'qr', 'giris', 'sifre', 'yazdir', 'kart', 'meb interneti'],
    title: 'Karekodlu Giriş Kartları ve MEB İnterneti Çözümü',
    summary: 'Öğretmenlerin şifresiz/hızlı girişi ve MEB güvenlik duvarı çözümü.',
    answer: `**Karekodlu Giriş ve MEB İnterneti Çözümü:**
- **MEB İnternetinde WhatsApp Sorunu:** Okul internetinde (Fatih ağı) WhatsApp portları engellidir. Bu nedenle sistemimiz iki pratik alternatif sunar:
  1. **Karekod Kartları (Yazdır):** Yönetici panelinden *Karekod Kartları (Yazdır)* butonuna basarak her öğretmene özel karekodlu kimlik fişlerini A4 kağıdına yazdırabilirsiniz.
  2. **Excel İndir:** İdareci Excel listesini indirip kişisel telefonundaki WhatsApp grubundan öğretmenlere gönderebilir.
- **Karekodun Güvenliği:** Karekod içine **şifre gömülmez** (KVKK güvenliği için). Öğretmen telefonuyla karekodu okuttuğunda okul otomatik seçilir, kullanıcı adı doldurulur ve öğretmen sadece karttaki şifresini tuşlayarak anında giriş yapar.`,
    quickActions: [
      { label: 'Öğretmen Şifresi Sıfırlama', prompt: 'Öğretmen şifrelerini nasıl değiştirebilirim?' }
    ]
  },
  {
    category: 'sistem',
    keywords: ['e-tablo', 'google drive', 'yetki', 'spreadsheet', 'baglanti', 'kayit'],
    title: 'Google E-Tablo Oluşturma ve Veri Güvenliği',
    summary: 'Verilerinizin yalnızca okulunuzun Google Drive hesabında saklanma prensibi.',
    answer: `**Google E-Tablo Mimarisi & KVKK:**
- Sistemimiz tüm öğrenci ve risk verilerini **yalnızca okul yöneticisinin kendi Google Drive hesabındaki E-Tablo'da** saklar.
- Sunucularımızda veya üçüncü taraf veritabanlarında öğrenci kimlik ya da risk verisi tutulmaz (%100 KVKK uyumlu).
- **Kurulum:** Yönetici paneline ilk girişte *Google ile Giriş Yap* butonuna basıp Google Drive izinlerini onaylamanız ve *E-Tablo Oluştur* demeniz yeterlidir.`,
    quickActions: [
      { label: 'Karekod Kartları Nasıl Alınır?', prompt: 'Karekod kartları nasıl yazdırılır?' }
    ]
  },
  {
    category: 'rehberlik',
    keywords: ['parcalanmis aile', 'bosanmis', 'ayri', 'anne baba vefati', 'yetim', 'oksuz'],
    title: 'Parçalanmış Aile veya Ebeveyn Kaybı Olan Öğrenciye Yaklaşım',
    summary: 'Duygusal hassasiyeti olan öğrencilere yönelik pedagojik yaklaşımlar.',
    answer: `**Pedagojik Öneriler:**
1. **Etiketlemekten Kaçının:** Sınıf içinde veya diğer velilerin yanında öğrencinin durumunu asla konu etmeyin ("anne-babası ayrı" vb. ifadeler kullanmayın).
2. **Özel Günlerde Hassasiyet:** Anneler Günü, Babalar Günü gibi etkinliklerde öğrenciyi zorlamayın; alternatif olarak "sevdiğin bir büyüğün" temasını işleyin.
3. **İletişim Kurulacak Veli Tespiti:** Velayet sahibini resmi kayıtlardan netleştirin; okul bilgilendirmelerini doğru ebeveyne ulaştırın.
4. **Davranış Değişiklikleri:** Ani hırçınlık, içe kapanma veya akademik düşüş görülürse rehberlik servisine yönlendirin.`,
    quickActions: [
      { label: 'ŞÖK Görüşü Örneği', prompt: 'Parçalanmış aile çocuğu için ŞÖK tutanağına ne yazılabilir?' }
    ]
  },
  {
    category: 'rehberlik',
    keywords: ['akran zorbaligi', 'zorbalik', 'saldirgan', 'itilip kakilma', 'magdur', 'zorba'],
    title: 'Akran Zorbalığı (Mağdur ve Zorba Öğrenci) Müdahale Kılavuzu',
    summary: 'Sınıfta zorbalık tespiti, mağdurun güçlendirilmesi ve zorbaya yaklaşım.',
    answer: `**Akran Zorbalığı Müdahale Adımları:**
1. **Olayı Normalleştirmeyin:** "Çocuklar arasında olur böyle şeyler" yaklaşımı mağduru yalnızlaştırır.
2. **Mağdur Öğrenci İçin:**
   - Onu dinleyin ve "Bu senin suçun değil, yardım istemekle en doğrusunu yaptın" mesajı verin.
   - Sınıfta gözlem altında tutun, güvenli akran gruplarıyla eşleştirin.
3. **Zorbalık Yapan Öğrenci İçin:**
   - Seyircilerin önünde değil, bire bir sakin bir ortamda görüşün.
   - Davranışının sonuçlarını ve mağdur üzerindeki etkisini somutlaştırın.
   - Öfke kontrolü ve empati çalışması için rehberlik servisine yönlendirin.
4. **Velilerle Görüşme:** İki tarafın velisini asla aynı anda yüz yüze getirmeyin; ayrı ayrı resmi bilgilendirme yapın.`,
    quickActions: [
      { label: 'ŞÖK Akran Zorbalığı Kararı', prompt: 'Akran zorbalığı için ŞÖK toplantı kararı örneği verir misin?' }
    ]
  },
  {
    category: 'rehberlik',
    keywords: ['bep', 'kaynastirma', 'ozel egitim', 'ram', 'disleksi', 'ogrenme guclugu'],
    title: 'Özel Eğitim, BEP ve RAM Yönlendirme Süreci',
    summary: 'Bireyselleştirilmiş Eğitim Programı (BEP) hazırlama ve RAM başvuru süreci.',
    answer: `**BEP ve Özel Eğitim Adımları:**
1. **BEP Zorunluluğu:** RAM tarafından "Kaynaştırma/Bütünleştirme" kararı verilen her öğrenci için okulda **BEP Birimi** toplanmalı ve her ders için BEP planı hazırlanmalıdır.
2. **Sınav Uyarlamaları:** BEP'li öğrenciler kendi hedeflerine göre hazırlanan sınavlara girer. Çoktan seçmeli yerine kısa cevaplı, süre uzatımlı veya ayrı salonda sınav uygulanabilir.
3. **RAM Yönlendirme:** İlk kez inceleme isteniyorsa veya rapor yenilenecekse:
   - Sınıf öğretmeni en az 1-2 ay gözlem yapıp destekleyici çalışma yürütür.
   - *Eğitsel Değerlendirme İsteği Formu* okul idaresi ve rehberlik servisi tarafından doldurularak resmi yazıyla RAM'a gönderilir.`,
    quickActions: [
      { label: 'BEP Öğrencisi İçin ŞÖK Görüşü', prompt: 'Kaynaştırma öğrencisi için ŞÖK görüşü ne yazılabilir?' }
    ]
  },
  {
    category: 'rehberlik',
    keywords: ['devamsizlik', 'okula gelmeme', 'okul terk', 'devamsiz'],
    title: 'Sürekli Devamsızlık ve Okul Terki Riski Olan Öğrenci',
    summary: 'Devamsızlık mektubu, veli ziyareti ve rehberlik tedbirleri.',
    answer: `**Devamsızlık Önleme Süreci:**
1. **Erken Tespit:** Devamsızlık 5 günü aştığında sınıf rehber öğretmeni veliyi telefonla arayarak nedenini öğrenir.
2. **Resmi Uyarı:** Devamsızlık mektupları (özellikle 7 ve 10 gün sınırlarında) idarece tebliğ edilir.
3. **Nedenlerin Analizi:** Devamsızlık nedeni akran zorbalığı mı, akademik başarısızlık mı, çalışmak zorunda kalma mı yoksa aile ilgisizliği mi?
4. **Gerektiğinde Ev Ziyareti:** Rehber öğretmen ve sınıf öğretmeni koordinesinde ev ziyareti gerçekleştirilerek veli ikna edilmelidir.`,
    quickActions: [
      { label: 'Devamsız Öğrenci ŞÖK Maddesi', prompt: 'Devamsız öğrenci için ŞÖK karar metni önerir misin?' }
    ]
  },
  {
    category: 'sok',
    keywords: ['sok', 'gorus', 'ornek', 'karar', 'tutanak', 'akademik basarisizlik', 'bep'],
    title: 'ŞÖK İçin Resmi ve Yapıcı Görüş Yazma Kılavuzu',
    summary: 'ŞÖK toplantı tutanaklarında kullanılabilecek yapıcı MEB karar şablonları.',
    answer: `**ŞÖK Karar ve Görüş Örnekleri:**
- **Akademik Başarısızlık İçin:**
  *"Ders içi katılımının artırılması, temel konu eksiklikleri için Destekleme ve Yetiştirme Kurslarına (DYK) yönlendirilmesi ve velisiyle iş birliği yapılarak haftalık çalışma planı hazırlanmasına karar verilmiştir."*
- **Devamsızlık İçin:**
  *"Öğrencinin devamsızlık nedenlerinin araştırılması, velisine devamsızlık mektubu gönderilerek görüşmeye çağrılması ve rehberlik servisince devam takibinin yapılmasına karar verilmiştir."*
- **Özel Eğitim / BEP İçin:**
  *"Öğrencinin BEP hedefleri doğrultusunda bireysel öğrenme hızına uygun ders materyalleriyle desteklenmesine ve sınavların BEP ilkelerine göre uyarlanmasına karar verilmiştir."*
- **Sosyal Uyum / Davranış İçin:**
  *"Sınıf içi olumlu davranışlarının pekiştirilmesi, öfke ve akran iletişimi konusunda rehberlik servisinden bireysel danışma desteği almasına karar verilmiştir."*`,
    quickActions: [
      { label: '1. Dönem ŞÖK Gündemleri', prompt: '1. Dönem ŞÖK gündem ve karar maddeleri nelerdir?' },
      { label: '2. Dönem ŞÖK Gündemleri', prompt: '2. Dönem ŞÖK gündem ve karar maddeleri nelerdir?' }
    ]
  }
];

/**
 * Kullanıcının sorduğu soruya göre en uygun yerel bilgi bankası yanıtını bulur.
 */
export function findLocalAssistantAnswer(userQuery: string): {
  answer: string;
  title?: string;
  suggestions?: string[];
  matchedCategory?: string;
} {
  const normalized = userQuery.toLowerCase().trim();

  // 1. Önce doğrudan SSS başlıklarında ve anahtar kelimelerde ara
  let bestScore = 0;
  let bestMatch: AssistantFAQ | null = null;

  for (const faq of SYSTEM_FAQS) {
    let score = 0;
    for (const kw of faq.keywords) {
      if (normalized.includes(kw)) {
        score += 2;
      }
    }
    if (normalized.includes(faq.title.toLowerCase())) {
      score += 4;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  }

  if (bestMatch && bestScore >= 2) {
    return {
      title: bestMatch.title,
      answer: bestMatch.answer,
      matchedCategory: bestMatch.category,
      suggestions: bestMatch.quickActions?.map(a => a.prompt) || [
        'ŞÖK görüşü örneği ver',
        'Karekodlu giriş nasıl çalışır?',
        'Öğrenci risk haritası maddeleri'
      ]
    };
  }

  // 2. Risk haritası maddesi soruluyorsa
  for (const item of MEB_OFFICIAL_RISK_ITEMS) {
    if (normalized.includes(item.toLowerCase())) {
      return {
        title: `MEB Risk Maddesi: ${item}`,
        answer: `**"${item}" Durumundaki Öğrenci İçin Rehberlik Yaklaşımı:**\n\n` +
          `1. **Gözlem ve Tespit:** Öğrencinin bu risk faktöründen dolayı derse katılımı, devamsızlığı veya akran ilişkilerinde gözlemlenen değişimleri not alın.\n` +
          `2. **Sınıf İçi Tedbirler:** Öğrenciyi etiketlemeden, özgüvenini destekleyecek sorumluluklar verin. Başarı duygusunu tatmasını sağlayın.\n` +
          `3. **Veli İletişimi:** Veli ile yargılayıcı olmayan, çocuğun yüksek yararını gözeten yapıcı bir dille görüşme gerçekleştirin.\n` +
          `4. **PDR Servisi İş Birliği:** Gerekli hallerde Rehberlik Servisi ile koordineli olarak bireysel psikolojik danışma veya RAM yönlendirmesi planlayın.`,
        suggestions: [
          `"${item}" için ŞÖK görüş metni yaz`,
          'Veli görüşmesinde nelere dikkat edilmeli?',
          'Risk haritası resmi excel listesi'
        ]
      };
    }
  }

  // 3. Genel ŞÖK sorusu
  if (normalized.includes('şök') || normalized.includes('sok') || normalized.includes('görüş') || normalized.includes('gorus')) {
    return {
      title: 'ŞÖK Görüş ve Karar Rehberi',
      answer: `**ŞÖK (Şube Öğretmenler Kurulu) Toplantılarında Dikkat Edilecek İlkeler:**\n\n` +
        `• **Yapıcı Dil:** Öğrencinin sadece olumsuz yönlerini değil, gelişime açık yönlerini ve ilgi alanlarını vurgulayın.\n` +
        `• **Somut Eylem Planı:** "Ders çalışsın" yerine "DYK kurslarına katılımı sağlansın, haftalık ders takip çizelgesi verilsin" gibi somut kararlar alın.\n` +
        `• **İş Birliği:** Veli, ders öğretmenleri ve rehberlik servisinin ortak sorumlulukları tutanağa işlenmelidir.\n` +
        `• **Resmi Çıktı:** Sistemimiz üzerinden girdiğiniz tüm görüşler, ŞÖK Yönetim Modülü'nde resmi A4 formatında hazır tutanak olarak tek tıkla yazdırılabilir.`,
      suggestions: [
        'Akademik başarısızlık için ŞÖK kararı örneği',
        'Devamsız öğrenci için ŞÖK kararı örneği',
        'Özel eğitim öğrencisi için ŞÖK kararı'
      ]
    };
  }

  // 4. Varsayılan Dostane Rehberlik Cevabı
  return {
    title: 'PDRON - MEB Rehberlik & ŞÖK Asistanı',
    answer: `Merhabalar, ben **PDRON**! Size hem **MEB Rehberlik & ŞÖK pedagojik süreçlerinde**, hem de **Okul Risk Haritası sisteminin kullanımında** yardımcı olmak için 7/24 aktifim.\n\n` +
      `Bana dilediğiniz zaman şunları sorabilirsiniz:\n` +
      `• *"[Risk durumu] olan öğrenci için sınıfta ne yapabilirim?"*\n` +
      `• *"ŞÖK toplantısı için yapıcı bir görüş metni yazar mısın?"*\n` +
      `• *"E-Okul'dan öğrenci listesi veya ders programı PDF'i nasıl indirilir?"*\n` +
      `• *"Öğretmenlere karekodlu giriş kartları nasıl yazdırılır?"*\n` +
      `• *"RAM veya BEP süreci nasıl işletilir?"*`,
    suggestions: [
      'ŞÖK için örnek görüşler',
      'Akran zorbalığı durumunda ne yapılmalı?',
      'E-Okul PDF yükleme adımları',
      'Karekodlu giriş kartları'
    ]
  };
}
