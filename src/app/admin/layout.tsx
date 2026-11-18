'use client';

import RibaSwitchButton from '@/components/RibaSwitchButton';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { 
  LayoutDashboard, 
  UploadCloud, 
  FileSpreadsheet, 
  Users, 
  Settings, 
  LogOut,
  Menu,
  X,
  BookOpen
} from 'lucide-react';
import toast from 'react-hot-toast';

const navigation = [
  { name: 'Genel Bakış', href: '/admin', icon: LayoutDashboard },
  { name: '1. Okul Tanımlama', href: '/admin/settings', icon: Settings },
  { name: '2. Veri Yükleme', href: '/admin/upload', icon: UploadCloud },
  { name: 'Risk Haritası', href: '/admin/risk-map', icon: FileSpreadsheet },
  { name: 'ŞÖK Modülü', href: '/admin/sok', icon: Users },
  { name: 'Kullanım Kılavuzu', href: '/rehber?tab=admin', icon: BookOpen },
];

function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 px-4 space-y-1">
      {navigation.map((item) => {
        const isActive = pathname === item.href.split('?')[0];
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isActive 
                ? 'bg-blue-600 text-white' 
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="font-medium">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

import { getSchoolsByAdmin, getSchoolData, checkTransferNotification, dismissTransferNotification } from '@/lib/db';
import { School, ChevronDown, PlusCircle, AlertTriangle, UserPlus, CheckCircle2 } from 'lucide-react';
import { useSessionTimeout } from '@/lib/useSessionTimeout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [schools, setSchools] = useState<any[]>([]);
  const [transferNotices, setTransferNotices] = useState<any[]>([]);
  const [teacherAddedNotices, setTeacherAddedNotices] = useState<Array<{
    number: string;
    name: string;
    className: string;
    gender: string;
    teacherName: string;
    addedAt: string;
    isPending: boolean;
  }>>([]);
  const [isAckingAdditions, setIsAckingAdditions] = useState(false);
  const [currentSchoolKey, setCurrentSchoolKey] = useState<string>('');
  const [currentSchoolName, setCurrentSchoolName] = useState<string>('');
  const [ssoAdminInfo, setSsoAdminInfo] = useState<any>(null);
  const router = useRouter();
  const pathname = usePathname();

  useSessionTimeout({
    sessionKey: 'admin_session',
    logoutRedirectUrl: '/login',
    onLogout: () => {
      signOut(auth).catch(() => {});
      localStorage.removeItem('google_access_token');
      localStorage.removeItem('sso_admin_session');
    }
  });

  // Oturum koruması ve yöneticinin okullarını yükleme
  useEffect(() => {
    // 1. Meram Mobil veya harici SSO üzerinden gelen Yönetici / Rehber Öğretmen kontrolü
    const ssoAdminStr = typeof window !== 'undefined' ? localStorage.getItem('sso_admin_session') : null;
    if (ssoAdminStr) {
      try {
        const ssoAdmin = JSON.parse(ssoAdminStr);
        if (ssoAdmin && ssoAdmin.schoolKey) {
          setSsoAdminInfo(ssoAdmin);
          setCurrentSchoolKey(ssoAdmin.schoolKey);
          setCurrentSchoolName(ssoAdmin.schoolName || 'Meram Özel Eğitim Uygulama Okulu III. Kademe');
          localStorage.setItem('admin_active_school_key', ssoAdmin.schoolKey);
          if (ssoAdmin.spreadsheetId) {
            localStorage.setItem('active_spreadsheet_id', ssoAdmin.spreadsheetId);
          }
          setSchools([ssoAdmin]);
          return; // SSO yöneticisi başarıyla yetkilendirildi
        }
      } catch (e) {
        console.warn('SSO oturumu okunamadı:', e);
      }
    }

    // 2. Standart Google / Firebase Girişi Kontrolü
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('google_access_token') : null;
      if (!user || !token) {
        toast.error("Oturum süreniz dolmuştur. Giriş sayfasına yönlendiriliyorsunuz...", {
          id: 'admin-auth-guard',
          duration: 3000,
          icon: '⏳'
        });
        setTimeout(() => {
          router.push('/login');
        }, 1200);
        return;
      }

      // Kullanıcının kayıtlı okullarını çek
      try {
        const list = (await getSchoolsByAdmin(user.uid)).filter(
          (s: any) => s.schoolKey && s.schoolKey !== 'DEFAULT'
        );
        setSchools(list);
        
        const activeKey = localStorage.getItem('admin_active_school_key');
        let selected = list.find((s: any) => s.schoolKey === activeKey);
        if (!selected && list.length > 0) {
          selected = list[0];
        }

        if (selected) {
          setCurrentSchoolKey(selected.schoolKey || '');
          setCurrentSchoolName(selected.schoolName || 'Okul Tanımlı');
          localStorage.setItem('admin_active_school_key', selected.schoolKey || '');
          if (selected.spreadsheetId) {
            localStorage.setItem('active_spreadsheet_id', selected.spreadsheetId);
          } else {
            localStorage.removeItem('active_spreadsheet_id');
          }
        } else {
          // Henüz hiç okul tanımlanmamışsa (İlk kez giriş yapan yönetici):
          // İlk adım MEBBİS Kodu ile Okul Tanımlama olduğu için doğrudan /admin/settings sayfasına yönlendir
          setCurrentSchoolKey('');
          setCurrentSchoolName('');
          localStorage.removeItem('admin_active_school_key');
          localStorage.removeItem('active_spreadsheet_id');
          if (pathname && pathname !== '/admin/settings') {
            toast("İlk adım olarak lütfen okulunuzun MEBBİS Kurum Kodunu ve adını tanımlayın.", {
              id: 'first-step-school-guide',
              icon: '🏫',
              duration: 4000
            });
            router.push('/admin/settings');
          }
        }

        // Eski yönetici ise, devredilen okulları için bildirim var mı kontrol et
        try {
          const notices = await checkTransferNotification(user.uid);
          setTransferNotices(notices);
        } catch (noticeErr) {}
      } catch (err) {
        console.warn("Okullar listesi alınırken hata:", err);
      }
    });

    return () => unsubscribe();
  }, [router, pathname]);

  // Öğretmen tarafından sınıfa yeni eklenen öğrenciler için yönetici bildirimlerini yükle
  useEffect(() => {
    if (!currentSchoolKey || typeof window === 'undefined') return;
    const spreadsheetId = localStorage.getItem('active_spreadsheet_id') || ssoAdminInfo?.spreadsheetId || '';
    if (!spreadsheetId) return;

    const googleToken = localStorage.getItem('google_access_token') || '';
    const sessionToken = localStorage.getItem('teacher_session_token') || '';
    const adminUid = auth.currentUser?.uid || ssoAdminInfo?.uid || '';
    if (!googleToken && !sessionToken && !adminUid) return;

    const url = new URL('/api/school-data', window.location.origin);
    url.searchParams.set('schoolKey', currentSchoolKey);
    url.searchParams.set('spreadsheetId', spreadsheetId);
    if (adminUid) url.searchParams.set('adminUid', adminUid);

    fetch(url.toString(), {
      headers: {
        ...(googleToken ? { 'Authorization': `Bearer ${googleToken}` } : {}),
        ...(sessionToken ? { 'x-session-token': sessionToken } : {})
      }
    })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.data?.teacherAddedStudents && Array.isArray(json.data.teacherAddedStudents)) {
          setTeacherAddedNotices(json.data.teacherAddedStudents.filter((item: any) => item.isPending));
        }
      })
      .catch(() => {});
  }, [currentSchoolKey, ssoAdminInfo, pathname]);

  const handleAcknowledgeTeacherAdditions = async (targetNumbers?: string[]) => {
    if (typeof window === 'undefined') return;
    setIsAckingAdditions(true);
    try {
      const spreadsheetId = localStorage.getItem('active_spreadsheet_id') || ssoAdminInfo?.spreadsheetId || '';
      const googleToken = localStorage.getItem('google_access_token') || '';
      const sessionToken = localStorage.getItem('teacher_session_token') || '';
      const adminUid = auth.currentUser?.uid || ssoAdminInfo?.uid || '';

      const res = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(googleToken ? { 'Authorization': `Bearer ${googleToken}` } : {}),
          ...(sessionToken ? { 'x-session-token': sessionToken } : {})
        },
        body: JSON.stringify({
          action: 'acknowledge-teacher-added',
          schoolKey: currentSchoolKey,
          spreadsheetId,
          adminUid,
          sessionToken,
          numbers: targetNumbers
        })
      });
      if (res.ok) {
        if (targetNumbers && targetNumbers.length > 0) {
          const ackSet = new Set(targetNumbers.map(String));
          setTeacherAddedNotices(prev => prev.filter(n => !ackSet.has(String(n.number))));
        } else {
          setTeacherAddedNotices([]);
        }
        toast.success('Öğretmen tarafından eklenen öğrenci bildirimi onaylandı.');
      }
    } catch (err) {
      toast.error('Bildirim güncellenemedi.');
    } finally {
      setIsAckingAdditions(false);
    }
  };

  const handleSelectSchool = (newKey: string) => {
    if (newKey === '__add_new__') {
      router.push('/admin/settings?newSchool=true');
      return;
    }
    const target = schools.find((s: any) => s.schoolKey === newKey);
    if (target) {
      setCurrentSchoolKey(target.schoolKey);
      setCurrentSchoolName(target.schoolName || 'Okul');
      localStorage.setItem('admin_active_school_key', target.schoolKey);
      if (target.spreadsheetId) {
        localStorage.setItem('active_spreadsheet_id', target.spreadsheetId);
      } else {
        localStorage.removeItem('active_spreadsheet_id');
      }
      toast.success(`${target.schoolName || 'Okul'} seçildi. Sayfa güncelleniyor...`);
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth).catch(() => {});
      localStorage.removeItem('google_access_token');
      localStorage.removeItem('admin_active_school_key');
      localStorage.removeItem('sso_admin_session');
      toast.success("Başarıyla çıkış yapıldı.");
      router.push('/login');
    } catch (error) {
      console.error('Çıkış yaparken hata:', error);
      toast.error("Çıkış yapılırken bir sorun oluştu.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950">
          <span className="text-white font-bold text-lg">Yönetim Paneli</span>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="py-4 flex flex-col h-[calc(100vh-4rem)]">
          <Suspense fallback={<div className="flex-1 px-4" />}>
            <AdminNav />
          </Suspense>
          <RibaSwitchButton role="admin" />
          <div className="p-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Çıkış Yap</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-500 lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Okul Seçici (Multi-School Switcher) */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
              <School className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-slate-500 hidden sm:inline font-medium">Aktif Okul:</span>
              <select
                value={currentSchoolKey || ''}
                onChange={(e) => handleSelectSchool(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer max-w-[200px] sm:max-w-[320px] truncate"
              >
                {schools.length === 0 ? (
                  <option value="">Henüz Okul Eklenmedi</option>
                ) : (
                  schools.map((s) => (
                    <option key={s.schoolKey} value={s.schoolKey}>
                      {s.schoolName || 'İsimsiz Okul'} ({s.schoolKey})
                    </option>
                  ))
                )}
                <option value="__add_new__">+ Yeni Okul Tanımla...</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div 
              className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm shadow-sm" 
              title={ssoAdminInfo ? `${ssoAdminInfo.name} (${ssoAdminInfo.email})` : (auth.currentUser?.email || 'Yönetici')}
            >
              {ssoAdminInfo?.name ? ssoAdminInfo.name.charAt(0).toUpperCase() : (auth.currentUser?.displayName ? auth.currentUser.displayName.charAt(0).toUpperCase() : 'Y')}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6">
          {transferNotices.length > 0 && (
            <div className="space-y-3">
              {transferNotices.map((n) => (
                <div key={n.id} className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 space-y-1">
                      <p className="font-bold">
                        Kurum Yetkisi Devredildi: {n.schoolName || n.schoolKey} ({n.schoolKey})
                      </p>
                      <p className="text-amber-800">
                        Bu kurumun yönetim yetkileri, resmi MEB kurumsal e-posta adresi (<strong>{n.schoolKey}@meb.k12.tr</strong>) üzerinden gönderilen onay kodu ile 
                        doğrulanarak yeni yöneticiye (<strong className="font-mono">{n.newOwnerEmailMasked}</strong>) devredilmiştir. 
                        Bir hata olduğunu düşünüyorsanız okul idareniz ile irtibata geçebilirsiniz.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await dismissTransferNotification(n.id);
                      setTransferNotices(prev => prev.filter(item => item.id !== n.id));
                    }}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg shrink-0 transition-colors"
                  >
                    Anladım, Kapat
                  </button>
                </div>
              ))}
            </div>
          )}
          {teacherAddedNotices.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-emerald-50 border border-indigo-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl shrink-0">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-indigo-950">
                      Öğretmen Tarafından Sınıfa Yeni Öğrenci Eklendi ({teacherAddedNotices.length} Bildirim)
                    </h3>
                    <p className="text-xs text-indigo-800 mt-0.5">
                      Sınıf ekranından öğretmenleriniz tarafından aşağıdaki öğrenciler listeye eklenmiştir.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href="/admin/upload"
                    className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Öğrenci Listesini Aç
                  </Link>
                  <button
                    onClick={() => handleAcknowledgeTeacherAdditions()}
                    disabled={isAckingAdditions}
                    className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Tümünü Gördüm / Onayla
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {teacherAddedNotices.map((item) => (
                  <div
                    key={item.number}
                    className="bg-white/90 border border-indigo-100 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">
                        {item.number} - {item.name}
                      </p>
                      <p className="text-[11px] text-slate-600 truncate">
                        <span className="font-semibold text-indigo-700">{item.className}</span>
                        {' • '}Ekleyen: <strong>{item.teacherName}</strong>
                        {item.addedAt ? ` (${item.addedAt})` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAcknowledgeTeacherAdditions([item.number])}
                      disabled={isAckingAdditions}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0 transition-colors"
                    >
                      Onayla
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
