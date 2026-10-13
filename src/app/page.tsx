import Link from 'next/link';
import { 
  ShieldCheck, 
  Lock, 
  FileSpreadsheet, 
  Users, 
  Database, 
  ArrowRight, 
  Sparkles, 
  Heart,
  Globe,
  CheckCircle2,
  BookOpen
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Üst Navigasyon */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-tight block">Okul Risk Haritası & ŞÖK</span>
              <span className="text-[10px] text-indigo-400 font-mono tracking-wider uppercase">onlinepdr.com</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              href="/teacher/login"
              className="text-xs font-semibold text-slate-300 hover:text-white px-3.5 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Öğretmen Girişi
            </Link>
            <Link 
              href="/login"
              className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5"
            >
              Yönetici Girişi <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Alanı */}
      <main className="max-w-5xl mx-auto px-4 py-16 flex-1 flex flex-col justify-center text-center space-y-12">
        <div className="space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Rehber Öğretmenler ve Okul İdarecileri İçin Ücretsiz & Açık Sistem
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Okul Risk Haritası ve ŞÖK Süreçlerini <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Kendi E-Tablonuzda
            </span> Güvenle Yönetin
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
            E-Okul'dan aldığınız PDF sınıf listelerini ve ders programını yükleyin. Sistem verileri doğrudan kendi <strong>Google Drive E-Tablonuza</strong> aktarsın. Hiçbir öğrenci verisi harici sunucularda depolanmaz.
          </p>
        </div>

        {/* Giriş Butonları */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-sm"
          >
            <ShieldCheck className="w-4 h-4" />
            Okul Yöneticisi / PDR Girişi (Google)
          </Link>
          <Link
            href="/teacher/login"
            className="w-full sm:w-auto px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold rounded-2xl transition-all border border-slate-700 flex items-center justify-center gap-2 text-sm"
          >
            <BookOpen className="w-4 h-4" />
            Öğretmen Girişi (Kullanıcı Adı & Şifre)
          </Link>
        </div>

        {/* Güvenlik ve Gizlilik Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left pt-6">
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Sıfır Veri Depolama (Zero-Knowledge)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Öğrencilerin isimleri, numaraları ve risk değerlendirmeleri merkezi bir veritabanında tutulmaz. Tüm veritabanı okul yöneticisinin kendi Google Drive hesabında yaşayan bir E-Tablodur.
            </p>
          </div>

          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">MEB Resmi Formatı (36 Madde)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Bakanlığın yayımladığı resmi okul risk haritası şablonuyla (15173010_okulriskharitasi.xlsx) %100 uyumludur. Tek tıkla konsolide Excel matrisi üretilir.
            </p>
          </div>

          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Rol Bazlı ŞÖK Yetkilendirmesi</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ders öğretmenleri sadece kendi görüşünü yazar; risk haritasını göremez. Sınıf rehber öğretmenleri kendi sınıfının risk haritasını girer ve ŞÖK görüşlerini salt okunur derler.
            </p>
          </div>
        </div>

        {/* Yasal Uyarı, Veri Güvenliği ve KVKK Bilgilendirme Kartı */}
        <div className="bg-slate-800/30 border border-slate-700/60 rounded-3xl p-8 text-left space-y-6">
          <div className="border-b border-slate-700/50 pb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              Yasal Uyarı, Veri Güvenliği ve KVKK Taahhüdü
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs text-slate-300 leading-relaxed">
            <div className="space-y-3">
              <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Öğrenci Verilerinin Gizliliği (6698 Sayılı KVKK)
              </h4>
              <p>
                Okul Risk Haritası ve ŞÖK süreçleri, öğrencilere ait rehberlik ve psikososyal alanlarda özel nitelikli değerlendirmeler içerir.
              </p>
              <p>
                Bu platform, <strong>sunucusuz (serverless client)</strong> prensipleriyle çalışır. Sistem sunucularında veya üçüncü taraf veritabanlarında hiçbir öğrencinin adı, soyadı, T.C. kimlik numarası, okul numarası veya risk değerlendirmesi <u>kesinlikle depolanmaz ve işlenmez</u>.
              </p>
              <p>
                Sistem yalnızca bir şablon ve hesaplama istemcisi olarak işlev görür. Tüm kayıtlar doğrudan okul yöneticisinin kendi yetkili bulut depolama alanındaki şifreli E-Tablo üzerinde oluşturulur ve yetkiler sadece okul personeline aittir.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                Hukuki Çekince ve Bağımsızlık Beyanı (Disclaimer)
              </h4>
              <p>
                Bu platform, Millî Eğitim Bakanlığı'nın resmi bir bilişim sistemi olmayıp; eğitim kurumları, psikolojik danışmanlar ve şube öğretmenlerinin dönemlik kırtasiye ve formül yüklerini hafifletmek amacıyla geliştirilmiş <strong>bağımsız ve ücretsiz bir yardımcı araçtır</strong>.
              </p>
              <p>
                Sistem hiçbir resmî kurum adına veri toplama, merkezi arşivleme veya rapor iletimi yapmaz. Hazırlanan konsolide tablolar, ilgili mevzuat doğrultusunda okul rehberlik servisleri tarafından kendi resmî prosedürlerinde değerlendirilmek üzere okulun kendi mülkiyetinde saklanır.
              </p>
              <p className="text-slate-400">
                Görüş, öneri ve teknik geri bildirimleriniz için <a href="https://onlinepdr.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline font-semibold">onlinepdr.com</a> üzerinden iletişime geçebilirsiniz.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Alt Bilgi Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; 2026 Okul Risk Haritası ve ŞÖK Sistemi — onlinepdr.com</span>
          <span className="flex items-center gap-1">
            Türk PDR Camiası İçin Sevgiyle Tasarlandı <Heart className="w-3.5 h-3.5 text-rose-500 inline" />
          </span>
        </div>
      </footer>
    </div>
  );
}
