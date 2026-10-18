'use client';

import { useState, useEffect } from 'react';
import { 
  School, 
  BookOpen, 
  Key, 
  ShieldCheck, 
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';

function deduplicateClassesClient(classList: string[]): string[] {
  const getKey = (str: string) =>
    (str || '')
      .replace(/\([^)]*\)/g, '')
      .replace(/^ÖE[İI]U\s*-\s*/i, '')
      .replace(/Sınıf\s*Listesi.*$/i, '')
      .replace(/İ/g, 'i')
      .replace(/I/g, 'ı')
      .replace(/Ç/g, 'ç')
      .replace(/Ğ/g, 'ğ')
      .replace(/Ö/g, 'ö')
      .replace(/Ş/g, 'ş')
      .replace(/Ü/g, 'ü')
      .toLowerCase()
      .replace(/[^a-z0-9çğıöşü]/g, '');

  const map = new Map<string, string>();
  for (const raw of classList || []) {
    const trimmed = (raw || '').trim();
    if (!trimmed) continue;
    const key = getKey(trimmed);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing || trimmed.length > existing.length) {
      map.set(key, trimmed);
    }
  }
  return Array.from(map.values());
}

export default function TeacherProfilePage() {
  const [teacher, setTeacher] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isSavingPass, setIsSavingPass] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('teacher_session');
      if (!stored) {
        window.location.href = '/teacher/login';
        return;
      }
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.classes)) {
          parsed.classes = deduplicateClassesClient(parsed.classes);
        }
        setTeacher(parsed);
        setMounted(true);
      } catch (e) {
        window.location.href = '/teacher/login';
      }
    }
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPass = newPassword.trim();
    if (!cleanPass || cleanPass.length < 6) {
      toast.error('Yeni şifre en az 6 karakter olmalıdır.');
      return;
    }

    setIsSavingPass(true);
    const loadingToast = toast.loading('Şifreniz Google E-Tablo üzerinde güncelleniyor...');
    try {
      const storedSpreadsheetId = localStorage.getItem('active_spreadsheet_id') || teacher?.spreadsheetId || '';
      const storedToken = localStorage.getItem('google_access_token') || '';
      const sessionToken = localStorage.getItem('teacher_session_token') || teacher?.sessionToken || '';
      const schoolKey = teacher?.schoolKey || localStorage.getItem('last_school_key') || '';

      const res = await fetch('/api/teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {})
        },
        body: JSON.stringify({
          action: 'change-password',
          spreadsheetId: storedSpreadsheetId,
          schoolKey,
          sessionToken,
          originalUsername: teacher?.username || '',
          originalName: teacher?.name || '',
          newPassword: cleanPass
        })
      });

      const json = await res.json();
      toast.dismiss(loadingToast);

      if (!res.ok || !json.success) {
        toast.error(json.error || 'Şifre güncellenirken bir hata oluştu.');
        return;
      }

      // Yerel önbellekteki öğretmen listesinde de şifreyi güncelle
      const cachedTeachersRaw = localStorage.getItem('school_teachers');
      if (cachedTeachersRaw) {
        try {
          const list = JSON.parse(cachedTeachersRaw);
          if (Array.isArray(list)) {
            const updatedList = list.map((t: any) => {
              if (
                (t.username && teacher?.username && t.username.toLowerCase() === teacher.username.toLowerCase()) ||
                (t.name && teacher?.name && t.name.toLowerCase() === teacher.name.toLowerCase())
              ) {
                return { ...t, password: cleanPass };
              }
              return t;
            });
            localStorage.setItem('school_teachers', JSON.stringify(updatedList));
          }
        } catch (err) {}
      }

      toast.success(json.message || 'Şifreniz başarıyla güncellendi!');
      setIsChangingPass(false);
      setNewPassword('');
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error('Bağlantı hatası: ' + (err.message || 'Şifre değiştirilemedi.'));
    } finally {
      setIsSavingPass(false);
    }
  };

  if (!mounted || !teacher) {
    return null;
  }

  const isClassTeacher = Boolean(
    teacher?.isClassTeacher ||
    teacher?.role?.toLowerCase().includes('sınıf') ||
    teacher?.role?.toLowerCase().includes('rehber') ||
    teacher?.role?.toLowerCase().includes('özel eğitim')
  );

  const uniqueClasses = deduplicateClassesClient(
    teacher?.classes && teacher.classes.length > 0 ? teacher.classes : []
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Öğretmen Profilim</h1>
        <p className="text-slate-500 mt-1">Kişisel bilgileriniz, göreviniz ve sorumlu olduğunuz sınıflar.</p>
      </div>

      {/* Profil Kartı */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-2xl uppercase">
            {(teacher?.name || teacher?.username || 'Ö')[0]}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {teacher?.name || teacher?.username || 'Öğretmen Kullanıcı'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                {teacher?.role || 'Öğretmen'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                @{teacher?.username || 'kullanici'}
              </span>
            </div>
          </div>
        </div>

        {/* Detay Bilgileri */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-xs text-slate-400 font-medium block mb-1">Kurum</span>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <School className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{teacher?.schoolName || 'Okul Tanımlı'}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-xs text-slate-400 font-medium block mb-1">Yetki Seviyesi</span>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              {teacher?.isAdmin ? 'İdareci' : isClassTeacher ? 'Sınıf Rehber Öğretmeni' : 'Ders / Branş Öğretmeni'}
            </div>
          </div>
        </div>

        {/* Sorumlu Olduğu Sınıflar */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            Dersine Girdiğiniz Sınıflar ({uniqueClasses.length})
          </h3>
          <div className="space-y-2">
            {uniqueClasses.map((clsName: string, idx: number) => (
              <div key={idx} className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs font-semibold text-indigo-950 flex items-center justify-between">
                <span>{clsName}</span>
                <span className="text-indigo-600 text-[11px] font-normal">Aktif</span>
              </div>
            ))}
          </div>
        </div>

        {/* Şifre Değiştirme */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-slate-600" />
                Giriş Şifresi
              </h3>
              <p className="text-xs text-slate-400">Şifrenizi dilediğiniz zaman güncelleyebilirsiniz (E-Tabloya anında işlenir).</p>
            </div>
            {!isChangingPass && (
              <button
                type="button"
                onClick={() => setIsChangingPass(true)}
                className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3.5 py-2 rounded-xl font-semibold transition-colors"
              >
                Şifre Değiştir
              </button>
            )}
          </div>

          {isChangingPass && (
            <form onSubmit={handleUpdatePassword} className="mt-4 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Yeni Şifre (En az 6 karakter)</label>
                <div className="relative">
                  <input 
                    type={showPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Yeni şifrenizi giriniz"
                    disabled={isSavingPass}
                    className="w-full px-3.5 py-2 pr-10 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(prev => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSavingPass}
                  onClick={() => {
                    setIsChangingPass(false);
                    setNewPassword('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSavingPass}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {isSavingPass && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isSavingPass ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
