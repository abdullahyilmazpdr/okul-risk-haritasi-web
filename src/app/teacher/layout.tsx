'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  BookOpen, 
  LogOut,
  Menu,
  X,
  UserCheck,
  HelpCircle
} from 'lucide-react';
import { useSessionTimeout } from '@/lib/useSessionTimeout';

const navigation = [
  { name: 'Sınıflarım', href: '/teacher', icon: BookOpen },
  { name: 'Profilim', href: '/teacher/profile', icon: UserCheck },
  { name: 'Kullanım Kılavuzu', href: '/rehber?tab=teacher', icon: HelpCircle },
];

function TeacherNav() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 px-4 space-y-1">
      {navigation.map((item) => {
        const cleanHref = item.href.split('?')[0];
        const isActive = pathname === cleanHref || (cleanHref !== '/teacher' && pathname?.startsWith(cleanHref + '/'));
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isActive 
                ? 'bg-indigo-600 text-white' 
                : 'hover:bg-indigo-800 hover:text-white'
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

function TeacherUserBadge() {
  const pathname = usePathname();
  const [teacherSession, setTeacherSession] = useState<{ username: string; role: string; name?: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const updateSession = () => {
      const stored = localStorage.getItem('teacher_session');
      if (stored) {
        try {
          setTeacherSession(JSON.parse(stored));
        } catch (e) {}
      } else {
        setTeacherSession(null);
      }
    };

    updateSession();
    window.addEventListener('storage', updateSession);
    window.addEventListener('focus', updateSession);
    return () => {
      window.removeEventListener('storage', updateSession);
      window.removeEventListener('focus', updateSession);
    };
  }, [pathname]);

  if (!mounted) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-right hidden md:block">
          <span className="text-sm font-semibold text-slate-800 block">Öğretmen Kullanıcı</span>
          <span className="text-xs text-indigo-600 font-medium">Öğretmen</span>
        </div>
        <div className="w-9 h-9 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold uppercase text-sm">
          Ö
        </div>
      </div>
    );
  }

  const isAdmin = Boolean((teacherSession as any)?.isAdmin || teacherSession?.role?.toLowerCase().includes('müdür') || teacherSession?.role?.toLowerCase().includes('idare'));
  const isClassTeacher = Boolean((teacherSession as any)?.isClassTeacher || teacherSession?.role?.toLowerCase().includes('sınıf') || teacherSession?.role?.toLowerCase().includes('rehber') || teacherSession?.role?.toLowerCase().includes('özel eğitim'));

  return (
    <div className="flex items-center gap-3">
      <div className="text-right hidden md:block">
        <span className="text-sm font-semibold text-slate-800 block">
          {(teacherSession as any)?.name || teacherSession?.username || 'Öğretmen Kullanıcı'}
        </span>
        <span className={`text-xs font-semibold ${
          isAdmin 
            ? 'text-amber-600' 
            : isClassTeacher 
            ? 'text-emerald-600' 
            : 'text-indigo-600'
        }`}>
          {isAdmin 
            ? 'Müdür Yardımcısı' 
            : isClassTeacher 
            ? 'Sınıf Rehber Öğretmeni' 
            : (teacherSession?.role || 'Ders Öğretmeni')}
        </span>
      </div>
      <div className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold uppercase text-sm ${
        isAdmin 
          ? 'bg-amber-100 border-amber-300 text-amber-800' 
          : isClassTeacher 
          ? 'bg-emerald-100 border-emerald-300 text-emerald-800' 
          : 'bg-indigo-100 border-indigo-200 text-indigo-700'
      }`}>
        {(((teacherSession as any)?.name || teacherSession?.username || 'Ö')[0])}
      </div>
    </div>
  );
}

function TeacherLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useSessionTimeout({
    sessionKey: 'teacher_session',
    logoutRedirectUrl: '/teacher/login'
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (pathname === '/teacher/login') {
        setAuthorized(true);
        return;
      }
      const stored = localStorage.getItem('teacher_session');
      if (!stored) {
        window.location.href = '/teacher/login';
        return;
      }
      setAuthorized(true);
    }
  }, [pathname]);

  // Giriş sayfasında sidebar ve dashboard header gösterilmez
  if (pathname === '/teacher/login') {
    return <>{children}</>;
  }

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('teacher_session');
      window.location.href = '/teacher/login';
    }
  };

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-xs font-medium">Oturum kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

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
        fixed inset-y-0 left-0 z-50 w-64 bg-indigo-900 text-indigo-100 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-6 bg-indigo-950">
          <span className="text-white font-bold text-lg">Öğretmen Paneli</span>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="w-5 h-5 text-indigo-400" />
          </button>
        </div>
        <div className="py-4 flex flex-col h-[calc(100vh-4rem)]">
          <Suspense fallback={<div className="flex-1 px-4" />}>
            <TeacherNav />
          </Suspense>
          <div className="p-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-rose-300 hover:bg-rose-500/20 transition-colors"
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
          <div className="flex-1" />
          <Suspense fallback={
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <span className="text-sm font-semibold text-slate-800 block">Öğretmen Kullanıcı</span>
                <span className="text-xs text-indigo-600 font-medium">Öğretmen</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold uppercase text-sm">
                Ö
              </div>
            </div>
          }>
            <TeacherUserBadge />
          </Suspense>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TeacherLayoutContent>{children}</TeacherLayoutContent>
    </Suspense>
  );
}
