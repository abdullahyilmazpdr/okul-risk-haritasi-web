'use client';

import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 Dakika
const WARNING_BEFORE_MS = 2 * 60 * 1000; // 28. dakikada uyarı göster

interface InactivityConfig {
  sessionKey: 'teacher_session' | 'admin_session';
  logoutRedirectUrl: string;
  onLogout?: () => void;
}

export function useSessionTimeout({ sessionKey, logoutRedirectUrl, onLogout }: InactivityConfig) {
  const warningShownRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Son işlem zamanını güncelle
    const touchActivity = () => {
      const now = Date.now();
      localStorage.setItem(`${sessionKey}_last_active`, String(now));
      warningShownRef.current = false;
    };

    // İlk yüklemede henüz aktivite yoksa başlat
    if (!localStorage.getItem(`${sessionKey}_last_active`)) {
      touchActivity();
    }

    // Dinlenecek kullanıcı etkileşimleri
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const handleUserActivity = () => {
      touchActivity();
    };

    events.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Periyodik kontrol (Her 15 saniyede bir)
    const interval = setInterval(() => {
      const storedLast = localStorage.getItem(`${sessionKey}_last_active`);
      if (!storedLast) return;

      const lastActive = parseInt(storedLast, 10);
      const elapsed = Date.now() - lastActive;

      // 28. dakikada uyarı
      if (elapsed > (INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS) && !warningShownRef.current) {
        warningShownRef.current = true;
        toast('Hareketsizlik nedeniyle oturumunuz 2 dakika içinde sonlandırılacaktır.', {
          icon: '⚠️',
          duration: 8000,
          id: 'session-timeout-warning'
        });
      }

      // 30 dakika dolduysa oturumu kapat
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        clearInterval(interval);
        localStorage.removeItem(sessionKey);
        localStorage.removeItem(`${sessionKey}_last_active`);
        if (sessionKey === 'teacher_session') {
          localStorage.removeItem('active_spreadsheet_id');
        }

        toast.error('30 dakika boyunca işlem yapmadığınız için oturumunuz güvenlik nedeniyle sonlandırıldı.', {
          duration: 4000,
          id: 'session-expired'
        });

        if (onLogout) {
          onLogout();
        }

        setTimeout(() => {
          window.location.href = logoutRedirectUrl;
        }, 1200);
      }
    }, 15000);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      clearInterval(interval);
    };
  }, [sessionKey, logoutRedirectUrl, onLogout]);
}
