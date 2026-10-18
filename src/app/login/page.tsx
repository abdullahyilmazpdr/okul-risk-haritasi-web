'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { saveSchoolData, getSchoolData, getSchoolsByAdmin } from '@/lib/db';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGoogleLogin = async () => {
    setLoading(true);
    const loginToast = toast.loading("Google ile kimlik doğrulanıyor...");

    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    provider.addScope('https://www.googleapis.com/auth/spreadsheets');
    provider.setCustomParameters({
      access_type: 'offline',
      prompt: 'select_account'
    });

    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      
      if (token) {
        localStorage.setItem('google_access_token', token);
      }

      let hasDefinedSchool = false;
      if (result.user) {
        const userSchools = await getSchoolsByAdmin(result.user.uid);
        for (const s of userSchools) {
          if (s.schoolKey && s.schoolKey !== 'DEFAULT') {
            hasDefinedSchool = true;
            if (token) {
              await saveSchoolData(result.user.uid, {
                schoolKey: s.schoolKey,
                schoolName: s.schoolName,
                spreadsheetId: s.spreadsheetId || '',
                adminEmail: result.user.email || undefined,
                accessToken: token,
                spreadsheetUrl: s.spreadsheetUrl
              });
            }
          }
        }
      }

      toast.dismiss(loginToast);
      if (hasDefinedSchool) {
        toast.success("Giriş başarılı! Yönetim paneline aktarılıyorsunuz...", {
          duration: 2500
        });
        setTimeout(() => {
          router.push('/admin');
        }, 500);
      } else {
        toast.success("Hoş geldiniz! 1. Adım olarak lütfen okulunuzun MEBBİS Kurum Kodunu tanımlayın.", {
          duration: 4000
        });
        setTimeout(() => {
          router.push('/admin/settings');
        }, 500);
      }
    } catch (err: any) {
      console.error(err);
      toast.dismiss(loginToast);
      toast.error("Giriş başarısız: " + (err.message || 'Lütfen tekrar deneyin.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-2xl shadow-2xl w-full max-w-md text-center">
        <div className="bg-blue-500/20 p-4 rounded-full inline-block mb-6">
          <ShieldCheck className="w-12 h-12 text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Yönetici Girişi</h1>
        <p className="text-slate-300 mb-8">Okul Risk Haritası ve ŞÖK Sistemine erişmek için giriş yapın.</p>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-semibold py-3 px-6 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          )}
          Google ile Giriş Yap
        </button>

        <div className="mt-6 pt-6 border-t border-slate-700/60 space-y-3">
          <p className="text-xs text-slate-400">
            Öğretmen misiniz?{' '}
            <Link href="/teacher/login" className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2">
              Öğretmen Girişi Yapın
            </Link>
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            * Yasal Bilgilendirme: Bu sistem bağımsız bir planlama ve şablon aracıdır. Sistem sunucularında hiçbir öğrenci verisi saklanmaz; tüm veriler yöneticinin kendi bulut hesabındaki şifreli E-Tablo üzerinde barınır.
          </p>
          <div>
            <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
              ← Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
