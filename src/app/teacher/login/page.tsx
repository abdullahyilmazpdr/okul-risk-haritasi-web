'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Loader2, ArrowRight, School, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TeacherLoginPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [schoolKey, setSchoolKey] = useState('');
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [isVerifyingSchool, setIsVerifyingSchool] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Sayfaya gelindiğinde form ve oturum sıfırlansın
  useEffect(() => {
    setUsername('');
    setPassword('');
    setLoading(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('teacher_session');
      const savedSchoolKey = localStorage.getItem('last_school_key');
      if (savedSchoolKey) {
        setSchoolKey(savedSchoolKey);
      }
    }
  }, []);

  // 1. Adım: Okul Kurum Kodunu Doğrulama
  const handleVerifySchool = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = schoolKey.trim();
    if (!cleanKey) {
      toast.error('Lütfen okulunuzun MEBBİS Kurum Kodunu giriniz.');
      return;
    }

    setIsVerifyingSchool(true);
    const verifyToast = toast.loading('Okul kodu doğrulanıyor...');

    try {
      const res = await fetch(`/api/school-data?schoolKey=${cleanKey}&verifyOnly=true`);
      const data = await res.json();

      if (res.ok && data.success) {
        toast.dismiss(verifyToast);
        toast.success(`Okul doğrulandı: ${data.data?.schoolName || 'Okul Tanımlı'}`);
        
        setSchoolInfo({
          name: data.data?.schoolName || 'O*** T***',
          maskedSchoolKey: data.data?.maskedSchoolKey || (cleanKey.length > 2 ? `${cleanKey.slice(0, 2)}***` : '***')
        });

        if (typeof window !== 'undefined') {
          localStorage.setItem('last_school_key', cleanKey);
        }

        setStep(2);
      } else {
        toast.dismiss(verifyToast);
        toast.error(data.error || 'Bu kurum koduna ait aktif bir okul kaydı bulunamadı. Lütfen okul yöneticinizle iletişime geçiniz.');
      }
    } catch (err: any) {
      toast.dismiss(verifyToast);
      toast.error('Okul sorgulanırken bir hata oluştu: ' + err.message);
    } finally {
      setIsVerifyingSchool(false);
    }
  };

  // 2. Adım: Kullanıcı Adı ve Şifre ile Giriş
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Lütfen kullanıcı adı ve şifrenizi girin.');
      return;
    }

    setLoading(true);
    const loginToast = toast.loading('Giriş bilgileri doğrulanıyor...');

    try {
      const cachedTeachers = typeof window !== 'undefined' ? localStorage.getItem('school_teachers') : null;
      const parsedTeachers = cachedTeachers ? JSON.parse(cachedTeachers) : [];
      const storedSpreadsheetId = typeof window !== 'undefined' ? localStorage.getItem('active_spreadsheet_id') : null;
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('google_access_token') : null;

      const res = await fetch('/api/teacher-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolKey: schoolKey.trim(),
          username: username.trim(),
          password: password.trim(),
          cachedTeachers: parsedTeachers,
          spreadsheetId: storedSpreadsheetId,
          accessToken: storedToken
        })
      });

      const data = await res.json();

      if (res.ok && data.teacher) {
        if (data.teacher.spreadsheetId && typeof window !== 'undefined') {
          localStorage.setItem('active_spreadsheet_id', data.teacher.spreadsheetId);
        }

        if (Array.isArray(data.students) && data.students.length > 0 && typeof window !== 'undefined') {
          localStorage.setItem('school_students', JSON.stringify(data.students));
        }

        if (data.sessionToken && typeof window !== 'undefined') {
          localStorage.setItem('teacher_session_token', data.sessionToken);
        }

        localStorage.setItem('teacher_session', JSON.stringify({
          name: data.teacher.name || username.trim(),
          username: data.teacher.username || username.trim(),
          role: data.teacher.role || 'Öğretmen',
          classes: data.teacher.classes || [],
          isClassTeacher: data.teacher.isClassTeacher ?? false,
          isAdmin: data.teacher.isAdmin ?? false,
          schoolKey: schoolKey.trim(),
          schoolName: data.teacher.schoolName || schoolInfo?.name || '',
          sessionToken: data.sessionToken || '',
          loggedInAt: new Date().toISOString()
        }));

        toast.dismiss(loginToast);
        toast.success(`Hoş geldiniz, ${data.teacher.name || username}! Panelinize aktarılıyorsunuz...`);
        
        setTimeout(() => {
          window.location.href = '/teacher';
        }, 600);
      } else {
        toast.dismiss(loginToast);
        toast.error(data.error || 'Giriş bilgileri geçersiz.');
        setLoading(false);
      }
    } catch (err: any) {
      toast.dismiss(loginToast);
      toast.error('Giriş başarısız: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-indigo-700 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-6">
          <div className="bg-indigo-500/20 p-4 rounded-full inline-block mb-3">
            {step === 1 ? (
              <School className="w-12 h-12 text-indigo-300" />
            ) : (
              <BookOpen className="w-12 h-12 text-indigo-300" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Öğretmen Girişi</h1>
          <p className="text-indigo-200 text-xs">
            {step === 1 
              ? 'Lütfen önce okulunuzun MEBBİS Kurum Kodunu giriniz.' 
              : `${schoolInfo?.name || 'Okul Doğrulandı'} - Kullanıcı Girişi`}
          </p>
        </div>

        {step === 1 ? (
          /* 1. ADIM: OKUL KODU GİRİŞİ */
          <form onSubmit={handleVerifySchool} className="space-y-4">
            <div>
              <label className="block text-indigo-100 text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-amber-300" /> MEBBİS Kurum Kodu (Zorunlu)
              </label>
              <input 
                type="text" 
                value={schoolKey}
                onChange={(e) => setSchoolKey(e.target.value)}
                className="w-full bg-indigo-950/60 border border-indigo-400/40 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-indigo-300/40 text-sm font-mono tracking-wider text-center text-lg"
                placeholder="Örn: 765432"
                autoFocus
              />
              <p className="text-[11px] text-indigo-200/70 mt-1.5 text-center">
                * Okulunuzun 6 haneli MEBBİS kurum kodunu giriniz.
              </p>
            </div>

            <button
              type="submit"
              disabled={isVerifyingSchool || !schoolKey.trim()}
              className="w-full bg-white text-indigo-900 font-bold py-3.5 px-6 rounded-xl hover:bg-indigo-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
            >
              {isVerifyingSchool ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Okulu Doğrula ve Devam Et <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        ) : (
          /* 2. ADIM: KULLANICI ADI & ŞİFRE GİRİŞİ */
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Güvenli Maskeli Okul Özeti (F12 ile incelendiğinde dahi sadece maskeli değer görülür) */}
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3.5 flex items-center justify-between text-xs shadow-inner">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="truncate">
                  <div className="font-bold text-emerald-200 truncate max-w-[210px] tracking-wide text-[13px]">
                    {schoolInfo?.name || 'O*** T***'}
                  </div>
                  <div className="text-[11px] text-emerald-300/80 font-mono flex items-center gap-1.5 mt-0.5">
                    <span>Kurum Kodu:</span>
                    <span className="font-bold tracking-widest text-emerald-100 bg-emerald-900/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                      {schoolInfo?.maskedSchoolKey || (schoolKey.length > 2 ? `${schoolKey.slice(0, 2)}***` : '***')}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-[11px] text-amber-300 hover:text-amber-200 underline font-semibold flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
                title="Başka bir okul kodu ile giriş yapmak için tıklayın"
              >
                <ArrowLeft className="w-3 h-3" /> Değiştir
              </button>
            </div>

            <div>
              <label className="block text-indigo-100 text-xs font-medium mb-1.5">Kullanıcı Adı</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-indigo-950/50 border border-indigo-500/30 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-indigo-300/40 text-sm"
                placeholder="Örn: ogretmen12 veya ad.soyad"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-indigo-100 text-xs font-medium mb-1.5">Şifre</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-indigo-950/50 border border-indigo-500/30 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-indigo-300/40 text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-indigo-900 font-bold py-3.5 px-6 rounded-xl hover:bg-indigo-50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 shadow-lg"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Giriş Yap <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-indigo-500/20 text-center space-y-2">
          <p className="text-xs text-indigo-200/80">
            * Giriş bilgileriniz okul yöneticiniz tarafından WhatsApp ile iletilmiştir.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2 text-xs text-indigo-200">
            <Link href="/login" className="hover:text-white underline underline-offset-2">
              Yönetici Girişi
            </Link>
            <span>•</span>
            <Link href="/" className="hover:text-white">
              Ana Sayfa
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
