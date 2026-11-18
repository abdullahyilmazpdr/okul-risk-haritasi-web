'use client';

import { useState } from 'react';
import { ClipboardCheck, ExternalLink, Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import toast from 'react-hot-toast';

export default function RibaSwitchButton({ role }: { role: 'admin' | 'teacher' }) {
  const [loading, setLoading] = useState(false);

  const handleGoRiba = async () => {
    setLoading(true);
    try {
      let schoolKey = '';
      let adminUid = '';
      let sessionToken = '';
      const googleToken = localStorage.getItem('google_access_token') || '';

      if (role === 'admin') {
        schoolKey = localStorage.getItem('admin_active_school_key') || '';
        const ssoRaw = localStorage.getItem('sso_admin_session');
        const sso = ssoRaw ? JSON.parse(ssoRaw) : null;
        adminUid = auth.currentUser?.uid || sso?.uid || '';
      } else {
        const tRaw = localStorage.getItem('teacher_session');
        const tSess = tRaw ? JSON.parse(tRaw) : null;
        schoolKey = tSess?.schoolKey || '';
        sessionToken = localStorage.getItem('teacher_session_token') || '';
      }

      const res = await fetch('/api/riba-sso-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(googleToken ? { Authorization: `Bearer ${googleToken}` } : {}),
          ...(sessionToken ? { 'x-session-token': sessionToken } : {}),
        },
        body: JSON.stringify({ role, schoolKey, adminUid, sessionToken }),
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'RİBA bağlantısı oluşturulamadı.');
      }

      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err?.message || 'RİBA geçişi başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pb-2">
      <button
        type="button"
        onClick={handleGoRiba}
        disabled={loading}
        className={`flex items-center justify-between gap-2 px-3 py-2.5 w-full rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-60 ${
          role === 'admin'
            ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30'
            : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30'
        }`}
      >
        <span className="flex items-center gap-2">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <ClipboardCheck className="w-4 h-4 shrink-0" />
          )}
          <span>RİBA Uygulamasına Geç</span>
        </span>
        <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-80" />
      </button>
    </div>
  );
}
