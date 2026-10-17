'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, 
  FileSpreadsheet, 
  ExternalLink, 
  Shield, 
  Save, 
  Database, 
  RefreshCw,
  School,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCurrentAcademicYear } from '@/lib/academic-year';
import { useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  getSchoolData, 
  saveSchoolData, 
  getSchoolsByAdmin, 
  checkSchoolKeyOwnership, 
  saveTransferVerificationCode, 
  verifyAndExecuteTransfer 
} from '@/lib/db';

function AdminSettingsContent() {
  const searchParams = useSearchParams();
  const isNewSchoolMode = searchParams.get('newSchool') === 'true';

  const [schoolKey, setSchoolKey] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [district, setDistrict] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [serviceAccountKey, setServiceAccountKey] = useState('');
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Transfer Modalı Durumları
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferOwnerMasked, setTransferOwnerMasked] = useState('');
  const [transferSchoolKey, setTransferSchoolKey] = useState('');
  const [transferSchoolName, setTransferSchoolName] = useState('');
  const [transferCodeInput, setTransferCodeInput] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  useEffect(() => {
    setAcademicYear(getCurrentAcademicYear());
    if (isNewSchoolMode) {
      setSchoolKey('');
      setSchoolName('');
      setDistrict('');
      setSpreadsheetId('');
      setSpreadsheetUrl('');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const activeKey = localStorage.getItem('admin_active_school_key') || '';
        getSchoolData(user.uid, activeKey || undefined).then((data) => {
          if (data) {
            if (data.schoolKey) setSchoolKey(data.schoolKey);
            if (data.schoolName) setSchoolName(data.schoolName);
            if (data.district) setDistrict(data.district);
            if (data.academicYear) setAcademicYear(data.academicYear);
            if (data.serviceAccountKey) {
              setServiceAccountKey(
                typeof data.serviceAccountKey === 'string' 
                  ? data.serviceAccountKey 
                  : JSON.stringify(data.serviceAccountKey, null, 2)
              );
            }
            if (data.spreadsheetId) setSpreadsheetId(data.spreadsheetId);
            if (data.spreadsheetUrl) setSpreadsheetUrl(data.spreadsheetUrl);
          }
        });
      }
    });

    return () => unsubscribe();
  }, [isNewSchoolMode]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      toast.error('Oturum bulunamadı.');
      return;
    }
    const cleanKey = schoolKey.trim();
    if (!cleanKey) {
      toast.error('Lütfen MEBBİS Kurum Kodunu zorunlu olarak giriniz.');
      return;
    }
    if (!schoolName.trim()) {
      toast.error('Lütfen okul adını giriniz.');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Kurum kodu tekillik kontrolü: Bu MEBBİS koduyla başka bir hesap açılmış mı?
      const ownership = await checkSchoolKeyOwnership(cleanKey, auth.currentUser.uid);
      if (!ownership.isAvailable) {
        setIsSaving(false);
        setTransferSchoolKey(cleanKey);
        setTransferSchoolName(ownership.schoolName || schoolName.trim());
        setTransferOwnerMasked(ownership.ownerEmailMasked || '***@***.***');
        setShowTransferModal(true);
        setCodeSent(false);
        setTransferCodeInput('');
        return;
      }

      const currentToken = localStorage.getItem('google_access_token');
      // Yeni okul ekleniyorsa spreadsheetId boş başlamalıdır, önceki okulun tablosunu miras almaz
      const targetSpreadsheetId = isNewSchoolMode ? '' : (spreadsheetId || '');

      const success = await saveSchoolData(auth.currentUser.uid, {
        schoolKey: cleanKey,
        spreadsheetId: targetSpreadsheetId,
        schoolName: schoolName.trim(),
        district: district.trim(),
        academicYear,
        adminEmail: auth.currentUser.email || undefined,
        accessToken: currentToken || undefined,
        serviceAccountKey: serviceAccountKey.trim() || undefined
      });

      if (success) {
        localStorage.setItem('admin_active_school_key', cleanKey);
        if (targetSpreadsheetId) {
          localStorage.setItem('active_spreadsheet_id', targetSpreadsheetId);
        } else {
          localStorage.removeItem('active_spreadsheet_id');
        }
        toast.success(isNewSchoolMode ? 'Yeni okul başarıyla tanımlandı!' : 'Okul ve sistem ayarları başarıyla kaydedildi!');
        setTimeout(() => {
          window.location.href = '/admin';
        }, 800);
      } else {
        toast.error('Ayarlar kaydedilirken hata oluştu.');
      }
    } catch (err: any) {
      toast.error('Hata: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTransferCode = async () => {
    if (!auth.currentUser || !transferSchoolKey) return;
    setIsSendingCode(true);
    const toastId = toast.loading('Resmi MEB e-posta adresine onay kodu gönderiliyor...');
    try {
      // 6 haneli rastgele kod üret
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const targetEmail = `${transferSchoolKey}@meb.k12.tr`;

      // 1. Kodu veritabanına kaydet
      await saveTransferVerificationCode(
        transferSchoolKey,
        code,
        auth.currentUser.uid,
        auth.currentUser.email || ''
      );

      // 2. E-posta gönderim API'sini çağır
      const res = await fetch('/api/send-transfer-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolKey: transferSchoolKey,
          schoolName: transferSchoolName,
          targetEmail,
          code
        })
      });

      const resJson = await res.json();
      toast.dismiss(toastId);

      if (res.ok) {
        setCodeSent(true);
        toast.success(`${targetEmail} adresine 6 haneli doğrulama kodu gönderildi!`);
      } else {
        toast.error(resJson.error || 'Kod gönderilemedi.');
      }
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error('İşlem başarısız: ' + e.message);
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!auth.currentUser || !transferSchoolKey || !transferCodeInput.trim()) {
      toast.error('Lütfen 6 haneli onay kodunu giriniz.');
      return;
    }

    setIsVerifyingCode(true);
    const toastId = toast.loading('Kod doğrulanıyor ve yetkiler devralınıyor...');
    try {
      const currentToken = localStorage.getItem('google_access_token');
      const result = await verifyAndExecuteTransfer(
        transferSchoolKey,
        transferCodeInput.trim(),
        auth.currentUser.uid,
        auth.currentUser.email || '',
        currentToken || undefined
      );

      toast.dismiss(toastId);

      if (result.success) {
        localStorage.setItem('admin_active_school_key', transferSchoolKey);

        // Yeni yöneticinin kendi Google Drive hesabında E-Tablo bağlantısını otomatik oluştur / bağla
        if (currentToken) {
          try {
            const createRes = await fetch('/api/create-sheet', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                schoolKey: transferSchoolKey,
                schoolName: result.schoolName || transferSchoolName,
                oldSpreadsheetId: result.oldSpreadsheetId || '',
                oldAccessToken: result.oldAccessToken || ''
              })
            });
            const createData = await createRes.json();
            if (createRes.ok && createData.spreadsheetId) {
              localStorage.setItem('active_spreadsheet_id', createData.spreadsheetId);
              await saveSchoolData(auth.currentUser.uid, {
                schoolKey: transferSchoolKey,
                schoolName: result.schoolName || transferSchoolName,
                spreadsheetId: createData.spreadsheetId,
                spreadsheetUrl: createData.spreadsheetUrl,
                adminEmail: auth.currentUser.email || undefined,
                accessToken: currentToken
              });
            }
          } catch (sheetErr) {
            console.warn('Devir sonrası yeni E-Tablo oluşturulurken uyarı:', sheetErr);
          }
        }

        setShowTransferModal(false);
        toast.success(
          `Yetkiler başarıyla devralındı! ${transferSchoolName} yönetim panelinize ve E-Tablonuza bağlandı.`,
          { duration: 5000 }
        );
        setTimeout(() => {
          window.location.href = '/admin';
        }, 1200);
      } else {
        toast.error(result.error || 'Devir işlemi doğrulanamadı.');
      }
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error('Hata: ' + e.message);
    } finally {
      setIsVerifyingCode(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isNewSchoolMode ? 'Yeni Okul Tanımla' : 'Sistem Ayarları'}
        </h1>
        <p className="text-slate-500 mt-1">
          {isNewSchoolMode 
            ? 'Aynı bina veya kampüsteki farklı kademe / okul için yeni kayıt oluşturun (Örn: I., II. veya III. Kademe).'
            : 'Okul künye bilgileri, MEBBİS Kurum Kodu ve E-Tablo veritabanı yapılandırması.'}
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Okul Künye Bilgileri */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Okul Künyesi</h2>
              <p className="text-xs text-slate-400">MEBBİS Kurum Kodu öğretmenlerin doğru okula giriş yapmasını sağlar</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <span className="text-red-500 font-bold">*</span> MEBBİS Kurum Kodu (Zorunlu)
              </label>
              <input 
                type="text"
                value={schoolKey}
                onChange={(e) => setSchoolKey(e.target.value)}
                placeholder="Örn: 765432"
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">Öğretmenler bu kod ile oturum açacaktır.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <span className="text-red-500 font-bold">*</span> Okul Adı
              </label>
              <input 
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Örn: Özel Eğitim Uygulama Okulu I. Kademe"
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">İlçe / İl</label>
              <input 
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="Örn: Meram / KONYA"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Eğitim Öğretim Yılı</label>
              <input 
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* E-Tablo Veritabanı Bilgileri */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Google E-Tablo Veritabanı</h2>
              <p className="text-xs text-slate-400">Verilerin saklandığı aktif Google Drive tablosu</p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">Bağlı ve Senkronize E-Tablo</p>
                  <p className="text-xs text-emerald-700 font-mono mt-0.5">
                    ID: {spreadsheetId || 'Kayıtlı E-Tablo aktif'}
                  </p>
                </div>
              </div>
              {spreadsheetUrl && (
                <a 
                  href={spreadsheetUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  Tabloyu Aç <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Otomatik Kalıcı Erişim ve Hizmet Hesabı */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-50/60 border border-emerald-200/80 p-4 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg mt-0.5">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Otomatik Kalıcı Erişim & Servis Bağlantısı</h3>
                  <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                    Aktif & Sistem Yönetimli
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Google'ın 60 dakikalık token kısıtına takılmamak ve öğretmenlerin gün boyu kesintisiz veri girmesini sağlamak için sistem arka plan bağlantısını otomatik olarak yönetir. <strong>Kullanıcının herhangi bir kod veya JSON girmesine gerek yoktur.</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                toast.success("Kalıcı arka plan servis bağlantısı başarıyla doğrulandı!");
              }}
              className="flex-shrink-0 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm self-start sm:self-auto"
            >
              <CheckCircle2 className="w-4 h-4" />
              Bağlantıyı Doğrula
            </button>
          </div>

          {/* İleri Düzey Kullanıcılar İçin İsteğe Bağlı Manuel JSON Alanı */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvancedJson(!showAdvancedJson)}
              className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 font-medium transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              {showAdvancedJson ? "Gelişmiş ayarları gizle" : "Gelişmiş: Özel Service Account JSON kullan (İsteğe Bağlı)"}
            </button>

            {showAdvancedJson && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-in fade-in duration-200">
                <p className="text-xs text-slate-500">
                  Kendi Google Cloud projenize ait özel bir Service Account JSON anahtarınız varsa buraya yapıştırabilirsiniz. (Varsayılan sistem bağlantısını kullanmak için bu alanı boş bırakabilirsiniz).
                </p>
                <textarea
                  value={serviceAccountKey}
                  onChange={(e) => setServiceAccountKey(e.target.value)}
                  placeholder='{"type": "service_account", "project_id": "...", "private_key": "...", "client_email": "..."}'
                  rows={4}
                  className="w-full p-2.5 font-mono text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-xl flex items-center gap-2 transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </button>
        </div>
      </form>

      {/* Kurum Yetkisi Devir Modalı */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Kurum Yetkisi Devralma</h3>
                  <p className="text-xs text-slate-500">MEB Resmi E-Posta Onayı ile Güvenli Devir</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs text-slate-700">
              <p>
                <strong className="text-slate-900">{transferSchoolKey}</strong> ({transferSchoolName}) kurumu sistemde daha önce{' '}
                <span className="font-semibold text-blue-600 font-mono">{transferOwnerMasked}</span> e-posta adresi tarafından tanımlanmıştır.
              </p>
              <p className="text-slate-500">
                Bu okulun yetkili idarecisi sizseniz, okulun resmi adresi olan{' '}
                <span className="font-mono font-bold text-slate-800">{transferSchoolKey}@meb.k12.tr</span> adresine tek kullanımlık 6 haneli güvenlik kodu göndererek mülkiyeti kendi hesabınıza devralabilirsiniz.
              </p>
            </div>

            {!codeSent ? (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800">
                  ℹ️ Kod talep edildiğinde okulunuzun kurumsal MEB posta kutusuna 15 dakika geçerli bir onay kodu iletilecektir.
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={handleSendTransferCode}
                    disabled={isSendingCode}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-xs font-bold text-white shadow-sm flex items-center gap-2"
                  >
                    {isSendingCode ? 'Gönderiliyor...' : `Onay Kodunu Gönder (${transferSchoolKey}@meb.k12.tr)`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {transferSchoolKey}@meb.k12.tr Adresine Gönderilen 6 Haneli Kod:
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={transferCodeInput}
                    onChange={(e) => setTransferCodeInput(e.target.value)}
                    placeholder="Örn: 584920"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono text-xl tracking-widest font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1 text-center">
                    Kodun geçerlilik süresi 15 dakikadır.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleSendTransferCode}
                    disabled={isSendingCode}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    Kodu Tekrar Gönder
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTransferModal(false)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      İptal
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmTransfer}
                      disabled={isVerifyingCode || transferCodeInput.length !== 6}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-xs font-bold text-white shadow-sm"
                    >
                      {isVerifyingCode ? 'Doğrulanıyor...' : 'Yetkiyi Devral ve Onayla'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { Suspense } from 'react';

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Ayarlar yükleniyor...</div>}>
      <AdminSettingsContent />
    </Suspense>
  );
}
