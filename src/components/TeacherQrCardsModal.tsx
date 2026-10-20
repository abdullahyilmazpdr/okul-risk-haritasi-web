'use client';

import { useState, useEffect } from 'react';
import { X, Printer, QrCode, Shield, School, KeyRound, UserCheck } from 'lucide-react';
import QRCode from 'qrcode';

interface TeacherQrCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: any[];
  schoolKey: string;
  schoolName: string;
}

export default function TeacherQrCardsModal({
  isOpen,
  onClose,
  teachers,
  schoolKey,
  schoolName
}: TeacherQrCardsModalProps) {
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !teachers || teachers.length === 0) return;

    const generateQrs = async () => {
      const map: Record<string, string> = {};
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

      for (const t of teachers) {
        const u = t.username || '';
        const loginUrl = `${currentOrigin}/teacher/login?schoolKey=${encodeURIComponent(schoolKey || '')}&username=${encodeURIComponent(u)}`;
        try {
          const dataUrl = await QRCode.toDataURL(loginUrl, {
            width: 140,
            margin: 1,
            color: {
              dark: '#1e1b4b',
              light: '#ffffff'
            }
          });
          map[u || t.name] = dataUrl;
        } catch (e) {
          console.warn('QR kod oluşturulamadı:', e);
        }
      }
      setQrMap(map);
    };

    generateQrs();
  }, [isOpen, teachers, schoolKey]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 print:shadow-none print:border-none print:max-h-none print:max-w-none my-6">
        
        {/* Üst Başlık ve Yazdır Butonları (Yazdırmada Gizlenir) */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white rounded-t-2xl print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Öğretmen Giriş Kartları ve Karekod Listesi</h2>
              <p className="text-xs text-slate-300">
                Her öğretmen için kişisel QR kod üretildi. Yazdırıp öğretmenler odasında teslim edebilirsiniz.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              Yazdır / PDF İndir
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bilgilendirme Şeridi (Yazdırmada Gizlenir) */}
        <div className="bg-amber-50 border-b border-amber-200 p-3.5 text-xs text-amber-900 flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>KVKK ve Güvenlik Bilgisi:</strong> Karekodlar okul kodu ve kullanıcı adını otomatik tanır; ancak öğrenci verilerini korumak amacıyla şifre karekoda gömülmemiştir. Öğretmen kendi şifresini yazarak güvenle giriş yapar.
            </span>
          </div>
          <span className="font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md shrink-0">
            {teachers.length} Öğretmen Kartı
          </span>
        </div>

        {/* Yazdırılabilir Kartlar Alanı */}
        <div className="p-6 overflow-y-auto print:p-2 print:overflow-visible flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
            {teachers.map((t, idx) => {
              const qrUrl = qrMap[t.username || t.name];
              const classesStr = Array.isArray(t.classes) && t.classes.length > 0 ? t.classes.join(', ') : 'Tüm Okul';

              return (
                <div
                  key={idx}
                  className="border-2 border-dashed border-slate-300 rounded-2xl p-4 bg-white flex flex-col justify-between shadow-xs hover:border-indigo-400 transition-colors page-break-inside-avoid print:border-slate-400 print:p-3.5"
                >
                  {/* Kart Üst Bilgisi */}
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                        <School className="w-3.5 h-3.5" />
                        <span>{schoolName || 'Okul Risk Haritası & ŞÖK'}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        Kurum: {schoolKey}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 text-sm">{t.name}</h3>
                        <p className="text-xs text-indigo-700 font-semibold mt-0.5">
                          {t.roleOrBranch || 'Ders Öğretmeni'}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                          <strong>Sınıflar:</strong> {classesStr}
                        </p>
                      </div>

                      {/* QR Kod Görseli */}
                      <div className="flex flex-col items-center shrink-0">
                        {qrUrl ? (
                          <img
                            src={qrUrl}
                            alt={`${t.name} QR Kod`}
                            className="w-20 h-20 border border-slate-200 rounded-lg p-0.5 bg-white shadow-xs"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-[10px] text-slate-400">
                            QR...
                          </div>
                        )}
                        <span className="text-[9px] font-semibold text-slate-500 mt-0.5 text-center">
                          Kameradan Okutun
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Kart Alt Bilgisi (Giriş Kutusu) */}
                  <div className="mt-3 pt-2.5 border-t border-slate-200 bg-slate-50/80 rounded-xl p-2.5 text-xs text-slate-700 space-y-1 print:bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">Kullanıcı Adı:</span>
                      <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs">
                        {t.username}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">Giriş Şifresi:</span>
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs">
                        {t.password || '******'}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 pt-1 border-t border-slate-200 flex items-center gap-1 justify-center">
                      <KeyRound className="w-2.5 h-2.5 text-slate-400" />
                      Giriş Adresi: <span className="font-mono">{origin ? `${origin}/teacher/login` : '/teacher/login'}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
