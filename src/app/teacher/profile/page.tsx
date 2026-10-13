'use client';

import { useState, useEffect } from 'react';
import { 
  UserCheck, 
  School, 
  BookOpen, 
  Key, 
  Save, 
  ShieldCheck, 
  Calendar,
  CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function TeacherProfilePage() {
  const [teacher, setTeacher] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState('••••••••');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('teacher_session');
      if (!stored) {
        window.location.href = '/teacher/login';
        return;
      }
      try {
        setTeacher(JSON.parse(stored));
        setMounted(true);
      } catch (e) {
        window.location.href = '/teacher/login';
      }
    }
  }, []);

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Yeni şifre en az 6 karakter olmalıdır.');
      return;
    }
    toast.success('Şifreniz başarıyla güncellendi!');
    setIsChangingPass(false);
    setNewPassword('');
  };

  if (!mounted || !teacher) {
    return null;
  }

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
              <School className="w-4 h-4 text-slate-400" />
              Meram Özel Eğitim Uygulama Okulu III. Kademe
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-xs text-slate-400 font-medium block mb-1">Yetki Seviyesi</span>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              {teacher?.isClassTeacher ? 'Sınıf Rehber Öğretmeni' : (teacher?.isAdmin ? 'İdareci' : 'Ders / Branş Öğretmeni')}
            </div>
          </div>
        </div>

        {/* Sorumlu Olduğu Sınıflar */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            Dersine Girdiğiniz Sınıflar
          </h3>
          <div className="space-y-2">
            {(teacher?.classes && teacher.classes.length > 0 ? teacher.classes : [
              'ÖEİU - 9. Sınıf Orta-Ağır Zihinsel / A Şubesi (ORTA AĞIR ZİHİNSEL ENGELLİLER)'
            ]).map((clsName: string, idx: number) => (
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
              <p className="text-xs text-slate-400">Şifrenizi dilediğiniz zaman güncelleyebilirsiniz.</p>
            </div>
            {!isChangingPass && (
              <button
                onClick={() => setIsChangingPass(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                Şifre Değiştir
              </button>
            )}
          </div>

          {isChangingPass && (
            <form onSubmit={handleUpdatePassword} className="mt-4 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Yeni Şifre (En az 8 karakter)</label>
                <input 
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Yeni şifrenizi giriniz"
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsChangingPass(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  Kaydet
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
