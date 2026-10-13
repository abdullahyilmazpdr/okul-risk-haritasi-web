'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Save, 
  AlertCircle, 
  MessageSquarePlus, 
  CheckCircle2, 
  ShieldAlert, 
  User, 
  Calendar,
  Sparkles,
  Info,
  Lock,
  Edit3
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MEB_OFFICIAL_RISK_ITEMS } from '@/lib/meb-risk-items';
import { FALLBACK_STUDENTS } from '@/lib/school-constants';

function StudentDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const classId = (params?.classId as string) || '1';
  const studentId = (params?.studentId as string) || '1';
  
  const [student, setStudent] = useState<any>({
    number: studentId,
    name: `Öğrenci #${studentId}`,
    gender: 'Belirtilmemiş',
    className: 'Sınıf'
  });

  const [teacher, setTeacher] = useState<any>(null);
  const [sokOpinion, setSokOpinion] = useState('');
  const [selectedRisks, setSelectedRisks] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [otherOpinions, setOtherOpinions] = useState<any[]>([]);

  // Oturum ve öğrenci verilerini yükleme
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedSession = localStorage.getItem('teacher_session');
    if (!storedSession) {
      router.push('/teacher/login');
      return;
    }

    try {
      const parsedTeacher = JSON.parse(storedSession);
      setTeacher(parsedTeacher);

      const teacherUser = (parsedTeacher.username || '').toLowerCase().trim();

      // Öğrenci bilgilerini school_students'tan bul
      const storedStudentsRaw = localStorage.getItem('school_students');
      if (storedStudentsRaw) {
        try {
          const list = JSON.parse(storedStudentsRaw);
          if (Array.isArray(list)) {
            const found = list.find((s: any) => String(s.number).trim() === String(studentId).trim() || String(s.id).trim() === String(studentId).trim());
            if (found) {
              setStudent(found);
            }
          }
        } catch (e) {}
      }

      // Canlı API'den de öğrenci bilgilerini teyit et
      fetch('/api/school-data')
        .then(res => res.json())
        .then(data => {
          if (data?.data?.students && Array.isArray(data.data.students)) {
            localStorage.setItem('school_students', JSON.stringify(data.data.students));
            const found = data.data.students.find((s: any) => String(s.number).trim() === String(studentId).trim());
            if (found) {
              setStudent(found);
            }
          }
        })
        .catch(() => {});

      // 1. Yapılandırılmış öğrenci verisini oku (student_eval_NO)
      const storedEval = localStorage.getItem(`student_eval_${studentId}`);
      let currentRisks: number[] = [];
      let mySavedOpinion = '';
      const otherList: any[] = [];

      if (storedEval) {
        try {
          const evalObj = JSON.parse(storedEval);
          if (Array.isArray(evalObj.risks)) {
            currentRisks = evalObj.risks;
            setSelectedRisks(new Set(evalObj.risks));
          }

          if (evalObj.opinions && typeof evalObj.opinions === 'object') {
            for (const [uKey, opData] of Object.entries<any>(evalObj.opinions)) {
              if (uKey.toLowerCase().trim() === teacherUser) {
                mySavedOpinion = opData.opinion || '';
              } else if (opData.opinion && opData.opinion.trim()) {
                otherList.push(opData);
              }
            }
          }
        } catch (e) {}
      } else {
        // Eski tekil önbellek varsa ve sadece bu öğretmene aitse oku
        const legacyCached = localStorage.getItem(`opinion_${studentId}`);
        if (legacyCached) {
          try {
            const legacyData = JSON.parse(legacyCached);
            if (legacyData.risks && Array.isArray(legacyData.risks)) {
              setSelectedRisks(new Set(legacyData.risks));
            }
            // Yalnızca eski kaydı yazan kullanıcı adı bu öğretmen ise kişisel kutuya aktar
            if (legacyData.teacherUsername && legacyData.teacherUsername.toLowerCase().trim() === teacherUser) {
              mySavedOpinion = legacyData.opinion || '';
            } else if (legacyData.opinion && (parsedTeacher.isClassTeacher || parsedTeacher.isAdmin)) {
              // Sınıf öğretmeni veya idareci ise eski görüşü sadece bu öğretmene ait say
              if (!legacyData.teacherUsername) {
                mySavedOpinion = legacyData.opinion || '';
              }
            }
          } catch (e) {}
        }
      }

      setSokOpinion(mySavedOpinion);
      setOtherOpinions(otherList);

      // 2. Google Sheets veya sunucudan da arka planda görüşleri sorgula
      const storedSpreadsheetId = localStorage.getItem('active_spreadsheet_id');
      const storedToken = localStorage.getItem('google_access_token');
      const schoolKey = parsedTeacher?.schoolKey || localStorage.getItem('last_school_key') || '';

      const opinionFetchUrl = new URL(`/api/student-opinion`, window.location.origin);
      opinionFetchUrl.searchParams.set('studentNumber', String(studentId));
      if (storedSpreadsheetId) opinionFetchUrl.searchParams.set('spreadsheetId', storedSpreadsheetId);
      if (schoolKey) opinionFetchUrl.searchParams.set('schoolKey', schoolKey);

      fetch(opinionFetchUrl.toString(), {
        headers: storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {}
      })
        .then(res => res.json())
          .then(json => {
            if (json.success && Array.isArray(json.opinions) && json.opinions.length > 0) {
              const remoteOthers: any[] = [];
              for (const op of json.opinions) {
                if (op.teacherName === parsedTeacher.name || op.teacherName === parsedTeacher.username) {
                  // Canlı E-Tablo verisi her zaman yerel önbellekten önceliklidir
                  if (op.opinion) {
                    setSokOpinion(op.opinion);
                  }
                } else if (op.opinion) {
                  remoteOthers.push({
                    teacherName: op.teacherName || 'Öğretmen',
                    branch: op.branch || 'Branş Öğretmeni',
                    opinion: op.opinion,
                    date: op.date || ''
                  });
                }
                if (op.risks && Array.isArray(op.risks) && op.risks.length > 0) {
                  setSelectedRisks(new Set(op.risks));
                }
              }
              if (remoteOthers.length > 0) {
                setOtherOpinions(prev => {
                  const map = new Map();
                  [...prev, ...remoteOthers].forEach(item => map.set(item.teacherName + item.opinion, item));
                  return Array.from(map.values());
                });
              }
            }
          })
          .catch(() => {});
    } catch (e) {}
  }, [student.number, router]);

  // Rol ayrımı kuralları:
  const isAdmin = Boolean(teacher?.isAdmin || teacher?.role?.toLowerCase().includes('müdür') || teacher?.role?.toLowerCase().includes('idare'));
  const isClassTeacher = Boolean(teacher?.isClassTeacher || teacher?.role?.toLowerCase().includes('sınıf') || teacher?.role?.toLowerCase().includes('rehber'));
  const isSubjectTeacher = !isAdmin && !isClassTeacher;

  const toggleRisk = (index: number) => {
    if (isSubjectTeacher) {
      toast.error('Risk Haritası sadece Sınıf Rehber Öğretmeni ve İdareciler tarafından doldurulabilir.');
      return;
    }
    const newSelected = new Set(selectedRisks);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRisks(newSelected);
  };

  const handleSave = async () => {
    // Sınıf Öğretmeni için kontrol
    if (isClassTeacher && selectedRisks.size === 0 && !sokOpinion.trim()) {
      toast.error('Lütfen risk maddelerini işaretleyin ve ŞÖK görüşünüzü girin.');
      return;
    }

    // Ders Öğretmeni için kontrol
    if (isSubjectTeacher && !sokOpinion.trim()) {
      toast.error('Lütfen dersinizle ilgili ŞÖK görüşünüzü girin.');
      return;
    }

    setIsSaving(true);
    const saveToast = toast.loading('Bilgiler kaydediliyor...');

    try {
      const storedSpreadsheetId = typeof window !== 'undefined' ? localStorage.getItem('active_spreadsheet_id') : null;
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('google_access_token') : null;
      const teacherUser = (teacher?.username || 'ogretmen').toLowerCase().trim();
      const teacherDisplayName = teacher?.name || teacher?.username || 'Öğretmen';
      const teacherBranch = teacher?.role || 'Öğretmen';
      const todayStr = new Date().toLocaleDateString('tr-TR');
      const sNum = String(student.number || studentId);

      // 1. Yapılandırılmış yerel depolamaya kaydet (öğretmenler birbirinden izole)
      let evalData: any = { risks: [], opinions: {} };
      const existingStored = localStorage.getItem(`student_eval_${sNum}`);
      if (existingStored) {
        try {
          evalData = JSON.parse(existingStored);
        } catch (e) {}
      }

      if (isClassTeacher || isAdmin) {
        evalData.risks = Array.from(selectedRisks);
      }

      if (!evalData.opinions) evalData.opinions = {};
      evalData.opinions[teacherUser] = {
        teacherName: teacherDisplayName,
        branch: teacherBranch,
        opinion: sokOpinion.trim(),
        date: todayStr
      };

      localStorage.setItem(`student_eval_${sNum}`, JSON.stringify(evalData));
      // Eski ortak anahtarı temizle ki diğer öğretmenlere karışmasın
      localStorage.removeItem(`opinion_${sNum}`);

      // 2. Google E-Tabloya yaz (Otomatik Yeniden Deneme / Retry Koruması ile)
      const sessionToken = localStorage.getItem('teacher_session_token') || teacher?.sessionToken || '';

      const makeRequest = async (isRetry = false): Promise<any> => {
        const response = await fetch('/api/student-opinion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentNumber: sNum,
            studentName: student.name || `Öğrenci #${sNum}`,
            className: student.className || 'Sınıf',
            teacherName: teacherDisplayName,
            branch: teacherBranch,
            opinion: sokOpinion.trim(),
            risks: isClassTeacher || isAdmin ? Array.from(selectedRisks) : [],
            spreadsheetId: storedSpreadsheetId,
            accessToken: storedToken,
            schoolKey: teacher?.schoolKey || localStorage.getItem('last_school_key') || '',
            sessionToken
          })
        });

        if (response.status === 429 && !isRetry) {
          toast.loading('Google API kota yoğunluğu nedeniyle 4 saniye sonra tekrar deneniyor...', { id: 'retry-toast', duration: 3500 });
          await new Promise(r => setTimeout(r, 4000));
          return makeRequest(true);
        }

        return response.json().then(data => ({ ok: response.ok, data }));
      };

      const result = await makeRequest();
      if (!result.ok || !result.data?.success) {
        throw new Error(result.data?.error || 'Google E-Tabloya veri yazılamadı.');
      }

      toast.dismiss(saveToast);
      toast.success(
        isClassTeacher 
          ? `${student.name} için Risk Haritası ve ŞÖK görüşünüz başarıyla E-Tabloya kaydedildi!`
          : `${student.name} için ŞÖK görüşünüz başarıyla E-Tabloya kaydedildi!`
      );
    } catch (err: any) {
      toast.dismiss(saveToast);
      toast.error('Kayıt hatası: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtrelenmiş MEB risk maddeleri
  const filteredRiskItems = MEB_OFFICIAL_RISK_ITEMS.filter(item => 
    item.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Üst Başlık ve Geri Dönüş */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link 
            href={`/teacher/class/${classId}`} 
            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                No: {student.number}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                {student.gender}
              </span>
              <span className="text-xs text-slate-400">|</span>
              <span className="text-xs text-indigo-600 font-medium line-clamp-1">
                {student.className}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{student.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-xs text-slate-500 block">Yetkiniz:</span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              isAdmin 
                ? 'bg-purple-100 text-purple-800' 
                : isClassTeacher 
                ? 'bg-emerald-100 text-emerald-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {isAdmin ? 'İdareci (Tam Yetkili)' : isClassTeacher ? 'Sınıf Rehber Öğretmeni' : 'Ders / Branş Öğretmeni'}
            </span>
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Kaydediliyor...' : 'Görüşümü Kaydet'}
          </button>
        </div>
      </div>

      {/* Sınıf Öğretmeni ise veya İdareci ise 2 kolon; Ders Öğretmeni ise sadece ŞÖK görüşü tek kolon */}
      <div className={`grid grid-cols-1 ${!isSubjectTeacher ? 'lg:grid-cols-2' : ''} gap-8`}>
        
        {/* ŞÖK Öğretmen Görüşü (Tüm Öğretmenler Kendi Görüşünü Yazar ve Değiştirebilir) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <MessageSquarePlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {isSubjectTeacher ? 'Ders Öğretmeni ŞÖK Görüşü' : 'Kişisel ŞÖK Görüşünüz'}
                </h2>
                <p className="text-xs text-slate-400">
                  {isSubjectTeacher 
                    ? 'Bu alana kendi dersinizle ilgili değerlendirmenizi yazınız. Dilediğiniz zaman güncelleyebilirsiniz.'
                    : 'Öğrencinin genel durumu ve kurul kararları hakkındaki görüşünüz.'
                  }
                </p>
              </div>
            </div>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 mb-4 flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <span>
                Öğrencinin kendi dersinizdeki akademik performansı, katılımı, devam durumu ve ödev alışkanlıkları hakkındaki görüşlerinizi yazınız.
              </span>
            </div>
            
            <textarea
              value={sokOpinion}
              onChange={(e) => setSokOpinion(e.target.value)}
              placeholder="Örn: Derse düzenli katılım göstermektedir. Bireysel etkinliklerde istekli, ancak grup çalışmalarında yönlendirmeye ihtiyaç duyuyor..."
              className="w-full min-h-[260px] p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm text-slate-800 leading-relaxed placeholder:text-slate-400"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
              {teacher?.name || teacher?.username || 'Öğretmen'} (Görüşünüzü dilediğiniz zaman değiştirebilirsiniz)
            </span>
            <span>{sokOpinion.length} Karakter</span>
          </div>
        </div>

        {/* MEB Okul Risk Haritası Modülü (SADECE SINIF REHBER ÖĞRETMENİ VE İDARECİYE AÇIK) */}
        {!isSubjectTeacher && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">MEB Okul Risk Haritası (36 Madde)</h2>
                    <p className="text-xs text-slate-400">Sınıf Rehber Öğretmeni Zorunlu Girişi</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                  selectedRisks.size > 0 
                    ? 'bg-amber-100 text-amber-800 border-amber-200' 
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {selectedRisks.size} / 36 Risk Seçili
                </span>
              </div>

              {/* Arama Çubuğu */}
              <div className="mb-3">
                <input 
                  type="text"
                  placeholder="36 risk maddesi içinde ara (örn: devamsızlık, şiddet, vefat)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              
              {/* 36 Resmi Madde Listesi */}
              <div className="overflow-y-auto max-h-[300px] pr-1 space-y-2 scrollbar-thin">
                {filteredRiskItems.map((item, index) => {
                  const originalIndex = MEB_OFFICIAL_RISK_ITEMS.indexOf(item);
                  const isSelected = selectedRisks.has(originalIndex);
                  return (
                    <label 
                      key={originalIndex} 
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="pt-0.5">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          checked={isSelected}
                          onChange={() => toggleRisk(originalIndex)}
                        />
                      </div>
                      <span className="text-xs font-medium select-none leading-relaxed">
                        {originalIndex + 1}. {item}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
              <span>* Seçilen maddeler okul risk haritası matrisine otomatik yansıtılır.</span>
            </div>
          </div>
        )}
      </div>

      {/* DİĞER ÖĞRETMENLERİN ŞÖK GÖRÜŞLERİ:
          - Sınıf Rehber Öğretmeni ve İdareci: TÜM branş öğretmenlerinin yazdığı görüşleri görebilir (ancak başkasının görüşünü DEĞİŞTİREMEZ).
          - Ders Öğretmeni: Diğer öğretmenlerin görüşlerini göremez.
      */}
      {!isSubjectTeacher && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Diğer Branş Öğretmenlerinin ŞÖK Görüşleri ({otherOpinions.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Sınıf öğretmeni ve idareciler bu görüşleri kurul kararları için okuyabilir; ancak öğretmenlerin orijinal görüşleri değiştirilemez.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Lock className="w-3.5 h-3.5 text-slate-400" /> Salt Okunur
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherOpinions.map((op, idx) => (
              <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                      {op.teacherName[0]}
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">{op.teacherName}</span>
                      <span className="text-[11px] text-slate-400">{op.branch}</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                    <Calendar className="w-3 h-3" /> {op.date}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
                  "{op.opinion}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentDetailsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Yükleniyor...</div>}>
      <StudentDetailsContent />
    </Suspense>
  );
}
