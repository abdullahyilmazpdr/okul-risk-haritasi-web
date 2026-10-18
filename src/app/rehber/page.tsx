'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  School,
  FileSpreadsheet,
  UploadCloud,
  Printer,
  Share2,
  ArrowLeft,
  CheckCircle2,
  BookOpen,
  Smartphone,
  UserCheck,
  Sparkles,
  FileText,
  HelpCircle,
  KeyRound,
  MousePointerClick,
  ArrowRight,
  Download
} from 'lucide-react';

function RehberContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'teacher' ? 'teacher' : 'admin';
  const [activeTab, setActiveTab] = useState<'admin' | 'teacher' | 'both'>(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'teacher' || tabParam === 'admin' || tabParam === 'both') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleShareWhatsApp = (target: 'admin' | 'teacher') => {
    if (typeof window === 'undefined') return;
    const baseUrl = window.location.origin;
    const text =
      target === 'teacher'
        ? `📘 *Okul Risk Haritası ve ŞÖK Sistemi - Öğretmen Kullanım Rehberi*\n\nDeğerli öğretmenlerimiz, telefon veya bilgisayarınızdan sadece 4 adımda öğrenci Risk Haritası ve ŞÖK görüşlerinizi nasıl gireceğinizi anlatan görsel kılavuza aşağıdaki bağlantıdan ulaşabilirsiniz:\n\n🔗 Görsel Rehber: ${baseUrl}/rehber?tab=teacher\n🔑 Öğretmen Giriş Ekranı: ${baseUrl}/teacher/login`
        : `🛡️ *Okul Risk Haritası ve ŞÖK Sistemi - Yönetici Kurulum Rehberi (3 Adım)*\n\n1️⃣ Okul Tanımlama (MEBBİS Kodu)\n2️⃣ E-Tablo Oluşturma\n3️⃣ E-Okul PDF Yükleme\n\n🔗 Görsel Kurulum Kılavuzu: ${baseUrl}/rehber?tab=admin`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-16 print:bg-white print:pb-0">
      {/* Üst Kontrol Çubuğu (Yazdırma Sırasında Gizlenir) */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 border-b border-slate-800 print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Ana Sayfa
            </Link>
            <div className="h-5 w-px bg-slate-700 hidden sm:block" />
            <div>
              <h1 className="text-sm sm:text-base font-bold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                Görsel Kullanım Kılavuzu & İnfografik (PDF)
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Yöneticiler ve öğretmenler için adım adım resimli kullanım rehberi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleShareWhatsApp(activeTab === 'admin' ? 'admin' : 'teacher')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp&apos;ta Paylaş</span>
            </button>
            <button
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PDF Olarak İndir / Yazdır</span>
            </button>
          </div>
        </div>

        {/* Sekme Seçici */}
        <div className="bg-slate-950/80 border-t border-slate-800/80">
          <div className="max-w-5xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveTab('admin')}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                  activeTab === 'admin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                1. Yönetici / PDR Kurulum İnfografiği (3 Adım)
              </button>
              <button
                onClick={() => setActiveTab('teacher')}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                  activeTab === 'teacher'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                2. Öğretmen Kullanım İnfografiği (4 Adım)
              </button>
              <button
                onClick={() => setActiveTab('both')}
                className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition-all ${
                  activeTab === 'both'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-800/70 text-slate-400 hover:bg-slate-800'
                }`}
              >
                Tümünü Göster (Tek PDF&apos;te İndir)
              </button>
            </div>

            <span className="text-[11px] text-slate-400 hidden md:inline">
              💡 İpucu: &ldquo;PDF Olarak İndir / Yazdır&rdquo; butonuna basıp Hedef olarak <strong>&ldquo;PDF olarak kaydet&rdquo;</strong> seçebilirsiniz.
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-10 print:px-0 print:pt-0 print:space-y-8">
        {/* ===================================================================== */}
        {/* BÖLÜM 1: YÖNETİCİ / REHBER ÖĞRETMEN KURULUM İNFOGRAFİĞİ              */}
        {/* ===================================================================== */}
        {(activeTab === 'admin' || activeTab === 'both') && (
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-slate-300">
            {/* İnfografik Başlık Banner */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full">
                    <ShieldCheck className="w-4 h-4 text-blue-300" />
                    OKUL YÖNETİCİSİ & REHBERLİK SERVİSİ (PDR) KILAVUZU
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    3 Adımda Okul Kurulumu ve Veri Aktarımı
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                    Hiçbir teknik bilgiye ihtiyaç duymadan, sadece <strong>Okul Tanımlama → E-Tablo Oluşturma → PDF Yükleme</strong> sırasını izleyerek okulunuzu 3 dakikada hazır hale getirin.
                  </p>
                </div>
                <div className="bg-white/10 border border-white/20 rounded-2xl p-4 text-center shrink-0">
                  <div className="text-[11px] uppercase tracking-wider text-blue-200 font-semibold">Web Adresi</div>
                  <div className="text-base font-extrabold font-mono text-white mt-0.5">risk.onlinepdr.com</div>
                  <div className="text-[11px] text-emerald-300 font-medium mt-1">✓ %100 KVKK Uyumlu</div>
                </div>
              </div>

              {/* 3 Adım Özet Şeridi */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/15">
                <div className="bg-white/10 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black text-base flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-white">1. ADIM: Okul Tanımlama</div>
                    <div className="text-[11px] text-blue-200">MEBBİS Kurum Kodu & Okul Adı</div>
                  </div>
                </div>
                <div className="bg-white/10 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-400 text-slate-950 font-black text-base flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-white">2. ADIM: E-Tablo Oluşturma</div>
                    <div className="text-[11px] text-blue-200">Tek Tıkla Drive Tablosu Kurulumu</div>
                  </div>
                </div>
                <div className="bg-white/10 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-400 text-slate-950 font-black text-base flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-white">3. ADIM: PDF Veri Yükleme</div>
                    <div className="text-[11px] text-blue-200">E-Okul PDF&apos;leri & WhatsApp Şifreleri</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Adım Adım Görsel Kartlar */}
            <div className="p-6 sm:p-8 space-y-8">
              {/* ADIM 1 */}
              <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-5 sm:p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="flex-1 space-y-3">
                    <div className="inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-extrabold px-3 py-1 rounded-lg">
                      1. ADIM — OKUL TANIMLAMA (İLK YAPILACAK İŞLEM)
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                      <School className="w-5 h-5 text-blue-600 shrink-0" />
                      Sistem Ayarlarından MEBBİS Kurum Kodunuzu Kaydedin
                    </h3>
                    <ol className="text-xs sm:text-sm text-slate-700 space-y-2 list-decimal list-inside leading-relaxed">
                      <li>
                        Ana sayfadan <strong>&ldquo;Okul Yöneticisi / PDR Girişi (Google)&rdquo;</strong> butonuna tıklayarak Google hesabınızla oturum açın.
                      </li>
                      <li>
                        İlk kez giriş yaptığınızda sistem sizi otomatik olarak <strong>Sistem Ayarları (Okul Künyesi)</strong> ekranına yönlendirir.
                      </li>
                      <li>
                        Okulunuzun <strong>6 haneli MEBBİS Kurum Kodunu</strong> (Örn: <code className="bg-white px-1.5 py-0.5 rounded border font-mono font-bold text-blue-700">765432</code>) ve <strong>Okul Adını</strong> yazın.
                      </li>
                      <li>
                        Sayfanın altındaki <strong>&ldquo;1. Adımı Kaydet ve E-Tablo Oluşturmaya Geç&rdquo;</strong> butonuna tıklayın.
                      </li>
                    </ol>
                  </div>

                  {/* Görsel Ekran Önizlemesi */}
                  <div className="w-full md:w-80 bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 shrink-0">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b pb-1.5">
                      Ekran Görünümü (1. Adım)
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-700">* MEBBİS Kurum Kodu (6 Haneli)</div>
                        <div className="mt-1 px-3 py-1.5 bg-slate-50 border border-blue-400 rounded-lg font-mono text-xs font-bold text-blue-700">
                          765432
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-slate-700">* Okul Adı</div>
                        <div className="mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800">
                          Cumhuriyet Ortaokulu
                        </div>
                      </div>
                      <div className="pt-1">
                        <div className="w-full bg-blue-600 text-white text-center text-xs font-bold py-2 rounded-lg">
                          💾 1. Adımı Kaydet ve Devam Et →
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ADIM 2 */}
              <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-5 sm:p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="flex-1 space-y-3">
                    <div className="inline-flex items-center gap-2 bg-emerald-600 text-white text-xs font-extrabold px-3 py-1 rounded-lg">
                      2. ADIM — GOOGLE E-TABLO OLUŞTURMA
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                      Genel Bakış Ekranından &ldquo;E-Tablo Oluştur&rdquo; Butonuna Basın
                    </h3>
                    <ol className="text-xs sm:text-sm text-slate-700 space-y-2 list-decimal list-inside leading-relaxed">
                      <li>
                        Okul bilgilerinizi kaydettiğinizde otomatik olarak <strong>Genel Bakış</strong> ekranına gelirsiniz.
                      </li>
                      <li>
                        Ortadaki <strong>&ldquo;2. E-Tablo Oluşturma&rdquo;</strong> kutusunda yer alan <strong>&ldquo;2. Adım: E-Tablo Oluştur&rdquo;</strong> butonuna 1 kez tıklayın.
                      </li>
                      <li>
                        Sistem, sizin Google Drive hesabınızda okulunuza özel E-Tabloyu otomatik oluşturur ve öğretmenlerin gün boyu kesintisiz veri girebilmesi için arka plan servis bağlantısını otomatik ayarlar.
                      </li>
                    </ol>
                  </div>

                  {/* Görsel Ekran Önizlemesi */}
                  <div className="w-full md:w-80 bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 shrink-0">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b pb-1.5">
                      Ekran Görünümü (2. Adım)
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                      <div className="text-xs font-bold text-slate-900">2. E-Tablo Oluşturma</div>
                      <p className="text-[11px] text-slate-600">
                        Bulut hesabınızda veritabanı görevi görecek E-Tabloyu tek tıkla oluşturun.
                      </p>
                      <div className="w-full bg-slate-900 text-white text-center text-xs font-bold py-2 rounded-lg">
                        📊 2. Adım: E-Tablo Oluştur
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ADIM 3 */}
              <div className="rounded-2xl border-2 border-purple-200 bg-purple-50/40 p-5 sm:p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="flex-1 space-y-3">
                    <div className="inline-flex items-center gap-2 bg-purple-600 text-white text-xs font-extrabold px-3 py-1 rounded-lg">
                      3. ADIM — E-OKUL PDF YÜKLEME VE ŞİFRE DAĞITIMI
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                      <UploadCloud className="w-5 h-5 text-purple-600 shrink-0" />
                      E-Okul PDF Raporlarını Yükleyin ve WhatsApp İle Şifreleri Gönderin
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                      E-Okul sisteminden şu <strong>2 PDF raporunu</strong> bilgisayarınıza indirin (Raporları indirirken yazıcı ekranında <em>&ldquo;PDF Olarak Kaydet&rdquo;</em> seçiniz):
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="bg-white p-3.5 rounded-xl border border-purple-200 space-y-1">
                        <div className="text-xs font-extrabold text-purple-900 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-purple-600" />
                          1. Öğrenci Listesi PDF Yolu:
                        </div>
                        <p className="text-xs text-slate-700 font-medium leading-snug">
                          e-Okul &rarr; <strong>Öğrenci İşlemleri</strong> &rarr; <strong>Yazdır</strong> &rarr; <strong>Şube Listesi (Öğrenci No Sıralı)</strong>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          * Sınıf öğretmenleri ve müdür yardımcıları da bu listeden otomatik okunur.
                        </p>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-purple-200 space-y-1">
                        <div className="text-xs font-extrabold text-purple-900 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-purple-600" />
                          2. Öğretmen Ders Programı PDF Yolu:
                        </div>
                        <p className="text-xs text-slate-700 font-medium leading-snug">
                          e-Okul &rarr; <strong>Kurum İşlemleri</strong> &rarr; <strong>Ders İşlemleri</strong> &rarr; <strong>Ders Öğretmenleri</strong> &rarr; <strong>Yazdır</strong> &rarr; <strong>Öğretmen Ders Programları</strong>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          * Hangi branş öğretmeninin hangi sınıflara girdiği buradan otomatik okunur.
                        </p>
                      </div>
                    </div>

                    <ul className="text-xs sm:text-sm text-slate-700 space-y-1.5 list-disc list-inside pt-1">
                      <li>
                        <strong>Veri Yükleme</strong> sayfasından bu iki PDF dosyasını seçip <strong>&ldquo;Analiz Et ve E-Tabloya Aktar&rdquo;</strong> butonuna basın.
                      </li>
                      <li>
                        Yükleme bittiğinde ekranda tüm öğretmenlerinizin kullanıcı adı ve şifreleri listelenir. Her öğretmenin yanındaki yeşil <strong>&ldquo;WhatsApp ile Gönder&rdquo;</strong> butonuna basarak şifrelerini tek tıkla iletin!
                      </li>
                      <li>
                        <em>Özel Eğitim Notu:</em> Bir sınıfta iki sınıf öğretmeni varsa <strong>&ldquo;+ Manuel Öğretmen Ekle&rdquo;</strong> veya <strong>&ldquo;Düzenle&rdquo;</strong> butonundan ikinci öğretmeni de Sınıf Öğretmeni olarak ekleyebilirsiniz.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ===================================================================== */}
        {/* BÖLÜM 2: ÖĞRETMEN KULLANIM İNFOGRAFİĞİ (4 ADIMDA KOLAY KULLANIM)      */}
        {/* ===================================================================== */}
        {(activeTab === 'teacher' || activeTab === 'both') && (
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-slate-300 print:break-before-page">
            {/* Öğretmen İnfografik Başlık Banner */}
            <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 text-white p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-bold px-3 py-1 rounded-full">
                    <Smartphone className="w-4 h-4 text-indigo-300" />
                    SINIF VE DERS ÖĞRETMENLERİ İÇİN GÖRSEL KULLANIM REHBERİ
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    4 Adımda Çok Kolay Öğretmen Girişi ve Değerlendirme
                  </h2>
                  <p className="text-xs sm:text-sm text-indigo-100 max-w-2xl leading-relaxed">
                    Cep telefonunuzdan, tabletinizden veya bilgisayardan <strong>hiçbir program indirmeden</strong> sadece 4 adımda öğrenci değerlendirmelerinizi kolayca tamamlayın.
                  </p>
                </div>
                <div className="bg-white/10 border border-white/20 rounded-2xl p-4 text-center shrink-0">
                  <div className="text-[11px] uppercase tracking-wider text-indigo-200 font-semibold">Öğretmen Giriş Adresi</div>
                  <div className="text-sm sm:text-base font-extrabold font-mono text-white mt-0.5">
                    risk.onlinepdr.com/teacher/login
                  </div>
                  <div className="text-[11px] text-amber-300 font-medium mt-1">📱 Telefon & Bilgisayar Uyumlu</div>
                </div>
              </div>
            </div>

            {/* 4 Adımlı Görsel Öğretmen Rehberi */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ÖĞRETMEN ADIM 1 */}
                <div className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/30 p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="bg-indigo-600 text-white text-xs font-extrabold px-3 py-1 rounded-lg">
                        1. ADIM: OKUL KODUNU GİRİN
                      </span>
                      <School className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      6 Haneli Okul (MEBBİS) Kurum Kodunuzu Yazın
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Okul idarenizin veya rehber öğretmeninizin WhatsApp&apos;tan gönderdiği bağlantıya tıklayın veya{' '}
                      <strong>risk.onlinepdr.com/teacher/login</strong> adresini açın. İlk kutuya okulunuzun{' '}
                      <strong>6 haneli MEBBİS Kurum Kodunu</strong> yazıp <strong>&ldquo;Okulu Doğrula ve Devam Et&rdquo;</strong> butonuna basın.
                    </p>
                  </div>

                  {/* Mini Görsel Kutu */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-500">Kurum Kodu (6 Haneli)</div>
                    <div className="px-3 py-2 bg-slate-50 border border-indigo-300 rounded-lg font-mono text-sm font-bold text-center tracking-widest text-indigo-700">
                      7 6 5 4 3 2
                    </div>
                    <div className="bg-indigo-600 text-white text-center text-xs font-bold py-2 rounded-lg">
                      Okulu Doğrula ve Devam Et &rarr;
                    </div>
                  </div>
                </div>

                {/* ÖĞRETMEN ADIM 2 */}
                <div className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/30 p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="bg-indigo-600 text-white text-xs font-extrabold px-3 py-1 rounded-lg">
                        2. ADIM: KULLANICI ADI & ŞİFRE
                      </span>
                      <KeyRound className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      Size Verilen Kullanıcı Adı ve Şifre İle Giriş Yapın
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      WhatsApp mesajında size özel gönderilen <strong>Kullanıcı Adı</strong> (Örn: <code className="bg-white px-1 rounded border">ahmet.yilmaz</code>) ve{' '}
                      <strong>Şifrenizi</strong> yazıp <strong>&ldquo;Giriş Yap&rdquo;</strong> butonuna dokunun.
                      <br />
                      <span className="text-[11px] text-slate-500">
                        * İsterseniz giriş yaptıktan sonra sol menüdeki <strong>Profilim</strong> ekranından şifrenizi değiştirebilirsiniz.
                      </span>
                    </p>
                  </div>

                  {/* Mini Görsel Kutu */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500">Kullanıcı Adı</div>
                        <div className="mt-0.5 px-2.5 py-1.5 bg-slate-50 border rounded text-xs font-mono text-slate-800">
                          ahmet.yilmaz
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500">Şifre</div>
                        <div className="mt-0.5 px-2.5 py-1.5 bg-slate-50 border rounded text-xs font-mono text-slate-800">
                          ••••••
                        </div>
                      </div>
                    </div>
                    <div className="bg-emerald-600 text-white text-center text-xs font-bold py-2 rounded-lg">
                      ✓ Sisteme Giriş Yap
                    </div>
                  </div>
                </div>

                {/* ÖĞRETMEN ADIM 3 */}
                <div className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/30 p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="bg-indigo-600 text-white text-xs font-extrabold px-3 py-1 rounded-lg">
                        3. ADIM: SINIF VE ÖĞRENCİ SEÇİMİ
                      </span>
                      <MousePointerClick className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      Sınıfınıza Tıklayın ve Öğrencinin Yanındaki &ldquo;Değerlendir&rdquo; Butonuna Basın
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Giriş yaptığınızda dersine girdiğiniz sınıflar ekranda kutular halinde görünür. İlgili sınıfa tıklayın; açılan listede değerlendirmek istediğiniz öğrencinin karşısındaki <strong>&ldquo;Değerlendir&rdquo;</strong> butonuna dokunun.
                    </p>
                  </div>

                  {/* Mini Görsel Kutu */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
                    <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <div>
                        <div className="text-xs font-bold text-slate-800">104 - AYŞE DEMİR</div>
                        <div className="text-[10px] text-slate-500">9/A Sınıfı</div>
                      </div>
                      <span className="bg-indigo-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg">
                        Değerlendir &rarr;
                      </span>
                    </div>
                  </div>
                </div>

                {/* ÖĞRETMEN ADIM 4 */}
                <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="bg-emerald-600 text-white text-xs font-extrabold px-3 py-1 rounded-lg">
                        4. ADIM: HAZIR METİNLERLE KAYDEDİN
                      </span>
                      <Sparkles className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      Yeşil &ldquo;+ TIKLA EKLE&rdquo; Kutucuklarına Dokunup Kaydedin!
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Uzun uzun yazı yazmanıza gerek yoktur! Ekrandaki hazır cümlelerin yanındaki yeşil{' '}
                      <strong className="text-emerald-700">&ldquo;+ TIKLA EKLE&rdquo;</strong> butonlarına dokunduğunuzda cümle otomatik olarak görüş kutusuna eklenir. Ardından en alttaki <strong>&ldquo;Kaydet&rdquo;</strong> butonuna basmanız yeterlidir.
                    </p>
                  </div>

                  {/* Mini Görsel Kutu */}
                  <div className="bg-white rounded-xl border border-emerald-200 p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs bg-emerald-50/70 p-2 rounded-lg border border-emerald-200">
                      <span className="text-slate-700 font-medium text-[11px]">
                        &ldquo;Bireysel eğitim planı (BEP) hedeflerine uygun ilerleme göstermektedir.&rdquo;
                      </span>
                      <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-1 rounded shrink-0 ml-2">
                        + TIKLA EKLE
                      </span>
                    </div>
                    <div className="bg-slate-900 text-white text-center text-xs font-bold py-2 rounded-lg">
                      💾 Kaydet ve Sonraki Öğrenciye Geç &rarr;
                    </div>
                  </div>
                </div>
              </div>

              {/* Branş Öğretmeni vs Sınıf Öğretmeni Farkı Bilgi Kutusu */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider">
                    📌 Ders / Branş Öğretmenleri Neleri Doldurur?
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ders öğretmenlerimizde <strong>yalnızca &ldquo;ŞÖK Görüşü&rdquo;</strong> ekranı açılır. Risk Haritası veya Grup Eğitimine Hazırlık sekmeleri ders öğretmenlerinde görünmez. Sadece hazır şablonlardan ŞÖK görüşü seçip kaydederler.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="text-xs font-extrabold text-emerald-700 uppercase tracking-wider">
                    📌 Sınıf Rehber / Özel Eğitim Öğretmenleri Neleri Doldurur?
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Sınıf öğretmenlerimiz öğrencinin <strong>1) Risk Haritası</strong> maddelerini (varsa) işaretler ve <strong>2) ŞÖK / Grup Eğitimine Hazırlık</strong> görüşlerini girip kaydeder. Ayrıca diğer branş öğretmenlerinin o öğrenci için yazdığı ŞÖK görüşlerini de ekranda görebilirler.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default function RehberPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500 text-sm">Kılavuz yükleniyor...</div>}>
      <RehberContent />
    </Suspense>
  );
}
