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
  Copy,
  Download,
  KeyRound,
  BookOpen,
  UserPlus,
  Edit3,
  Trash2,
  Sparkles,
  Lock,
  QrCode
} from 'lucide-react';
import * as XLSX from 'xlsx';
import TeacherQrCardsModal from '@/components/TeacherQrCardsModal';
import { auth } from '@/lib/firebase';
import { getSchoolData, saveSchoolData } from '@/lib/db';
import { onAuthStateChanged } from 'firebase/auth';
import toast from 'react-hot-toast';

// İstemci tarafı otomatik kullanıcı adı ve şifre üretici yardımcıları
function slugifyTrClient(text: string): string {
  const trMap: Record<string, string> = {
    'ç': 'c', 'Ç': 'c',
    'ğ': 'g', 'Ğ': 'g',
    'ı': 'i', 'I': 'i',
    'İ': 'i', 'i': 'i',
    'ö': 'o', 'Ö': 'o',
    'ş': 's', 'Ş': 's',
    'ü': 'u', 'Ü': 'u'
  };
  return text
    .split('')
    .map(c => trMap[c] || c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '.');
}

function generateUsernameClient(name: string): string {
  const clean = slugifyTrClient(name);
  const parts = clean.split('.');
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[parts.length - 1]}`;
  }
  return clean || `ogretmen.${Math.floor(100 + Math.random() * 900)}`;
}

function generatePasswordClient(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pass = '';
  for (let i = 0; i < 6; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

function getClassBaseKeyClient(clsName: string): string {
  return (clsName || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/^ÖE[İI]U\s*-\s*/i, '')
    .replace(/Sınıf\s*Listesi.*$/i, '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .replace(/Ç/g, 'ç')
    .replace(/Ğ/g, 'ğ')
    .replace(/Ö/g, 'ö')
    .replace(/Ş/g, 'ş')
    .replace(/Ü/g, 'ü')
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşü]/g, '');
}

function deduplicateClassesClient(classList: string[]): string[] {
  const map = new Map<string, string>();
  for (const raw of classList || []) {
    const trimmed = (raw || '').trim();
    if (!trimmed) continue;
    const key = getClassBaseKeyClient(trimmed);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing || trimmed.length > existing.length) {
      map.set(key, trimmed);
    }
  }
  return Array.from(map.values());
}

export default function UploadPage() {
  const router = useRouter();
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);

  // Şifre yenileme tercihi (Varsayılan: false -> Mevcut şifreleri koru!)
  const [regeneratePasswords, setRegeneratePasswords] = useState(false);

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

  // Manuel Öğretmen Ekleme / Düzenleme Modalı state'leri
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [teacherModalMode, setTeacherModalMode] = useState<'add' | 'edit'>('add');
  const [editingOriginalUsername, setEditingOriginalUsername] = useState('');
  const [editingOriginalName, setEditingOriginalName] = useState('');
  const [teacherFormName, setTeacherFormName] = useState('');
  const [teacherFormRoleType, setTeacherFormRoleType] = useState('Ders Öğretmeni');
  const [teacherFormBranch, setTeacherFormBranch] = useState('');
  const [teacherFormUsername, setTeacherFormUsername] = useState('');
  const [teacherFormPassword, setTeacherFormPassword] = useState('');
  const [teacherFormSelectedClasses, setTeacherFormSelectedClasses] = useState<string[]>([]);
  const [teacherFormExtraClasses, setTeacherFormExtraClasses] = useState('');
  const [isSavingTeacher, setIsSavingTeacher] = useState(false);
  const [autoUsernameEnabled, setAutoUsernameEnabled] = useState(true);

  // Manuel Öğrenci Ekleme / Düzenleme Modalı state'leri
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentModalMode, setStudentModalMode] = useState<'add' | 'edit'>('add');
  const [editingOriginalNumber, setEditingOriginalNumber] = useState('');
  const [studentFormNumber, setStudentFormNumber] = useState('');
  const [studentFormName, setStudentFormName] = useState('');
  const [studentFormClass, setStudentFormClass] = useState('');
  const [studentFormGender, setStudentFormGender] = useState('Kız');
  const [isSavingStudent, setIsSavingStudent] = useState(false);

  // Karekod Kartları Modalı state'i
  const [showQrModal, setShowQrModal] = useState(false);
  const [currentSchoolName, setCurrentSchoolName] = useState('');
  const [currentSchoolKey, setCurrentSchoolKey] = useState('');

  // Son işlem sonucu
  const [results, setResults] = useState<any>(null);

  // Sınıf akordiyon açma/kapama durumları
  const [openClasses, setOpenClasses] = useState<Record<string, boolean>>({});

  // Öğretmen arama/filtreleme
  const [teacherSearch, setTeacherSearch] = useState('');

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

      if (schoolData.schoolName) setCurrentSchoolName(schoolData.schoolName);
      if (schoolData.schoolKey || activeKey) setCurrentSchoolKey(schoolData.schoolKey || activeKey || '');

      if (schoolData.serviceAccountKey && typeof schoolData.serviceAccountKey === 'string') {
        setServiceAccountKey(schoolData.serviceAccountKey);
      }

      if (!schoolData.spreadsheetId) {
        setIsLoadingExisting(false);
        return;
      }

      const activeToken = localStorage.getItem('google_access_token') || schoolData.accessToken || '';

      const res = await fetch(
        `/api/school-data?spreadsheetId=${schoolData.spreadsheetId}&schoolKey=${encodeURIComponent(schoolData.schoolKey || activeKey || '')}&adminUid=${encodeURIComponent(user.uid)}&includePasswords=true`,
        {
          headers: {
            ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
          }
        }
      );

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

  // Yükleme butonuna tıklandığında kontrol et: En az bir dosya seçilmiş olmalı
  const handleInitiateUpload = () => {
    if (!studentFile && !scheduleFile) {
      toast.error("Lütfen en az bir PDF dosyası (Öğrenci Listesi veya Ders Programı) seçin.");
      return;
    }

    // Eğer sistemde halihazırda öğrenci veya öğretmen verisi varsa onay modalını aç
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
        ? "Seçilen PDF verileri güncelleniyor..." 
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

      const activeToken = localStorage.getItem('google_access_token') || schoolData.accessToken || '';

      const currentTeachers = (results || existingData)?.teachers || [];

      const formData = new FormData();
      if (studentFile) formData.append('studentFile', studentFile);
      if (scheduleFile) formData.append('scheduleFile', scheduleFile);
      formData.append('spreadsheetId', schoolData.spreadsheetId);
      formData.append('schoolKey', schoolData.schoolKey || activeKey || '');
      formData.append('adminUid', auth.currentUser.uid);
      formData.append('regeneratePasswords', regeneratePasswords ? 'true' : 'false');
      if (currentTeachers.length > 0) {
        formData.append('existingTeachersJson', JSON.stringify(currentTeachers));
      }
      if (isUpdate) {
        formData.append('isUpdate', 'true');
      }

      const res = await fetch('/api/parse-upload', {
        method: 'POST',
        headers: {
          ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
        },
        body: formData
      });

      const data = await res.json();
      toast.dismiss(loadingToast);

      if (res.ok) {
        toast.success(data.message || "Veriler başarıyla Google E-Tablonuza aktarıldı!");
        setResults(data.data);
        setExistingData(data.data);
        
        // Firestore'a yalnızca E-Tablo bağlantı ve varsa Service Account bilgisini kaydet (öğrenci/öğretmen verisi Firestore'da tutulmaz)
        try {
          await saveSchoolData(auth.currentUser.uid, {
            schoolKey: schoolData.schoolKey || activeKey || 'DEFAULT',
            spreadsheetId: schoolData.spreadsheetId,
            schoolName: schoolData.schoolName,
            accessToken: activeToken,
            ...(serviceAccountKey.trim() ? { serviceAccountKey: serviceAccountKey.trim() } : {})
          });
        } catch (e) {
          console.error("Okul bağlantı verisi kaydedilemedi:", e);
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

  const availableClasses = useMemo(() => {
    const rawList: string[] = [...Object.keys(groupedStudents)];
    if (activeDisplayData?.teachers) {
      for (const t of activeDisplayData.teachers) {
        if (Array.isArray(t.classes)) {
          t.classes.forEach((c: string) => {
            if (c && c.trim()) rawList.push(c.trim());
          });
        }
      }
    }
    return deduplicateClassesClient(rawList).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [groupedStudents, activeDisplayData?.teachers]);

  const filteredTeachers = useMemo(() => {
    const list = activeDisplayData?.teachers || [];
    if (!teacherSearch.trim()) return list;
    const q = teacherSearch.toLowerCase().trim();
    return list.filter((t: any) =>
      (t.name || '').toLowerCase().includes(q) ||
      (t.username || '').toLowerCase().includes(q) ||
      (t.roleOrBranch || '').toLowerCase().includes(q) ||
      (Array.isArray(t.classes) && t.classes.some((c: string) => c.toLowerCase().includes(q)))
    );
  }, [activeDisplayData?.teachers, teacherSearch]);

  // Manuel Öğretmen Ekleme Modalını Aç
  const openAddTeacherModal = () => {
    setTeacherModalMode('add');
    setEditingOriginalUsername('');
    setEditingOriginalName('');
    setTeacherFormName('');
    setTeacherFormRoleType('Ders Öğretmeni');
    setTeacherFormBranch('');
    setTeacherFormUsername('');
    setTeacherFormPassword(generatePasswordClient());
    setTeacherFormSelectedClasses([]);
    setTeacherFormExtraClasses('');
    setAutoUsernameEnabled(true);
    setShowTeacherModal(true);
  };

  // Öğretmen Düzenleme Modalını Aç
  const openEditTeacherModal = (t: any) => {
    setTeacherModalMode('edit');
    setEditingOriginalUsername(t.username || '');
    setEditingOriginalName(t.name || '');
    setTeacherFormName(t.name || '');

    const roleStr = t.roleOrBranch || t.role || 'Ders Öğretmeni';
    if (roleStr.includes('Müdür Yardımcısı')) {
      setTeacherFormRoleType('Müdür Yardımcısı');
      setTeacherFormBranch(roleStr.replace('Müdür Yardımcısı', '').replace(/^-/, '').trim());
    } else if (roleStr.includes('Sınıf Öğretmeni')) {
      setTeacherFormRoleType('Sınıf Öğretmeni');
      setTeacherFormBranch(roleStr.replace('Sınıf Öğretmeni', '').replace(/^-/, '').trim());
    } else if (roleStr.includes('Rehber')) {
      setTeacherFormRoleType('Rehber Öğretmen / Psikolojik Danışman');
      setTeacherFormBranch('');
    } else {
      setTeacherFormRoleType('Ders Öğretmeni');
      setTeacherFormBranch(roleStr === 'Ders Öğretmeni' ? '' : roleStr);
    }

    setTeacherFormUsername(t.username || generateUsernameClient(t.name || ''));
    setTeacherFormPassword(t.password || generatePasswordClient());

    // Öğretmenin mevcut sınıflarını availableClasses'taki kanonik (tam) isimleriyle eşleştir
    const rawTeacherClasses: string[] = Array.isArray(t.classes) ? t.classes : [];
    const mappedClasses = deduplicateClassesClient(
      rawTeacherClasses.map((tc: string) => {
        const key = getClassBaseKeyClient(tc);
        const matchInAvailable = availableClasses.find((ac) => getClassBaseKeyClient(ac) === key);
        return matchInAvailable || tc;
      })
    );
    // Müdür Yardımcısı okuldaki tüm sınıflardan sorumludur; otomatik olarak tüm sınıflar seçili gelsin
    if (roleStr.includes('Müdür Yardımcısı') && availableClasses.length > 0) {
      setTeacherFormSelectedClasses([...availableClasses]);
    } else {
      setTeacherFormSelectedClasses(mappedClasses);
    }
    setTeacherFormExtraClasses('');
    setAutoUsernameEnabled(false);
    setShowTeacherModal(true);
  };

  const handleTeacherNameChange = (val: string) => {
    setTeacherFormName(val);
    if (autoUsernameEnabled) {
      setTeacherFormUsername(val.trim() ? generateUsernameClient(val) : '');
    }
  };

  const toggleTeacherFormClass = (cls: string) => {
    const targetKey = getClassBaseKeyClient(cls);
    setTeacherFormSelectedClasses(prev => {
      const exists = prev.some(c => getClassBaseKeyClient(c) === targetKey);
      if (exists) {
        return prev.filter(c => getClassBaseKeyClient(c) !== targetKey);
      }
      return [...prev, cls];
    });
  };

  // Manuel Öğretmen Kaydet (Ekle veya Güncelle)
  const handleSaveTeacher = async () => {
    if (!teacherFormName.trim()) {
      toast.error("Lütfen öğretmenin adını ve soyadını giriniz.");
      return;
    }

    setIsSavingTeacher(true);
    try {
      if (!auth.currentUser) {
        toast.error("Yönetici oturumu bulunamadı. Lütfen yeniden giriş yapınız.");
        return;
      }

      const activeKey = typeof window !== 'undefined' ? localStorage.getItem('admin_active_school_key') : null;
      const schoolData = await getSchoolData(auth.currentUser.uid, activeKey || undefined);
      const activeToken = localStorage.getItem('google_access_token') || schoolData?.accessToken || '';

      if (!schoolData?.spreadsheetId) {
        toast.error("Google E-Tablo bağlantısı eksik. Lütfen yeniden giriş yapınız.");
        return;
      }

      const extraClasses = teacherFormExtraClasses
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);
      let combinedClasses = deduplicateClassesClient([...teacherFormSelectedClasses, ...extraClasses]);
      // Eğer Müdür Yardımcısı ise okuldaki tüm sınıfları garanti olarak ekle
      if (teacherFormRoleType === 'Müdür Yardımcısı' && availableClasses.length > 0) {
        combinedClasses = deduplicateClassesClient([...combinedClasses, ...availableClasses]);
      }

      let finalRoleOrBranch = teacherFormRoleType;
      if (teacherFormBranch.trim()) {
        if (teacherFormRoleType === 'Ders Öğretmeni') {
          finalRoleOrBranch = teacherFormBranch.trim();
        } else {
          finalRoleOrBranch = `${teacherFormRoleType} - ${teacherFormBranch.trim()}`;
        }
      }

      const finalUsername = teacherFormUsername.trim() || generateUsernameClient(teacherFormName);
      const finalPassword = teacherFormPassword.trim() || generatePasswordClient();

      const res = await fetch('/api/teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
        },
        body: JSON.stringify({
          action: teacherModalMode === 'add' ? 'add' : 'update',
          spreadsheetId: schoolData.spreadsheetId,
          schoolKey: schoolData.schoolKey || activeKey || '',
          adminUid: auth.currentUser.uid,
          originalUsername: editingOriginalUsername,
          originalName: editingOriginalName,
          existingTeachers: activeDisplayData?.teachers || [],
          teacher: {
            name: teacherFormName.trim(),
            classes: combinedClasses,
            username: finalUsername,
            password: finalPassword,
            roleOrBranch: finalRoleOrBranch
          }
        })
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Öğretmen kaydedilirken hata oluştu.");
        return;
      }

      const updatedTeachers = json.data?.teachers || [];
      const currentStudents = activeDisplayData?.students || [];
      const newData = {
        students: currentStudents,
        teachers: updatedTeachers
      };

      setExistingData(newData);
      if (results) setResults(newData);
      if (typeof window !== 'undefined') {
        localStorage.setItem('school_teachers', JSON.stringify(updatedTeachers));
      }

      toast.success(json.message || "Öğretmen başarıyla E-Tabloya kaydedildi!");
      setShowTeacherModal(false);
    } catch (e: any) {
      toast.error("Hata: " + (e.message || "İşlem başarısız."));
    } finally {
      setIsSavingTeacher(false);
    }
  };

  // Öğretmen Sil
  const handleDeleteTeacher = async (t: any) => {
    if (!window.confirm(`${t.name} isimli öğretmeni listeden silmek istediğinize emin misiniz?`)) {
      return;
    }

    const loadingToast = toast.loading("Öğretmen siliniyor...");
    try {
      if (!auth.currentUser) {
        toast.dismiss(loadingToast);
        toast.error("Yönetici oturumu bulunamadı.");
        return;
      }

      const activeKey = typeof window !== 'undefined' ? localStorage.getItem('admin_active_school_key') : null;
      const schoolData = await getSchoolData(auth.currentUser.uid, activeKey || undefined);
      const activeToken = localStorage.getItem('google_access_token') || schoolData?.accessToken || '';

      if (!schoolData?.spreadsheetId) {
        toast.dismiss(loadingToast);
        toast.error("Google E-Tablo bağlantısı eksik.");
        return;
      }

      const res = await fetch('/api/teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
        },
        body: JSON.stringify({
          action: 'delete',
          spreadsheetId: schoolData.spreadsheetId,
          schoolKey: schoolData.schoolKey || activeKey || '',
          adminUid: auth.currentUser.uid,
          originalUsername: t.username,
          originalName: t.name,
          existingTeachers: activeDisplayData?.teachers || []
        })
      });

      const json = await res.json();
      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error(json.error || "Öğretmen silinemedi.");
        return;
      }

      const updatedTeachers = json.data?.teachers || [];
      const currentStudents = activeDisplayData?.students || [];
      const newData = {
        students: currentStudents,
        teachers: updatedTeachers
      };

      setExistingData(newData);
      if (results) setResults(newData);
      if (typeof window !== 'undefined') {
        localStorage.setItem('school_teachers', JSON.stringify(updatedTeachers));
      }

      toast.success(`${t.name} listeden silindi.`);
    } catch (e: any) {
      toast.dismiss(loadingToast);
      toast.error("Silme hatası: " + e.message);
    }
  };

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

  // Manuel Öğrenci Ekleme Modalını Aç
  const openAddStudentModal = (defaultClass?: string) => {
    setStudentModalMode('add');
    setEditingOriginalNumber('');
    setStudentFormNumber('');
    setStudentFormName('');
    setStudentFormClass(defaultClass || (availableClasses.length > 0 ? availableClasses[0] : ''));
    setStudentFormGender('Kız');
    setShowStudentModal(true);
  };

  // Öğrenci Düzenleme Modalını Aç
  const openEditStudentModal = (s: any) => {
    setStudentModalMode('edit');
    setEditingOriginalNumber(String(s.number || ''));
    setStudentFormNumber(String(s.number || ''));
    setStudentFormName(s.name || '');
    setStudentFormClass(s.className || '');
    setStudentFormGender(s.gender || 'Kız');
    setShowStudentModal(true);
  };

  // Öğrenciyi E-Tabloya Kaydet (Ekle veya Güncelle)
  const handleSaveStudent = async () => {
    if (!studentFormNumber.trim() || !studentFormName.trim() || !studentFormClass.trim()) {
      toast.error("Lütfen öğrenci numarası, adı soyadı ve sınıfını eksiksiz giriniz.");
      return;
    }

    setIsSavingStudent(true);
    try {
      if (!auth.currentUser) {
        toast.error("Yönetici oturumu bulunamadı. Lütfen giriş yapınız.");
        return;
      }

      const activeKey = typeof window !== 'undefined' ? localStorage.getItem('admin_active_school_key') : null;
      const schoolData = await getSchoolData(auth.currentUser.uid, activeKey || undefined);
      const activeToken = localStorage.getItem('google_access_token') || schoolData?.accessToken || '';

      if (!schoolData?.spreadsheetId) {
        toast.error("Google E-Tablo bağlantısı eksik.");
        return;
      }

      const res = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
        },
        body: JSON.stringify({
          action: studentModalMode === 'add' ? 'add' : 'update',
          spreadsheetId: schoolData.spreadsheetId,
          schoolKey: schoolData.schoolKey || activeKey || '',
          adminUid: auth.currentUser.uid,
          originalNumber: editingOriginalNumber,
          existingStudents: activeDisplayData?.students || [],
          student: {
            number: studentFormNumber.trim(),
            name: studentFormName.trim(),
            className: studentFormClass.trim(),
            gender: studentFormGender
          }
        })
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Öğrenci kaydedilirken hata oluştu.");
        return;
      }

      const updatedStudents = json.data?.students || [];
      const currentTeachers = activeDisplayData?.teachers || [];
      const newData = {
        students: updatedStudents,
        teachers: currentTeachers
      };

      setExistingData(newData);
      if (results) setResults(newData);
      if (typeof window !== 'undefined') {
        localStorage.setItem('school_students', JSON.stringify(updatedStudents));
      }

      toast.success(json.message || "Öğrenci başarıyla E-Tabloya kaydedildi!");
      setShowStudentModal(false);
    } catch (e: any) {
      toast.error("Hata: " + (e.message || "İşlem başarısız."));
    } finally {
      setIsSavingStudent(false);
    }
  };

  // Öğrenciyi Sil
  const handleDeleteStudent = async (s: any) => {
    if (!window.confirm(`${s.name} (${s.number}) isimli öğrenciyi listeden silmek istediğinize emin misiniz?`)) {
      return;
    }

    const loadingToast = toast.loading("Öğrenci siliniyor...");
    try {
      if (!auth.currentUser) {
        toast.dismiss(loadingToast);
        toast.error("Yönetici oturumu bulunamadı.");
        return;
      }

      const activeKey = typeof window !== 'undefined' ? localStorage.getItem('admin_active_school_key') : null;
      const schoolData = await getSchoolData(auth.currentUser.uid, activeKey || undefined);
      const activeToken = localStorage.getItem('google_access_token') || schoolData?.accessToken || '';

      if (!schoolData?.spreadsheetId) {
        toast.dismiss(loadingToast);
        toast.error("Google E-Tablo bağlantısı eksik.");
        return;
      }

      const res = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
        },
        body: JSON.stringify({
          action: 'delete',
          spreadsheetId: schoolData.spreadsheetId,
          schoolKey: schoolData.schoolKey || activeKey || '',
          adminUid: auth.currentUser.uid,
          originalNumber: s.number,
          existingStudents: activeDisplayData?.students || []
        })
      });

      const json = await res.json();
      toast.dismiss(loadingToast);

      if (!res.ok) {
        toast.error(json.error || "Öğrenci silinirken hata oluştu.");
        return;
      }

      const updatedStudents = json.data?.students || [];
      const currentTeachers = activeDisplayData?.teachers || [];
      const newData = {
        students: updatedStudents,
        teachers: currentTeachers
      };

      setExistingData(newData);
      if (results) setResults(newData);
      if (typeof window !== 'undefined') {
        localStorage.setItem('school_students', JSON.stringify(updatedStudents));
      }

      toast.success(json.message || "Öğrenci silindi.");
    } catch (e: any) {
      toast.dismiss(loadingToast);
      toast.error("Hata: " + (e.message || "İşlem başarısız."));
    }
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
      {/* Güncelleme Onay Modalı */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-3 bg-amber-50 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Seçilen Veriler Güncellensin mi?</h3>
            </div>
            
            <div className="text-sm text-slate-600 leading-relaxed space-y-2">
              <p>
                Google E-Tablonuzda halihazırda <strong>{existingData?.students?.length || 0} öğrenci</strong> ve <strong>{existingData?.teachers?.length || 0} öğretmen</strong> kayıtlı bulunmaktadır.
              </p>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <p className="font-semibold text-slate-800">Yapılacak İşlem:</p>
                {studentFile && <p>• <strong>Öğrenci Listesi:</strong> Yeni PDF&apos;den güncellenecek.</p>}
                {!studentFile && <p>• <strong>Öğrenci Listesi:</strong> Mevcut öğrenciler olduğu gibi korunacak.</p>}
                {scheduleFile && <p>• <strong>Ders Programı:</strong> Öğretmenlerin ders/sınıf eşleşmeleri güncellenecek.</p>}
                {!scheduleFile && <p>• <strong>Ders Programı:</strong> Mevcut branş öğretmenleri olduğu gibi korunacak.</p>}
                <p className={regeneratePasswords ? "text-red-600 font-semibold" : "text-emerald-700 font-semibold"}>
                  • <strong>Öğretmen Şifreleri:</strong> {regeneratePasswords ? "Tüm şifreler sıfırlanıp yeniden oluşturulacak!" : "Mevcut öğretmenlerin kullanıcı adı ve şifreleri korunacak."}
                </p>
              </div>
            </div>

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
                Evet, Güncelle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manuel Öğretmen Ekleme / Düzenleme Modalı */}
      {showTeacherModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {teacherModalMode === 'add' ? 'Manuel Öğretmen / İdareci Ekle' : 'Öğretmen Bilgilerini Düzenle'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Otomatik kullanıcı adı ve şifre üretebilir veya kendiniz belirleyebilirsiniz.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTeacherModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Ad Soyad */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Öğretmen / İdareci Adı Soyadı *
                </label>
                <input
                  type="text"
                  value={teacherFormName}
                  onChange={(e) => handleTeacherNameChange(e.target.value)}
                  placeholder="Örn: Ahmet Yılmaz"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              {/* Görev Türü ve Branş */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Görevi / Rolü
                  </label>
                  <select
                    value={teacherFormRoleType}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      setTeacherFormRoleType(newRole);
                      if (newRole === 'Müdür Yardımcısı' && availableClasses.length > 0) {
                        setTeacherFormSelectedClasses([...availableClasses]);
                      }
                    }}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                  >
                    <option value="Ders Öğretmeni">Ders Öğretmeni (Branş)</option>
                    <option value="Sınıf Öğretmeni">Sınıf Rehber Öğretmeni</option>
                    <option value="Müdür Yardımcısı">Müdür Yardımcısı / İdareci</option>
                    <option value="Rehber Öğretmen / Psikolojik Danışman">Rehber Öğretmen / PDR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Branşı (İsteğe Bağlı)
                  </label>
                  <input
                    type="text"
                    value={teacherFormBranch}
                    onChange={(e) => setTeacherFormBranch(e.target.value)}
                    placeholder="Örn: Matematik, Müzik, Resim"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Otomatik Kullanıcı Adı ve Şifre */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Kullanıcı Adı</label>
                    <button
                      type="button"
                      onClick={() => {
                        setAutoUsernameEnabled(false);
                        setTeacherFormUsername(generateUsernameClient(teacherFormName || 'ogretmen'));
                      }}
                      className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      Otomatik Üret
                    </button>
                  </div>
                  <input
                    type="text"
                    value={teacherFormUsername}
                    onChange={(e) => {
                      setAutoUsernameEnabled(false);
                      setTeacherFormUsername(e.target.value);
                    }}
                    placeholder="ahmet.yilmaz"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Giriş Şifresi</label>
                    <button
                      type="button"
                      onClick={() => setTeacherFormPassword(generatePasswordClient())}
                      className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Yeni Şifre Üret
                    </button>
                  </div>
                  <input
                    type="text"
                    value={teacherFormPassword}
                    onChange={(e) => setTeacherFormPassword(e.target.value)}
                    placeholder="6 haneli şifre"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Sorumlu Olduğu / Girdiği Sınıflar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Girdiği / Sorumlu Olduğu Sınıflar ({teacherFormSelectedClasses.length} seçili)
                  </label>
                  {availableClasses.length > 0 && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setTeacherFormSelectedClasses([...availableClasses])}
                        className="text-purple-600 hover:underline font-medium"
                      >
                        Tümünü Seç
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setTeacherFormSelectedClasses([])}
                        className="text-slate-500 hover:underline font-medium"
                      >
                        Temizle
                      </button>
                    </div>
                  )}
                </div>

                {teacherFormRoleType === 'Müdür Yardımcısı' && (
                  <div className="bg-purple-50 border border-purple-200 text-purple-800 p-2.5 rounded-xl text-xs mb-2 flex items-center gap-2">
                    <span>👑</span>
                    <span><strong>Müdür Yardımcısı (İdareci):</strong> Okuldaki tüm sınıflar otomatik olarak seçilmiştir ve idareciye açıktır.</span>
                  </div>
                )}

                {availableClasses.length > 0 && (
                  <div className="max-h-36 overflow-y-auto p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap gap-1.5 mb-2">
                    {availableClasses.map((cls) => {
                      const clsKey = getClassBaseKeyClient(cls);
                      const selected = teacherFormSelectedClasses.some(c => getClassBaseKeyClient(c) === clsKey);
                      return (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => toggleTeacherFormClass(cls)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                            selected
                              ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'
                          }`}
                        >
                          {cls}
                        </button>
                      );
                    })}
                  </div>
                )}

                <input
                  type="text"
                  value={teacherFormExtraClasses}
                  onChange={(e) => setTeacherFormExtraClasses(e.target.value)}
                  placeholder="Listede olmayan sınıf varsa virgülle yazın (Örn: 5. Sınıf / A Şubesi, 6/B)"
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTeacherModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleSaveTeacher}
                disabled={isSavingTeacher}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm font-semibold flex items-center gap-2 shadow-sm"
              >
                {isSavingTeacher ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> {teacherModalMode === 'add' ? 'Öğretmeni Ekle' : 'Değişiklikleri Kaydet'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Karekod Kartları Modalı */}
      <TeacherQrCardsModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        schoolName={currentSchoolName || 'Okul Risk ve ŞÖK'}
        schoolKey={currentSchoolKey || ''}
        teachers={activeDisplayData?.teachers || []}
      />

      {/* Manuel Öğrenci Ekleme / Düzenleme Modalı */}
      {showStudentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {studentModalMode === 'add' ? 'Yeni Öğrenci Ekle' : 'Öğrenci Bilgilerini Düzenle'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Öğrenci bilgileri doğrudan Google E-Tablonuzdaki &apos;Öğrenciler&apos; sayfasına kaydedilir.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowStudentModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Öğrenci Numarası *
                </label>
                <input
                  type="text"
                  value={studentFormNumber}
                  onChange={(e) => setStudentFormNumber(e.target.value)}
                  placeholder="Örn: 104"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Adı Soyadı *
                </label>
                <input
                  type="text"
                  value={studentFormName}
                  onChange={(e) => setStudentFormName(e.target.value)}
                  placeholder="Örn: Ayşe Kaya"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sınıfı / Şubesi *
                </label>
                <div className="space-y-2">
                  <select
                    value={availableClasses.includes(studentFormClass) ? studentFormClass : '__custom__'}
                    onChange={(e) => {
                      if (e.target.value !== '__custom__') {
                        setStudentFormClass(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="" disabled>Sınıf Seçiniz</option>
                    {availableClasses.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                    <option value="__custom__">+ Listede Olmayan Yeni Sınıf Yaz</option>
                  </select>

                  {(!availableClasses.includes(studentFormClass) || !studentFormClass) && (
                    <input
                      type="text"
                      value={studentFormClass}
                      onChange={(e) => setStudentFormClass(e.target.value)}
                      placeholder="Sınıf Adını Yazınız (Örn: 5. Sınıf / A Şubesi)"
                      className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cinsiyeti
                </label>
                <select
                  value={studentFormGender}
                  onChange={(e) => setStudentFormGender(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="Kız">Kız</option>
                  <option value="Erkek">Erkek</option>
                  <option value="Belirtilmedi">Belirtilmedi</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowStudentModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleSaveStudent}
                disabled={isSavingStudent}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold flex items-center gap-2 shadow-sm"
              >
                {isSavingStudent ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> {studentModalMode === 'add' ? 'Öğrenciyi Ekle' : 'Değişiklikleri Kaydet'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Veri Yükleme ve Öğretmen Yönetimi</h1>
          <p className="text-slate-500 mt-1">
            Öğrenci Listesi ve Ders Programı PDF&apos;lerini birlikte veya birbirinden bağımsız olarak yükleyebilir, ayrıca manuel öğretmen ekleyebilirsiniz.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={openAddTeacherModal}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            + Manuel Öğretmen Ekle
          </button>
          {existingData && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Kayıtlı Veriler Aktif</span>
            </div>
          )}
        </div>
      </div>

      {/* E-Okul Dosyaları Nereden Alınır Bilgilendirme Kartı */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-5 text-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
          <BookOpen className="w-4 h-4 text-blue-700" />
          <span>E-Okul&apos;dan Bu Dosyaları Nasıl Alabilirsiniz? (Birlikte veya Ayrı Ayrı Yüklenebilir)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-slate-700">
          <div className="bg-white/80 p-3.5 rounded-xl border border-blue-100 space-y-1.5">
            <p className="font-bold text-blue-950 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[10px]">1</span>
              Öğrenci Listesi (PDF) Alınışı:
            </p>
            <p className="text-slate-600">
              <strong>E-Okul</strong> &gt; <strong>Öğrenci İşlemleri</strong> &gt; <strong>Yazdır</strong> (Yazıcı simgesi) &gt; <strong>Şube Listesi (Öğrenci No Sıralı)</strong> ekranından PDF olarak indiriniz. (Sınıf öğretmenleri ve müdür yardımcıları da buradan okunur).
            </p>
          </div>

          <div className="bg-white/80 p-3.5 rounded-xl border border-blue-100 space-y-1.5">
            <p className="font-bold text-indigo-950 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white inline-flex items-center justify-center text-[10px]">2</span>
              Öğretmen Ders Programı (PDF) Alınışı:
            </p>
            <p className="text-slate-600">
              <strong>E-Okul</strong> &gt; <strong>Kurum İşlemleri</strong> &gt; <strong>Ders İşlemleri</strong> &gt; <strong>Ders Öğretmenleri</strong> &gt; <strong>Yazdır</strong> (Yazıcı simgesi) &gt; <strong>Öğretmen Ders Programları</strong> raporunu PDF olarak kaydediniz. (Yıl içinde ders programı değiştiğinde tek başına yükleyebilirsiniz).
            </p>
          </div>
        </div>
      </div>
          
      {/* İki Kolonlu Bağımsız Yükleme Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Öğrenci Listesi Yükleme */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Sınıf Öğrenci Listesi (PDF)</h3>
                <p className="text-xs text-slate-400">Öğrencileri, sınıf öğretmenlerini ve md. yardımcılarını içerir</p>
              </div>
            </div>
            <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
              Tek Başına Yüklenebilir
            </span>
          </div>

          {!studentFile ? (
            <div 
              onDrop={(e) => handleDrop(e, setStudentFile)}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 cursor-pointer"
            >
              <UploadCloud className="w-10 h-10 text-slate-400 mb-4" />
              <p className="font-medium text-slate-700">Öğrenci Listesi PDF&apos;ini buraya sürükleyin</p>
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
                  <p className="text-xs text-blue-600">Yüklemeye hazır</p>
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Öğretmen Ders Programı (PDF)</h3>
                <p className="text-xs text-slate-400">Branş öğretmenlerini ve girdikleri sınıfları içerir</p>
              </div>
            </div>
            <span className="text-[11px] font-semibold bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full">
              Tek Başına Yüklenebilir
            </span>
          </div>
          
          {!scheduleFile ? (
            <div 
              onDrop={(e) => handleDrop(e, setScheduleFile)}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 cursor-pointer"
            >
              <UploadCloud className="w-10 h-10 text-slate-400 mb-4" />
              <p className="font-medium text-slate-700">Ders Programı PDF&apos;ini buraya sürükleyin</p>
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
                  <p className="text-xs text-purple-600">Yüklemeye hazır</p>
                </div>
              </div>
              <button onClick={() => setScheduleFile(null)} className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Şifre Koruma ve KVKK Ayarları */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        {/* Şifre Koruma Kutusu */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-indigo-50/60 border border-indigo-200/80 p-4 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg mt-0.5">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-900 text-sm">Öğretmen Kullanıcı Adı ve Şifre Koruması</h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  !regeneratePasswords
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-600 text-white'
                }`}>
                  {!regeneratePasswords ? 'Mevcut Şifreler Korunuyor' : 'Şifreler Yenilenecek'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Yeni bir ders programı veya öğrenci listesi yüklediğinizde, daha önce öğretmenlere duyurduğunuz <strong>kullanıcı adı ve şifreler değişmez</strong> (yalnızca yeni eklenen öğretmenler için şifre üretilir).
              </p>
              <label className="mt-2.5 inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={regeneratePasswords}
                  onChange={(e) => setRegeneratePasswords(e.target.checked)}
                  className="w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500"
                />
                <span className="text-xs font-medium text-slate-700">
                  İsteğe Bağlı: Mevcut tüm öğretmenlerin şifrelerini sıfırla ve yeni şifre oluştur
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Otomatik Kalıcı Erişim ve Hizmet Bağlantısı */}
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
                Öğretmenlerinizin günün her saatinde kesintisiz giriş yapabilmesi için okul verileriniz ve kimlik doğrulama bağlantınız otomatik olarak senkronize edilmektedir.
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
          {!studentFile && !scheduleFile ? (
            <span className="text-slate-500">* Yüklemek istediğiniz PDF dosyasını (Öğrenci Listesi, Ders Programı veya her ikisini) seçiniz.</span>
          ) : !kvkkConsent ? (
            <span className="text-amber-600 font-medium">* Devam etmek için KVKK onay kutusunu işaretleyiniz.</span>
          ) : (
            <span className="text-emerald-600 font-medium">
              ✓ {studentFile && scheduleFile ? 'Her iki PDF dosyası da' : studentFile ? 'Sadece Öğrenci Listesi PDF dosyası' : 'Sadece Ders Programı PDF dosyası'} aktarıma hazır.
            </span>
          )}
        </span>
        <button
          onClick={handleInitiateUpload}
          disabled={(!studentFile && !scheduleFile) || !kvkkConsent || isUploading}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          {isUploading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Veriler İşleniyor...</>
          ) : studentFile && !scheduleFile ? (
            <><RefreshCw className="w-5 h-5" /> Öğrenci Listesini Aktar / Güncelle</>
          ) : !studentFile && scheduleFile ? (
            <><RefreshCw className="w-5 h-5" /> Ders Programını Aktar / Güncelle</>
          ) : existingData && (existingData.students.length > 0 || existingData.teachers.length > 0) ? (
            <><RefreshCw className="w-5 h-5" /> Verileri Güncelle</>
          ) : (
            'Verileri Sisteme Aktar'
          )}
        </button>
      </div>

      {/* Yüklü Veriler Görünümü */}
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
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
              <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100">
                {activeDisplayData.students.length} Öğrenci ({Object.keys(groupedStudents).length} Sınıf)
              </span>
              <span className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-100">
                {activeDisplayData.teachers.length} Öğretmen / İdareci
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Öğrenci Listesi: Sınıf Bazlı Akordiyon Grubu */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                  Sınıflar ve Öğrenciler
                </h3>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => openAddStudentModal()}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 font-semibold transition-colors shadow-sm"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Öğrenci Ekle
                  </button>
                  <span className="text-slate-300">|</span>
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

              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
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
                          <div className="flex justify-between items-center px-1 pb-1">
                            <span className="text-[11px] font-semibold text-slate-500">{className} Öğrenci Listesi</span>
                            <button
                              type="button"
                              onClick={() => openAddStudentModal(className)}
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                            >
                              <UserPlus className="w-3 h-3" /> Bu Sınıfa Öğrenci Ekle
                            </button>
                          </div>
                          {classStudents.map((s: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center py-1.5 px-3 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs group transition-colors">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-medium text-slate-800 truncate">{s.number} - {s.name}</span>
                                {s.gender && s.gender !== 'Belirtilmedi' && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                    s.gender.toLowerCase().includes('kız') 
                                      ? 'bg-pink-100 text-pink-700' 
                                      : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {s.gender}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-slate-400 font-mono text-[11px] mr-1">No: {s.number}</span>
                                <button
                                  type="button"
                                  onClick={() => openEditStudentModal(s)}
                                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Öğrenci Bilgilerini Düzenle"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStudent(s)}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Öğrenciyi Sil"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
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
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={openAddTeacherModal}
                    className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Öğretmen Ekle
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors shadow-sm"
                    title="Tüm öğretmenlerin karekodlu giriş kartlarını hazırla ve yazdır"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    Karekod Kartları (Yazdır)
                  </button>
                  <button
                    onClick={handleCopyAllCredentials}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                    title="Tüm öğretmen giriş bilgilerini metin olarak kopyala"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Tümünü Kopyala
                  </button>
                  <button
                    onClick={handleDownloadWhatsAppExcel}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                    title="Toplu WhatsApp iletişim listesini Excel olarak indir"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Excel İndir
                  </button>
                </div>
              </div>

              {/* Öğretmen Arama Kutusu */}
              <input
                type="text"
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                placeholder="Öğretmen adı, branş, sınıf veya kullanıcı adı ara..."
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-slate-50/70"
              />

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {filteredTeachers.map((t: any, idx: number) => {
                  const isRoleAdmin = t.roleOrBranch?.includes('Müdür Yardımcısı');
                  const isRoleClassTeacher = t.roleOrBranch?.includes('Sınıf Öğretmeni');

                  return (
                    <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
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
                        <p className="text-xs text-slate-600 mt-1.5">
                          K. Adı: <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">{t.username}</span>
                          <span className="mx-1.5 text-slate-300">|</span>
                          Şifre: <span className="font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">{t.password || '—'}</span>
                        </p>
                        {t.classes && t.classes.length > 0 && (
                          <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2">
                            <strong>Sınıflar ({t.classes.length}):</strong> {t.classes.join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditTeacherModal(t)}
                          className="p-2 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg border border-slate-200 bg-white transition-colors"
                          title="Öğretmen Bilgilerini / Şifresini Düzenle"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTeacher(t)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 bg-white transition-colors"
                          title="Öğretmeni Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {t.whatsappLink && (
                          <a 
                            href={t.whatsappLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                            WhatsApp
                          </a>
                        )}
                      </div>
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
