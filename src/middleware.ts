import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Sadece korumalı rotaları kontrol et
  if (pathname.startsWith('/admin') || pathname.startsWith('/teacher')) {
    // Giriş sayfalarını atla
    if (pathname === '/admin/login' || pathname === '/login' || pathname === '/teacher/login') {
      return NextResponse.next();
    }

    // İstemci tarafında kaydedilen cookie'yi kontrol et (Gerçekte Firebase Session Cookie kullanılır)
    // Şimdilik demo amaçlı basit bir kontrol yapısı bırakıyoruz
    // const session = request.cookies.get('session');
    
    // if (!session) {
    //   const loginUrl = pathname.startsWith('/teacher') ? '/teacher/login' : '/login';
    //   return NextResponse.redirect(new URL(loginUrl, request.url));
    // }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*'],
};
