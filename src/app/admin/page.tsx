'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileSpreadsheet, 
  Users, 
  GraduationCap, 
  Activity, 
  ArrowRight, 
  CheckCircle2, 
  UploadCloud,
  ExternalLink,
  School,
  BookOpen,
  Printer
} from 'lucide-react';
import Link from 'next/link';
import { saveSchoolData, getSchoolData } from '@/lib/db';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const router = useRouter();
  const [schoolDefined, setSchoolDefined] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<{ schoolKey: string; schoolName: string }>({
    schoolKey: '',
    schoolName: ''
  });
  const [sheetCreated, setSheetCreated] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Canlı E-Tablo istatistikleri
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    riskFilledRatio: 0
  });

  // Sayfa yüklendiğinde mevcut kullanıcının Okul, E-Tablo ve verilerini kontrol et
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const activeKey = typeof window !== 'undefined' ? localStorage.getItem('admin_active_school_key') : null;
          let schoolData = null;
          if (activeKey) {
            schoolData = await getSchoolData(user.uid, activeKey);
          } else {
            schoolData = await getSchoolData(user.uid);
          }

          const hasValidSchoolKey = Boolean(
            schoolData &&
            schoolData.schoolKey &&
            schoolData.schoolKey !== 'DEFAULT' &&
            schoolData.schoolName
          );
          setSchoolDefined(hasValidSchoolKey);
          if (hasValidSchoolKey && schoolData) {
            setSchoolInfo({
              schoolKey: schoolData.schoolKey,
              schoolName: schoolData.schoolName || ''
            });
          } else {
            setSchoolInfo({ schoolKey: '', schoolName: '' });
          }

          if (schoolData && schoolData.spreadsheetId) {
            setSheetCreated(true);
            setSheetUrl(schoolData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${schoolData.spreadsheetId}`);
            if (typeof window !== 'undefined') {
              localStorage.setItem('active_spreadsheet_id', schoolData.spreadsheetId);
            }

            // Canlı verileri ve istatistikleri API'den çek
            const activeToken = localStorage.getItem('google_access_token') || schoolData.accessToken || '';
            const res = await fetch(
              `/api/school-data?spreadsheetId=${schoolData.spreadsheetId}&schoolKey=${encodeURIComponent(schoolData.schoolKey || '')}`,
              {
                headers: {
                  ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
                }
              }
            );
            const json = await res.json();
            if (res.ok && json.data) {
              setStats({
                totalStudents: json.data.stats?.totalStudents || 0,
                totalTeachers: json.data.stats?.totalTeachers || 0,
                riskFilledRatio: json.data.stats?.riskFilledRatio || 0
              });
            }
          } else {
            // Bu okul için henüz bir E-Tablo oluşturulmamış! Yeni tablo oluşturma butonunu aktif et
            setSheetCreated(false);
            setSheetUrl(null);
            setStats({
              totalStudents: 0,
              totalTeachers: 0,
              riskFilledRatio: 0
            });
            if (typeof window !== 'undefined') {
              localStorage.removeItem('active_spreadsheet_id');
            }
          }
        } catch (error) {
          console.error("Mevcut okul tablosu kontrol edilirken hata:", error);
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateSpreadsheet = async () => {
    if (!schoolDefined) {
      toast.error("Lütfen 1. Adım olarak önce okulunuzun MEBBİS Kurum Kodunu ve adını tanımlayın.");
      router.push('/admin/settings');
      return;
    }

    if (sheetCreated) {
      toast.error("Zaten oluşturulmuş ve sisteme bağlı bir E-Tablonuz bulunmaktadır.");
      return;
    }

    setIsCreating(true);
    const loadingToast = toast.loading("Google Drive'ınızda E-Tablo oluşturuluyor...");

    try {
      const token = localStorage.getItem('google_access_token');
      if (!token) {
        toast.dismiss(loadingToast);
        toast.error("Oturum süreniz dolmuştur. Yeniden giriş sayfasına yönlendiriliyorsunuz...", {
          duration: 3000,
          icon: '⏳'
        });
        setTimeout(() => router.push('/login'), 1500);
        setIsCreating(false);
        return;
      }

      const activeKey = typeof window !== 'undefined' ? localStorage.getItem('admin_active_school_key') : null;
      let currentSchoolInfo: any = null;
      if (auth.currentUser) {
        currentSchoolInfo = await getSchoolData(auth.currentUser.uid, activeKey || undefined);
      }

      if (!currentSchoolInfo?.schoolKey || currentSchoolInfo.schoolKey === 'DEFAULT') {
        toast.dismiss(loadingToast);
        toast.error("Lütfen önce 1. Adım olarak MEBBİS Kurum Kodunuzu kaydedin.");
        router.push('/admin/settings');
        setIsCreating(false);
        return;
      }

      const res = await fetch('/api/create-sheet', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          schoolKey: currentSchoolInfo.schoolKey,
          schoolName: currentSchoolInfo.schoolName || ''
        })
      });

      const data = await res.json();
      toast.dismiss(loadingToast);

      if (res.ok) {
        setSheetCreated(true);
        const targetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}`;
        setSheetUrl(targetUrl);

        if (typeof window !== 'undefined') {
          localStorage.setItem('active_spreadsheet_id', data.spreadsheetId);
        }

        // Firebase Firestore'a bu okul için ayrı E-Tablo olarak kaydet
        if (auth.currentUser) {
          await saveSchoolData(auth.currentUser.uid, {
            schoolKey: currentSchoolInfo.schoolKey,
            schoolName: currentSchoolInfo.schoolName,
            spreadsheetId: data.spreadsheetId,
            adminEmail: auth.currentUser.email || undefined,
            accessToken: token,
            spreadsheetUrl: targetUrl
          });
        }

        if (data.alreadyExisted) {
          toast.success("Drive'ınızda mevcut olan E-Tablo bulundu ve hesabınıza bağlandı! Şimdi 3. Adım olan PDF yüklemeye geçebilirsiniz.");
        } else {
          toast.success("E-Tablo başarıyla oluşturuldu! Şimdi 3. Adım olan PDF yüklemeye geçebilirsiniz.");
        }
      } else {
        const errorText = (data.error || '').toLowerCase();
        if (
          res.status === 401 ||
          errorText.includes('authentication') ||
          errorText.includes('credentials') ||
          errorText.includes('token') ||
          errorText.includes('unauthorized')
        ) {
          toast.error("Oturum süreniz dolmuştur. Giriş sayfasına yönlendiriliyorsunuz...", {
            duration: 3500,
            icon: '⏳'
          });
          localStorage.removeItem('google_access_token');
          setTimeout(() => router.push('/login'), 1800);
        } else {
          toast.error("E-Tablo oluşturulamadı: " + (data.error || "Bilinmeyen hata"));
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.dismiss(loadingToast);
      toast.error("Bir hata oluştu: " + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Genel Bakış ve Kurulum Adımları</h1>
          <p className="text-slate-500 mt-1">
            Sistemi kullanmaya başlamak için aşağıdaki <strong>1 → 2 → 3</strong> sırasını takip edin.
          </p>
        </div>
        <Link
          href="/rehber"
          className="inline-flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors self-start sm:self-auto shadow-xs"
        >
          <BookOpen className="w-4 h-4 text-indigo-600" />
          <span>Görsel Kullanım Kılavuzu & İnfografik (PDF)</span>
        </Link>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Toplam Öğretmen</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalTeachers}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Toplam Öğrenci</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalStudents}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Risk Haritası Doldurulma</p>
            <p className="text-2xl font-bold text-slate-900">%{stats.riskFilledRatio}</p>
          </div>
        </div>
      </div>

      {/* 3 Adımlı Kurulum Sihirbazı (1. Okul Tanımlama -> 2. E-Tablo Oluşturma -> 3. PDF Yükleme) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Adım 1: Okul Tanımlama (MEBBİS Kodu) */}
        <div className={`bg-white p-6 rounded-2xl shadow-sm border flex flex-col ${
          !schoolDefined ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-100'
        }`}>
          <div className="flex items-start gap-4 mb-4">
            <div className={`p-3 rounded-xl shrink-0 ${
              schoolDefined ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
            }`}>
              <School className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  schoolDefined ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  1. ADIM
                </span>
                {schoolDefined && <span className="text-xs text-emerald-600 font-semibold">✓ Tamamlandı</span>}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-1">1. Okul Tanımlama</h3>
              <p className="text-slate-500 text-sm mt-1">
                {schoolDefined
                  ? `${schoolInfo.schoolName} (MEBBİS Kodu: ${schoolInfo.schoolKey}) başarıyla tanımlandı.`
                  : 'İlk olarak okulunuzun 6 haneli MEBBİS Kurum Kodunu ve adını Sistem Ayarları ekranından kaydedin.'}
              </p>
            </div>
          </div>
          <div className="mt-auto pt-4">
            {isLoading ? (
              <div className="py-2.5 text-center text-sm text-slate-400">Kontrol ediliyor...</div>
            ) : schoolDefined ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-700 font-medium bg-emerald-50 py-2 px-3.5 rounded-xl border border-emerald-100 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="truncate">Kurum Kodu: <strong>{schoolInfo.schoolKey}</strong></span>
                </div>
                <Link
                  href="/admin/settings"
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  Okul Künyesini Düzenle
                </Link>
              </div>
            ) : (
              <Link
                href="/admin/settings"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <span>1. Adım: Okul Bilgilerini Tanımla</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>

        {/* Adım 2: Google E-Tablo Oluşturma */}
        <div className={`bg-white p-6 rounded-2xl shadow-sm border flex flex-col ${
          schoolDefined && !sheetCreated ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-100'
        }`}>
          <div className="flex items-start gap-4 mb-4">
            <div className={`p-3 rounded-xl shrink-0 ${
              sheetCreated
                ? 'bg-emerald-50 text-emerald-600'
                : schoolDefined
                  ? 'bg-orange-50 text-orange-600'
                  : 'bg-slate-100 text-slate-400'
            }`}>
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  sheetCreated
                    ? 'bg-emerald-100 text-emerald-700'
                    : schoolDefined
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-500'
                }`}>
                  2. ADIM
                </span>
                {sheetCreated && <span className="text-xs text-emerald-600 font-semibold">✓ Tamamlandı</span>}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-1">2. E-Tablo Oluşturma</h3>
              <p className="text-slate-500 text-sm mt-1">
                {sheetCreated 
                  ? 'Okulunuz için E-Tablo veritabanı kendi Google Drive hesabınızda aktif ve bağlı durumdadır.'
                  : 'Okulunuzu tanımladıktan sonra Google Drive hesabınızda veritabanı görevi görecek E-Tabloyu tek tıkla oluşturun.'}
              </p>
            </div>
          </div>
          <div className="mt-auto pt-4">
            {isLoading ? (
              <div className="py-2.5 text-center text-sm text-slate-400">Kontrol ediliyor...</div>
            ) : sheetCreated ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-700 font-medium bg-emerald-50 py-2 px-3.5 rounded-xl border border-emerald-100 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>E-Tablonuz Aktif ve Bağlı</span>
                </div>
                {sheetUrl && (
                  <a
                    href={sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Google Drive&apos;da E-Tabloyu Aç</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  </a>
                )}
              </div>
            ) : !schoolDefined ? (
              <Link
                href="/admin/settings"
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <span>Önce 1. Adımı (Okul Tanımlama) Tamamlayın</span>
              </Link>
            ) : (
              <button
                onClick={handleCreateSpreadsheet}
                disabled={isCreating}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70 shadow-sm"
              >
                {isCreating ? 'Oluşturuluyor...' : '2. Adım: E-Tablo Oluştur'}
              </button>
            )}
          </div>
        </div>

        {/* Adım 3: Veri Yükleme */}
        <div className={`bg-white p-6 rounded-2xl shadow-sm border flex flex-col ${
          sheetCreated && stats.totalStudents === 0 ? 'border-purple-400 ring-2 ring-purple-100' : 'border-slate-100'
        }`}>
          <div className="flex items-start gap-4 mb-4">
            <div className={`p-3 rounded-xl shrink-0 ${
              stats.totalStudents > 0
                ? 'bg-emerald-50 text-emerald-600'
                : sheetCreated
                  ? 'bg-purple-50 text-purple-600'
                  : 'bg-slate-100 text-slate-400'
            }`}>
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  stats.totalStudents > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : sheetCreated
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-slate-100 text-slate-500'
                }`}>
                  3. ADIM
                </span>
                {stats.totalStudents > 0 && <span className="text-xs text-emerald-600 font-semibold">✓ Yüklendi</span>}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-1">3. PDF Veri Yükleme</h3>
              <p className="text-slate-500 text-sm mt-1">
                E-Okul Şube Listesi ve Öğretmen Ders Programı PDF dosyalarını yükleyerek öğretmen şifrelerini oluşturun.
              </p>
            </div>
          </div>
          <div className="mt-auto pt-4">
            {!sheetCreated ? (
              <div className="w-full bg-slate-100 text-slate-400 text-xs font-semibold py-2.5 px-4 rounded-xl text-center">
                Önce 1. ve 2. Adımı Tamamlayın
              </div>
            ) : (
              <Link
                href="/admin/upload"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <span>{stats.totalStudents > 0 ? 'Verileri & Öğretmenleri Yönet' : '3. Adım: PDF Yüklemeye Git'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Görsel Kullanım Kılavuzu & İnfografik Kartı */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <span className="text-[11px] font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full">
            Yöneticiler ve Öğretmenler İçin Görsel Rehber
          </span>
          <h3 className="text-lg font-bold text-white">
            Adım Adım Görsel Kullanım Kılavuzu & Yazdırılabilir PDF İnfografik
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Bilgisayar kullanımı konusunda deneyimi az olan kullanıcılar için hazırlanmış resimli/ikonlu <strong>Yönetici Kurulum Rehberi</strong> ve öğretmenler grubunda paylaşabileceğiniz <strong>Öğretmen Kullanım İnfografiği (PDF)</strong> dokümanlarına buradan ulaşabilirsiniz.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href="/rehber?tab=admin"
            className="bg-white text-slate-900 hover:bg-slate-100 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-sm"
          >
            <BookOpen className="w-4 h-4 text-indigo-600" />
            Yönetici Kılavuzu
          </Link>
          <Link
            href="/rehber?tab=teacher"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-sm border border-indigo-400/30"
          >
            <Printer className="w-4 h-4" />
            Öğretmen İnfografiği (PDF Yazdır)
          </Link>
        </div>
      </div>
    </div>
  );
}
