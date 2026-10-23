'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PdronOrb from '@/components/PdronOrb';
import { PdronLogo } from '@/components/AIAssistantWidget';
import { ShieldCheck, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

function SsoHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [statusText, setStatusText] = useState('Meram Mobil kimlik bilgileri alınıyor...');
  const [error, setError] = useState<string | null>(null);

  const schoolKey = searchParams.get('schoolKey') || '752927';
  const name = searchParams.get('name') || '';
  const email = searchParams.get('email') || '';
  const role = searchParams.get('role') || 'teacher';
  const uid = searchParams.get('uid') || '';
  const ts = searchParams.get('ts') || '';
  const sig = searchParams.get('sig') || '';
  const source = searchParams.get('source') || 'meram-mobil';

  useEffect(() => {
    let isCancelled = false;

    async function processSso() {
      if (!name) {
        setError('Kullanıcı kimlik bilgisi eksik. Lütfen Meram Mobil uygulamasından tekrar giriş yapınız.');
        return;
      }

      setStatusText(`Sayın ${name}, oturumunuz doğrulanıyor...`);

      try {
        const res = await fetch('/api/sso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolKey,
            name,
            email,
            role,
            uid,
            ts,
            sig,
            source
          })
        });

        const data = await res.json();

        if (isCancelled) return;

        if (!res.ok || !data.success) {
          setError(data.error || 'Oturum doğrulanamadı.');
          return;
        }

        setStatusText('Oturum hazırlandı, yönlendiriliyorsunuz...');

        if (data.role === 'admin') {
          // 1. Yönetici / Rehber Öğretmen Oturumu
          if (data.admin) {
            localStorage.setItem('sso_admin_session', JSON.stringify(data.admin));
          }
          if (data.schoolKey) {
            localStorage.setItem('admin_active_school_key', data.schoolKey);
          }
          if (data.spreadsheetId) {
            localStorage.setItem('active_spreadsheet_id', data.spreadsheetId);
          }

          // Ayrıca öğretmen paneline de tek tıkla geçebilmesi için öğretmen oturumunu hazırla
          if (data.teacher && data.teacherSessionToken) {
            localStorage.setItem('teacher_session_token', data.teacherSessionToken);
            localStorage.setItem('teacher_session', JSON.stringify({
              ...data.teacher,
              sessionToken: data.teacherSessionToken,
              loggedInAt: new Date().toISOString()
            }));
          }

          if (Array.isArray(data.students) && data.students.length > 0) {
            localStorage.setItem('school_students', JSON.stringify(data.students));
          }

          toast.success(`Hoş geldiniz Sayın ${name}! Yönetim paneline aktarılıyorsunuz...`, {
            icon: '🛡️',
            duration: 2500
          });

          setTimeout(() => {
            window.location.href = data.targetUrl || '/admin';
          }, 800);

        } else {
          // 2. Ders ve Sınıf Öğretmeni Oturumu
          if (data.sessionToken) {
            localStorage.setItem('teacher_session_token', data.sessionToken);
          }
          if (data.teacher) {
            localStorage.setItem('teacher_session', JSON.stringify({
              ...data.teacher,
              sessionToken: data.sessionToken,
              loggedInAt: new Date().toISOString()
            }));
            if (data.teacher.spreadsheetId) {
              localStorage.setItem('active_spreadsheet_id', data.teacher.spreadsheetId);
            }
          }
          if (Array.isArray(data.students) && data.students.length > 0) {
            localStorage.setItem('school_students', JSON.stringify(data.students));
          }

          toast.success(`Hoş geldiniz, ${data.teacher?.name || name}! Öğretmen paneline aktarılıyorsunuz...`, {
            icon: '👋',
            duration: 2500
          });

          setTimeout(() => {
            window.location.href = data.targetUrl || '/teacher';
          }, 800);
        }

      } catch (err: any) {
        if (!isCancelled) {
          console.error('SSO geçiş hatası:', err);
          setError('Sunucu bağlantısı sırasında bir hata oluştu: ' + err.message);
        }
      }
    }

    processSso();

    return () => {
      isCancelled = true;
    };
  }, [schoolKey, name, email, role, uid, source, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center space-y-6">
        
        {/* Holografik Orb & PDRON Logo */}
        <div className="relative">
          <PdronOrb size="xl" state={error ? 'idle' : 'thinking'} glow={true} />
        </div>

        <div>
          <PdronLogo theme="dark" size="lg" />
          <h2 className="text-xl font-bold text-white mt-1">
            Tek Tıkla Giriş (SSO)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Meram Özel Eğitim Uygulama Okulu III. Kademe (752927)
          </p>
        </div>

        {/* Durum / Yükleniyor veya Hata */}
        {!error ? (
          <div className="space-y-3 w-full">
            <div className="bg-slate-950/60 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
              <span className="text-xs font-semibold text-emerald-300">
                {statusText}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Oturumunuz Meram Mobil üzerinden güvenle doğrulanıyor ve ekranınız otomatik olarak açılıyor.
            </p>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-xs text-red-300 flex items-start gap-2.5 text-left">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => {
                window.location.href = '/teacher/login';
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              Standart Giriş Ekranına Git <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-slate-800/80 w-full flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>KVKK ve MEB Güvenli Oturum Protokolü</span>
        </div>

      </div>
    </div>
  );
}

export default function SsoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    }>
      <SsoHandler />
    </Suspense>
  );
}
