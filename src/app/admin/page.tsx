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
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { saveSchoolData, getSchoolData } from '@/lib/db';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const router = useRouter();
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

  // Sayfa yüklendiğinde mevcut kullanıcının E-Tablo ve verilerini kontrol et
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

          if (schoolData && schoolData.spreadsheetId) {
            setSheetCreated(true);
            setSheetUrl(schoolData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${schoolData.spreadsheetId}`);
            if (typeof window !== 'undefined') {
              localStorage.setItem('active_spreadsheet_id', schoolData.spreadsheetId);
            }

            // Canlı verileri ve istatistikleri API'den çek
            const activeToken = localStorage.getItem('google_access_token') || schoolData.accessToken;
            if (activeToken) {
              const res = await fetch(`/api/school-data?spreadsheetId=${schoolData.spreadsheetId}&schoolKey=${schoolData.schoolKey || ''}`, {
                headers: {
                  'Authorization': `Bearer ${activeToken}`
                }
              });
              const json = await res.json();
              if (res.ok && json.data) {
                setStats({
                  totalStudents: json.data.stats?.totalStudents || 0,
                  totalTeachers: json.data.stats?.totalTeachers || 0,
                  riskFilledRatio: json.data.stats?.riskFilledRatio || 0
                });
              }
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

      const res = await fetch('/api/create-sheet', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          schoolKey: currentSchoolInfo?.schoolKey || activeKey || '',
          schoolName: currentSchoolInfo?.schoolName || ''
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
          const targetKey = currentSchoolInfo?.schoolKey || activeKey || 'DEFAULT';
          await saveSchoolData(auth.currentUser.uid, {
            schoolKey: targetKey,
            schoolName: currentSchoolInfo?.schoolName,
            spreadsheetId: data.spreadsheetId,
            adminEmail: auth.currentUser.email || undefined,
            accessToken: token,
            spreadsheetUrl: targetUrl
          });
        }

        if (data.alreadyExisted) {
          toast.success("Drive'ınızda mevcut olan E-Tablo bulundu ve hesabınıza bağlandı!");
        } else {
          toast.success("E-Tablo başarıyla oluşturuldu ve hesabınıza bağlandı!");
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Genel Bakış</h1>
        <p className="text-slate-500 mt-1">Okul Risk Haritası ve ŞÖK sisteminin güncel durumu.</p>
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

      {/* Hızlı Eylemler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Adım 1: Google E-Tablo */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-start gap-4 mb-4">
            <div className={`p-3 rounded-xl ${sheetCreated ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">1. E-Tablo Veritabanı</h3>
              <p className="text-slate-500 text-sm mt-1">
                {sheetCreated 
                  ? 'Okulunuz için 1 adet E-Tablo veritabanı bulut hesabınızda aktif ve bağlı durumdadır.'
                  : 'Sistemin çalışabilmesi için bulut hesabınızda veritabanı görevi görecek bir e-tablo oluşturulmalıdır.'
                }
              </p>
            </div>
          </div>
          <div className="mt-auto pt-4">
            {isLoading ? (
              <div className="py-2.5 text-center text-sm text-slate-400">Kontrol ediliyor...</div>
            ) : sheetCreated ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 font-medium bg-emerald-50 py-2.5 px-4 rounded-xl border border-emerald-100">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span className="text-sm">E-Tablonuz Aktif (Yeni tablo oluşturulamaz)</span>
                </div>
                {sheetUrl && (
                  <a
                    href={sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Google Drive'da E-Tabloyu Aç</span>
                    <ExternalLink className="w-4 h-4 text-slate-500" />
                  </a>
                )}
              </div>
            ) : (
              <button
                onClick={handleCreateSpreadsheet}
                disabled={isCreating}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isCreating ? 'Oluşturuluyor...' : 'E-Tablo Oluştur'}
              </button>
            )}
          </div>
        </div>

        {/* Adım 2: Veri Yükleme */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">2. E-Okul Veri Aktarımı</h3>
              <p className="text-slate-500 text-sm mt-1">Sınıf listeleri ve öğretmen ders programı PDF dosyalarını yükleyerek sistemi kullanıma hazır hale getirin.</p>
            </div>
          </div>
          <div className="mt-auto pt-4">
            <Link
              href="/admin/upload"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Yükleme Sayfasına Git
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
