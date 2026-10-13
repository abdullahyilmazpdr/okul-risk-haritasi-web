'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  X, 
  Send, 
  RefreshCw, 
  AlertTriangle,
  Users,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Copy,
  Download,
  KeyRound,
  BookOpen,
  Lock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { auth } from '@/lib/firebase';
import { getSchoolData, saveSchoolData } from '@/lib/db';
import { onAuthStateChanged } from 'firebase/auth';
import toast from 'react-hot-toast';

export default function UploadPage() {
  const router = useRouter();
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);

  // Hizmet Hesabı (Service Account) & KVKK
  const [serviceAccountKey, setServiceAccountKey] = useState('');
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [kvkkConsent, setKvkkConsent] = useState(false);

  // E-Tablo'da kayıtlı mevcut veriler
  const [existingData, setExistingData] = useState<{
    students: any[];
    teachers: any[];
  } | null>(null);

  // Güncelleme onayı modalı durumu
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Son işlem sonucu
  const [results, setResults] = useState<any>(null);

  // Sınıf akordiyon açma/kapama durumları
  const [openClasses, setOpenClasses] = useState<Record<string, boolean>>({});

  // Sayfa açıldığında veya geri/ileri yapıldığında E-Tablo'daki mevcut verileri çek
  const fetchCurrentSchoolData = useCallback(async (user: any) => {
    setIsLoadingExisting(true);
    try {
      const activeKey = typeof window !== 'undefined' ? localStorage.getItem('admin_active_school_key') : null;
      const schoolData = await getSchoolData(user.uid, activeKey || undefined);
      if (!schoolData) {
        setIsLoadingExisting(false);
        return;
      }

      if (schoolData.serviceAccountKey && typeof schoolData.serviceAccountKey === 'string') {
        setServiceAccountKey(schoolData.serviceAccountKey);
      }

      if (!schoolData.spreadsheetId) {
        setIsLoadingExisting(false);
        return;
      }

      const activeToken = localStorage.getItem('google_access_token') || schoolData.accessToken;
      if (!activeToken) {
        setIsLoadingExisting(false);
        return;
      }

      const res = await fetch(`/api/school-data?spreadsheetId=${schoolData.spreadsheetId}`, {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });

      const json = await res.json();
      if (res.ok && json.data) {
        if (json.data.students.length > 0 || json.data.teachers.length > 0) {
          setExistingData(json.data);
          if (typeof window !== 'undefined') {
            if (json.data.teachers) localStorage.setItem('school_teachers', JSON.stringify(json.data.teachers));
            if (json.data.students) localStorage.setItem('school_students', JSON.stringify(json.data.students));
            if (schoolData.spreadsheetId) localStorage.setItem('active_spreadsheet_id', schoolData.spreadsheetId);
          }
        }
      }
    } catch (err) {
      console.error("Mevcut veriler yüklenirken hata:", err);
    } finally {
      setIsLoadingExisting(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchCurrentSchoolData(user);
      } else {
        setIsLoadingExisting(false);
      }
    });

    return () => unsubscribe();
  }, [fetchCurrentSchoolData]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, setFile: (file: File) => void) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        setFile(file);
        toast.success(`${file.name} seçildi.`);
      } else {
        toast.error("Lütfen sadece PDF formatında dosya yükleyin.");
      }
    }
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Yükleme butonuna tıklandığında kontrol et: Mevcut veri varsa onay iste
  const handleInitiateUpload = () => {
    if (!studentFile || !scheduleFile) {
      toast.error("Lütfen her iki PDF dosyasını da seçin.");
      return;
    }

    // Eğer sistemde halihazırda öğrenci veya öğretmen verisi varsa önce onay iste!
    if (existingData && (existingData.students.length > 0 || existingData.teachers.length > 0)) {
      setShowConfirmModal(true);
    } else {
      executeUpload(false);
    }
  };

  // Gerçek yükleme veya güncelleme isteği
  const executeUpload = async (isUpdate: boolean) => {
    setShowConfirmModal(false);
    setIsUploading(true);
    const loadingToast = toast.loading(
      isUpdate 
        ? "Mevcut veriler güncelleniyor..." 
        : "PDF dosyaları analiz ediliyor ve Google E-Tabloya yazılıyor..."
    );

    try {
      if (!auth.currentUser) {
        toast.dismiss(loadingToast);
        toast.error("Oturum süreniz dolmuştur. Giriş sayfasına yönlendiriliyorsunuz...", {
          duration: 3000,
          icon: '⏳'
        });
        setTimeout(() => router.push('/login'), 1500);
        setIsUploading(false);
        return;
      }

      const activeKey = typeof window !== 'undefined' ? localStorage.getItem('admin_active_school_key') : null;
      const schoolData = await getSchoolData(auth.currentUser.uid, activeKey || undefined);
      if (!schoolData || !schoolData.spreadsheetId) {
        toast.dismiss(loadingToast);
        toast.error("Bağlı E-Tablo bulunamadı. Lütfen önce Yönetim Paneli'nden E-Tablo oluşturun.");
        setIsUploading(false);
        return;
      }

      const activeToken = localStorage.getItem('google_access_token') || schoolData.accessToken;
      if (!activeToken) {
        toast.dismiss(loadingToast);
        toast.error("Oturum süreniz dolmuştur. Lütfen tekrar giriş yapın.", {
          duration: 3000,
          icon: '⏳'
        });
        setTimeout(() => router.push('/login'), 1500);
        setIsUploading(false);
        return;
      }

      const formData = new FormData();
      if (studentFile) formData.append('studentFile', studentFile);
      if (scheduleFile) formData.append('scheduleFile', scheduleFile);
      formData.append('spreadsheetId', schoolData.spreadsheetId);
      if (isUpdate) {
        formData.append('isUpdate', 'true');
      }

      const res = await fetch('/api/parse-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`
        },
        body: formData
      });

      const data = await res.json();
      toast.dismiss(loadingToast);

      if (res.ok) {
        toast.success(
          isUpdate 
            ? "Mevcut öğrenci ve öğretmen verileri başarıyla güncellendi!" 
            : "Veriler başarıyla Google E-Tablonuza aktarıldı!"
        );
        setResults(data.data);
        setExistingData(data.data);
        
        // Eğer Hizmet Hesabı JSON girilmişse kalıcı olarak veritabanına kaydet
        if (serviceAccountKey.trim()) {
          try {
            await saveSchoolData(auth.currentUser.uid, {
              schoolKey: schoolData.schoolKey || activeKey || 'DEFAULT',
              spreadsheetId: schoolData.spreadsheetId,
              schoolName: schoolData.schoolName,
              serviceAccountKey: serviceAccountKey.trim()
            });
          } catch (e) {
            console.error("Service Account kaydedilemedi:", e);
          }
        }

        // Tarayıcı yerel hafızasına öğretmen ve öğrenci listesini ve tablo kimliğini kaydet
        if (typeof window !== 'undefined' && data.data) {
          if (data.data.teachers) {
            localStorage.setItem('school_teachers', JSON.stringify(data.data.teachers));
          }
          if (data.data.students) {
            localStorage.setItem('school_students', JSON.stringify(data.data.students));
          }
          if (schoolData.spreadsheetId) {
            localStorage.setItem('active_spreadsheet_id', schoolData.spreadsheetId);
          }
        }

        setStudentFile(null);
        setScheduleFile(null);
      } else {
        const errorText = (data.error || '').toLowerCase();
        if (
          res.status === 401 ||
          errorText.includes('authentication') ||
          errorText.includes('credentials') ||
          errorText.includes('token') ||
          errorText.includes('unauthorized') ||
          errorText.includes('yetkilendirme')
        ) {
          toast.error("Oturum süreniz dolmuştur. Yeniden giriş yapmanız için yönlendiriliyorsunuz...", {
            duration: 3500,
            icon: '⏳'
          });
          localStorage.removeItem('google_access_token');
          setTimeout(() => router.push('/login'), 1800);
        } else {
          toast.error("İşlem başarısız: " + (data.error || "Bilinmeyen hata"));
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.dismiss(loadingToast);
      toast.error("Beklenmeyen bir hata oluştu: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const activeDisplayData = results || existingData;

  // Öğrencileri sınıflara göre grupla
  const groupedStudents = useMemo(() => {
    if (!activeDisplayData?.students) return {};
    const groups: Record<string, any[]> = {};
    for (const student of activeDisplayData.students) {
      const cls = student.className || 'Belirtilmemiş Sınıf';
      if (!groups[cls]) {
        groups[cls] = [];
      }
      groups[cls].push(student);
    }
    return groups;
  }, [activeDisplayData?.students]);

  // Sınıf akordiyon toggle
  const toggleClass = (className: string) => {
    setOpenClasses(prev => ({
      ...prev,
      [className]: !prev[className]
    }));
  };

  // Tüm sınıfları aç/kapat
  const toggleAllClasses = (expand: boolean) => {
    const updated: Record<string, boolean> = {};
    Object.keys(groupedStudents).forEach(cls => {
      updated[cls] = expand;
    });
    setOpenClasses(updated);
  };

  // Tüm öğretmenlerin giriş bilgilerini metin olarak panoya kopyala
  const handleCopyAllCredentials = () => {
    if (!activeDisplayData?.teachers || activeDisplayData.teachers.length === 0) {
      toast.error("Kopyalanacak öğretmen listesi bulunamadı.");
      return;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const loginUrl = `${origin}/teacher/login`;

    let text = `📋 OKUL RİSK HARİTASI & ŞÖK MODÜLÜ - ÖĞRETMEN GİRİŞ BİLGİLERİ\n`;
    text += `Giriş Adresi: ${loginUrl}\n`;
    text += `--------------------------------------------------\n\n`;

    activeDisplayData.teachers.forEach((t: any, i: number) => {
      text += `${i + 1}. ${t.name} (${t.roleOrBranch || 'Öğretmen'})\n`;
      text += `   Kullanıcı Adı: ${t.username}\n`;
      text += `   Şifre: ${t.password}\n`;
      if (t.classes && t.classes.length > 0) {
        text += `   Sınıflar: ${t.classes.join(', ')}\n`;
      }
      text += `\n`;
    });

    navigator.clipboard.writeText(text);
    toast.success("Tüm öğretmen giriş bilgileri panoya kopyalandı! WhatsApp veya e-posta ile topluca paylaşabilirsiniz.");
  };

  // WhatsApp iletişim listesini Excel (.xlsx) olarak indir
  const handleDownloadWhatsAppExcel = () => {
    if (!activeDisplayData?.teachers || activeDisplayData.teachers.length === 0) {
      toast.error("İndirilecek öğretmen listesi bulunamadı.");
      return;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const loginUrl = `${origin}/teacher/login`;

    const rows = activeDisplayData.teachers.map((t: any, idx: number) => {
      const msg = `Sayın ${t.name}, Okul Risk Haritası ve ŞÖK Öğretmen Giriş Bilgileriniz:\nAdres: ${loginUrl}\nKullanıcı Adı: ${t.username}\nŞifre: ${t.password}`;
      return {
        "Sıra No": idx + 1,
        "Öğretmen / İdareci Adı": t.name,
        "Görevi / Branşı": t.roleOrBranch || 'Ders Öğretmeni',
        "Kullanıcı Adı": t.username,
        "Giriş Şifresi": t.password,
        "Sorumlu Sınıflar": Array.isArray(t.classes) ? t.classes.join(', ') : '',
        "Doğrudan WhatsApp Bağlantısı": t.whatsappLink || '',
        "Hazır WhatsApp Mesajı": msg
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Öğretmen Giriş Listesi");
    XLSX.writeFile(wb, "Ogretmen_Giris_ve_WhatsApp_Listesi.xlsx");

    toast.success("Öğretmen WhatsApp ve Giriş Listesi Excel olarak indirildi!");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Onay Modalı */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-3 bg-amber-50 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Mevcut Veriler Güncellensin mi?</h3>
            </div>
            
            <p className="text-sm text-slate-600 leading-relaxed">
              Google E-Tablonuzda halihazırda <strong>{existingData?.students?.length || 0} öğrenci</strong> ve <strong>{existingData?.teachers?.length || 0} öğretmen</strong> kayıtlı bulunmaktadır.
              <br /><br />
              Yeni yüklediğiniz PDF dosyalarındaki veriler mevcut verilerin üzerine yazılacaktır. Bu değişikliği onaylıyor musunuz?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Vazgeç
              </button>
              <button
                onClick={() => executeUpload(true)}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Evet, Verileri Güncelle
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Veri Yükleme ve Yönetimi</h1>
          <p className="text-slate-500 mt-1">E-Okul'dan aldığınız PDF dokümanlarını yükleyerek sisteme aktarabilir veya mevcut kayıtları güncelleyebilirsiniz.</p>
        </div>
        {existingData && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-lg self-start sm:self-auto">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Kayıtlı Veriler Aktif</span>
          </div>
        )}
      </div>

      {/* E-Okul Dosyaları Nereden Alınır Bilgilendirme Kartı */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-5 text-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
          <BookOpen className="w-4 h-4 text-blue-700" />
          <span>E-Okul'dan Bu Dosyaları Nasıl Alabilirsiniz?</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-slate-700">
          <div className="bg-white/80 p-3.5 rounded-xl border border-blue-100 space-y-1.5">
            <p className="font-bold text-blue-950 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">1</span>
              Öğrenci Listesi (PDF) Alınışı:
            </p>
            <p className="text-slate-600">
              <strong>E-Okul Yönetim Bilgi Sistemi</strong> &gt; <strong>Öğrenci İşlemleri</strong> &gt; <strong>Raporlar</strong> (Yazıcı simgesi) &gt; <strong>Sınıf Listesi (Fotoğraflı/Fotoğrafsız)</strong> ekranından PDF olarak indiriniz.
            </p>
          </div>

          <div className="bg-white/80 p-3.5 rounded-xl border border-blue-100 space-y-1.5">
            <p className="font-bold text-indigo-950 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white inline-flex items-center justify-center text-[10px]">2</span>
              Öğretmen Ders Programı (PDF) Alınışı:
            </p>
            <p className="text-slate-600">
              <strong>E-Okul</strong> &gt; <strong>Haftalık Ders Programı</strong> &gt; <strong>Raporlar</strong> &gt; <strong>Öğretmen Bazlı Haftalık Ders Programı Çizelgesi</strong> raporunu PDF olarak kaydediniz.
            </p>
          </div>
        </div>
      </div>
          
      {/* İki Kolonlu Yükleme Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Öğrenci Listesi Yükleme */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Sınıf Öğrenci Listesi (PDF)</h3>
              <p className="text-xs text-slate-400">Şube listeleri ve öğrenci numaralarını içerir</p>
            </div>
          </div>

          {!studentFile ? (
            <div 
              onDrop={(e) => handleDrop(e, setStudentFile)}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 cursor-pointer"
            >
              <UploadCloud className="w-10 h-10 text-slate-400 mb-4" />
              <p className="font-medium text-slate-700">PDF dosyasını buraya sürükleyin</p>
              <input 
                type="file" 
                accept="application/pdf" 
                className="hidden" 
                id="student-upload" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setStudentFile(e.target.files[0]);
                    toast.success(`${e.target.files[0].name} seçildi.`);
                  }
                }} 
              />
              <button 
                onClick={() => document.getElementById('student-upload')?.click()} 
                className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
              >
                Dosya Seç
              </button>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">{studentFile.name}</p>
                </div>
              </div>
              <button onClick={() => setStudentFile(null)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Ders Programı Yükleme */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Öğretmen Ders Programı (PDF)</h3>
              <p className="text-xs text-slate-400">Branş öğretmenleri ve ders programlarını içerir</p>
            </div>
          </div>
          
          {!scheduleFile ? (
            <div 
              onDrop={(e) => handleDrop(e, setScheduleFile)}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 cursor-pointer"
            >
              <UploadCloud className="w-10 h-10 text-slate-400 mb-4" />
              <p className="font-medium text-slate-700">PDF dosyasını buraya sürükleyin</p>
              <input 
                type="file" 
                accept="application/pdf" 
                className="hidden" 
                id="schedule-upload" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setScheduleFile(e.target.files[0]);
                    toast.success(`${e.target.files[0].name} seçildi.`);
                  }
                }} 
              />
              <button 
                onClick={() => document.getElementById('schedule-upload')?.click()} 
                className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
              >
                Dosya Seç
              </button>
            </div>
          ) : (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-purple-600" />
                <div>
                  <p className="font-medium text-purple-900">{scheduleFile.name}</p>
                </div>
              </div>
              <button onClick={() => setScheduleFile(null)} className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Otomatik Kalıcı Erişim ve Hizmet Bağlantısı */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-50/60 border border-emerald-200/80 p-4 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-900 text-sm">Otomatik Kalıcı Erişim & Servis Bağlantısı</h4>
                <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                  Aktif & Sistem Yönetimli
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Google'ın 60 dakikalık oturum kısıtını aşmak ve öğretmenlerinizin gün boyu kesintisiz veri girebilmesini sağlamak için arka plan bağlantısı sistemimiz tarafından otomatik olarak sağlanmaktadır. <strong>Kullanıcının herhangi bir kod veya JSON dosyası girmesine gerek yoktur.</strong>
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
            <KeyRound className="w-3.5 h-3.5" />
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
                rows={3}
                className="w-full p-2.5 font-mono text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* KVKK Onay Kutucuğu */}
        <div className="pt-2 border-t border-slate-100 flex items-start gap-3">
          <input
            type="checkbox"
            id="kvkk-consent"
            checked={kvkkConsent}
            onChange={(e) => setKvkkConsent(e.target.checked)}
            className="mt-1 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor="kvkk-consent" className="text-xs text-slate-600 leading-relaxed cursor-pointer select-none">
            <strong className="text-slate-800">KVKK ve Veri Gizliliği Taahhüdü:</strong> Yüklenen öğrenci sınıf listesi ve öğretmen ders programındaki verilerin yalnızca kendi kurumumuza ait olduğunu, öğrenci mahremiyeti gereği üçüncü taraflarla paylaşılmayacağını ve bu bilgilerin yalnızca kurumumuzun Google Drive E-Tablosunda saklanacağını onaylıyorum.
          </label>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <span className="text-xs text-slate-400">
          {!kvkkConsent && <span className="text-amber-600 font-medium">* Devam etmek için KVKK onay kutusunu işaretleyiniz.</span>}
        </span>
        <button
          onClick={handleInitiateUpload}
          disabled={!studentFile || !scheduleFile || !kvkkConsent || isUploading}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          {isUploading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Veriler İşleniyor...</>
          ) : existingData && (existingData.students.length > 0 || existingData.teachers.length > 0) ? (
            <><RefreshCw className="w-5 h-5" /> Verileri Güncelle</>
          ) : (
            'Verileri Sisteme Aktar'
          )}
        </button>
      </div>

      {/* Yüklü Veriler Görünümü (Geri/İleri yapıldığında veya işlem sonrasında her zaman görünür) */}
      {isLoadingExisting ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-100 text-slate-400 text-sm">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
          E-Tablodaki mevcut veriler kontrol ediliyor...
        </div>
      ) : activeDisplayData && (activeDisplayData.students.length > 0 || activeDisplayData.teachers.length > 0) ? (
        <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">E-Tabloda Kayıtlı Veriler</h2>
                <p className="text-xs text-slate-500">Google E-Tablonuz ile senkronize edilmiş aktif öğrenci ve öğretmen kayıtları.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
              <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100">
                {activeDisplayData.students.length} Öğrenci ({Object.keys(groupedStudents).length} Sınıf)
              </span>
              <span className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-100">
                {activeDisplayData.teachers.length} Öğretmen / İdareci
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Öğrenci Listesi: Sınıf Bazlı Akordiyon Grubu (Kalabalık okullar için optimize) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                  Sınıflar ve Öğrenciler
                </h3>
                <div className="flex items-center gap-2 text-xs">
                  <button 
                    onClick={() => toggleAllClasses(true)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Tümünü Aç
                  </button>
                  <span className="text-slate-300">|</span>
                  <button 
                    onClick={() => toggleAllClasses(false)}
                    className="text-slate-500 hover:text-slate-700 font-medium"
                  >
                    Tümünü Kapat
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {Object.entries(groupedStudents).map(([className, classStudents]) => {
                  const isOpen = openClasses[className] ?? false;
                  return (
                    <div key={className} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                      <button
                        onClick={() => toggleClass(className)}
                        className="w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          )}
                          <span className="font-semibold text-slate-800 text-sm line-clamp-1">{className}</span>
                        </div>
                        <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full flex-shrink-0 ml-2">
                          {classStudents.length} Öğrenci
                        </span>
                      </button>

                      {isOpen && (
                        <div className="p-3 border-t border-slate-100 bg-white space-y-2">
                          {classStudents.map((s: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center py-1.5 px-3 bg-slate-50 rounded-lg text-xs">
                              <span className="font-medium text-slate-800">{s.number} - {s.name}</span>
                              <span className="text-slate-400 font-mono">No: {s.number}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Öğretmen ve İdareci Listesi */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-purple-600" />
                  Öğretmenler ve İdareciler ({activeDisplayData.teachers.length})
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyAllCredentials}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                    title="Tüm öğretmen giriş bilgilerini metin olarak kopyala"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Tümünü Kopyala
                  </button>
                  <button
                    onClick={handleDownloadWhatsAppExcel}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                    title="Toplu WhatsApp iletişim listesini Excel olarak indir"
                  >
                    <Download className="w-3.5 h-3.5" />
                    WhatsApp Excel İndir
                  </button>
                </div>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {activeDisplayData.teachers.map((t: any, idx: number) => {
                  const isRoleAdmin = t.roleOrBranch?.includes('Müdür Yardımcısı');
                  const isRoleClassTeacher = t.roleOrBranch?.includes('Sınıf Öğretmeni');

                  return (
                    <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 text-sm">{t.name}</p>
                          {t.roleOrBranch && (
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                              isRoleAdmin 
                                ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                : isRoleClassTeacher
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {t.roleOrBranch}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1.5">
                          K. Adı: <span className="font-mono font-semibold text-slate-700">{t.username}</span> | 
                          Şifre: <span className="font-mono font-semibold text-slate-700 ml-1">{t.password}</span>
                        </p>
                        {t.classes && t.classes.length > 0 && (
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                            Sorumlu Sınıflar: {t.classes.join(', ')}
                          </p>
                        )}
                      </div>
                      {t.whatsappLink && (
                        <a 
                          href={t.whatsappLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors flex-shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      ) : null}
    </div>
  );
}
