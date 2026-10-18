'use client';

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
import { School, ChevronDown, PlusCircle, AlertTriangle } from 'lucide-react';
import { useSessionTimeout } from '@/lib/useSessionTimeout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [schools, setSchools] = useState<any[]>([]);
  const [transferNotices, setTransferNotices] = useState<any[]>([]);
  const [currentSchoolKey, setCurrentSchoolKey] = useState<string>('');
  const [currentSchoolName, setCurrentSchoolName] = useState<string>('');
  const router = useRouter();
  const pathname = usePathname();

  useSessionTimeout({
    sessionKey: 'admin_session',
    logoutRedirectUrl: '/login',
    onLogout: () => {
      signOut(auth).catch(() => {});
      localStorage.removeItem('google_access_token');
    }
  });

  // Oturum koruması ve yöneticinin okullarını yükleme
  useEffect(() => {
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
      await signOut(auth);
      localStorage.removeItem('google_access_token');
      localStorage.removeItem('admin_active_school_key');
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
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm shadow-sm" title={auth.currentUser?.email || 'Yönetici'}>
              {auth.currentUser?.displayName ? auth.currentUser.displayName.charAt(0).toUpperCase() : 'Y'}
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
          {children}
        </main>
      </div>
    </div>
  );
}
