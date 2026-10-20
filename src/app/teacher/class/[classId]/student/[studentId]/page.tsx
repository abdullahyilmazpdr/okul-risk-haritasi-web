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
  const [otherRiskNote, setOtherRiskNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [otherOpinions, setOtherOpinions] = useState<any[]>([]);

  // Grup Eğitimine Hazırlık Eğitimi Durumu ve Seçilen Günler
  const [isGroupTraining, setIsGroupTraining] = useState(false);
  const [groupDays, setGroupDays] = useState<string[]>([]);
  const WEEK_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];

  // Hazır ŞÖK Görüşü Şablonları Durumu
  type TemplateTabKey = 'ozel_egitim' | 'oz_bakim' | 'positive' | 'support' | 'bep';
  const [activeTemplateTab, setActiveTemplateTab] = useState<TemplateTabKey>('ozel_egitim');
  const [showTemplates, setShowTemplates] = useState(true);

  const SUBJECT_PREFIX_TAGS = [
    '[Genel Görüş]:',
    '[Özel Eğitim / BEP]:',
    '[Öz Bakım & Günlük Yaşam]:',
    '[İletişim & Sosyal Uyum]:',
    '[Ders İçi Katılım]:',
    '[Uygulama / Atölye]:',
    '[Görsel Sanatlar]:',
    '[Müzik]:',
    '[Beden Eğitimi]:'
  ];

  const SOK_OPINION_TEMPLATES: Record<TemplateTabKey, { title: string; items: string[] }> = {
    ozel_egitim: {
      title: 'Özel Eğitim & BEP',
      items: [
        'BEP (Bireyselleştirilmiş Eğitim Programı) kapsamındaki kısa ve uzun dönemli hedeflerde bireysel hızına uygun ilerleme göstermektedir.',
        'Öğretim sürecinde fiziksel, sözel ve model olma ipuçları kullanıldığında beceri basamaklarını başarıyla tamamlamaktadır.',
        'Göz kontağı kurma, ortak dikkat oluşturma ve tek basamaklı alıcı dil yönergelerini yerine getirme becerileri gelişmektedir.',
        'Akademik ve işlevsel becerilerin kalıcılığı için çoklu duyuya hitap eden somut materyal ve görsel kartlarla desteklenmelidir.',
        'Bireysel eğitimden grup eğitimine geçiş sürecinde akranlarıyla aynı ortamda bulunma ve etkinlik sürdürme süresi artmaktadır.',
        'Problem davranışların azaltılması ve olumlu davranışların pekiştirilmesi amacıyla uygulanan pekiştirme tarifelerine olumlu yanıt vermektedir.'
      ]
    },
    oz_bakim: {
      title: 'Öz Bakım & Günlük Yaşam',
      items: [
        'Yemek yeme, el-yüz yıkama ve kişisel temizlik gibi temel öz bakım becerilerini bağımsız veya kısmi ipucuyla yerine getirmektedir.',
        'Giyinme-soyunma, eşyalarını toplama ve sınıf içi günlük yaşam rutinlerini takip etme becerilerinde olumlu gelişim gözlenmektedir.',
        'Tuvalet ve öz bakım rutinlerinde bağımsızlığının artırılması için okul ve ev ortamında tutarlı ipucu sunumu sürdürülmelidir.',
        'Beslenme saatlerinde ve ortak kullanım alanlarında güvenlik ile hijyen kurallarına uyum sağlamaktadır.',
        'Günlük yaşam ve toplumsal uyum becerilerinin ev ortamına genellenmesi için aile katılımı ve ev tekrarları büyük önem taşımaktadır.'
      ]
    },
    positive: {
      title: 'Olumlu / Güçlü Yönler',
      items: [
        'Ders içi etkinliklere istekle katılır ve verilen yönergeleri takip eder.',
        'Akranlarıyla uyumlu iletişim kurar, grup çalışmalarına olumlu katkı sağlar.',
        'Verilen görev ve sorumlulukları zamanında yerine getirmeye özen gösterir.',
        'Uygulamalı, sanatsal ve sportif çalışmalarda ilgi ve motivasyonu yüksektir.',
        'Sınıf içi kurallara uyar, öğretmenleriyle iş birliğine açıktır.',
        'İnce ve kaba motor beceri gerektiren atölye/uygulama etkinliklerinde el-göz koordinasyonu gelişmektedir.'
      ]
    },
    support: {
      title: 'Desteklenecek Alanlar',
      items: [
        'Dikkat süresinin artırılması için kısa, net ve somut yönergelerle desteklenmelidir.',
        'İfade edici dil ve iletişim başlatma becerilerinin geliştirilmesi için alternatif/destekleyici iletişim etkinlikleri artırılmalıdır.',
        'Duyusal hassasiyetleri ve duygusal öz düzenleme becerileri göz önünde bulundurularak sakinleştirici geçiş rutinleri uygulanmalıdır.',
        'İnce motor, kalem tutma ve el-göz koordinasyonu gerektiren etkinliklerde adım adım fiziksel/sözel rehberlik sunulmalıdır.',
        'Sosyal uyum ve özgüven gelişimi için sınıf içi küçük görev ve sorumluluklar verilerek teşvik edilmelidir.'
      ]
    },
    bep: {
      title: 'Kurul & ŞÖK Kararları',
      items: [
        'BEP hedefleri doğrultusunda görsel ve somut materyallerle bireyselleştirilmiş öğretimin sürdürülmesi uygundur.',
        'Öğrencinin grup eğitimine uyum düzeyini artırmak amacıyla haftalık belirli günlerde grup eğitimine hazırlık programına katılımı faydalı olacaktır.',
        'Devam-devamsızlık takibinin düzenli yapılması ve okul-aile-rehberlik servisi iş birliğinin güçlendirilmesi önerilir.',
        'Mevcut özel eğitim / eğitim-öğretim ortamında bireysel farklılıkları gözetilerek desteklenmeye devam edilmesi uygundur.'
      ]
    }
  };

  const handleInsertSubjectTag = (tag: string) => {
    setSokOpinion(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return `${tag} `;
      return `${trimmed}\n${tag} `;
    });
  };

  const handleToggleTemplateSentence = (sentence: string) => {
    setSokOpinion(prev => {
      if (prev.includes(sentence)) {
        // Zaten ekliyse çıkar
        return prev
          .replace(sentence, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
      }
      const trimmed = prev.trim();
      if (!trimmed) return sentence;
      const needsSpace = !trimmed.endsWith('\n') && !trimmed.endsWith(' ');
      return `${trimmed}${needsSpace ? ' ' : ''}${sentence}`;
    });
  };

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
      const storedSpreadsheetIdForSchool = parsedTeacher?.spreadsheetId || localStorage.getItem('active_spreadsheet_id') || '';
      const schoolKeyForSchool = parsedTeacher?.schoolKey || localStorage.getItem('last_school_key') || '';
      const schoolFetchUrl = new URL('/api/school-data', window.location.origin);
      if (storedSpreadsheetIdForSchool) schoolFetchUrl.searchParams.set('spreadsheetId', storedSpreadsheetIdForSchool);
      if (schoolKeyForSchool) schoolFetchUrl.searchParams.set('schoolKey', schoolKeyForSchool);

      fetch(schoolFetchUrl.toString())
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

          if (Array.isArray(evalObj.groupTrainingDays) && evalObj.groupTrainingDays.length > 0) {
            setIsGroupTraining(true);
            setGroupDays(evalObj.groupTrainingDays);
          }

          if (evalObj.otherRiskNote) {
            setOtherRiskNote(evalObj.otherRiskNote);
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
            if (Array.isArray(legacyData.groupTrainingDays) && legacyData.groupTrainingDays.length > 0) {
              setIsGroupTraining(true);
              setGroupDays(legacyData.groupTrainingDays);
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
                if (op.groupTrainingDays && Array.isArray(op.groupTrainingDays) && op.groupTrainingDays.length > 0) {
                  setIsGroupTraining(true);
                  setGroupDays(op.groupTrainingDays);
                }
                if (op.otherRiskNote) {
                  setOtherRiskNote(op.otherRiskNote);
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

  // Rol ayrımı kuralları (Özel Eğitim okullarında bir sınıftaki iki Özel Eğitim öğretmeni de Sınıf Öğretmenidir):
  const isAdmin = Boolean(teacher?.isAdmin || teacher?.role?.toLowerCase().includes('müdür') || teacher?.role?.toLowerCase().includes('idare'));
  const isClassTeacher = Boolean(
    teacher?.isClassTeacher ||
    teacher?.role?.toLowerCase().includes('sınıf') ||
    teacher?.role?.toLowerCase().includes('rehber') ||
    teacher?.role?.toLowerCase().includes('özel eğitim')
  );
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

      const activeGroupDays = isGroupTraining ? groupDays : [];

      if (isClassTeacher || isAdmin) {
        evalData.risks = Array.from(selectedRisks);
        evalData.groupTrainingDays = activeGroupDays;
        evalData.otherRiskNote = otherRiskNote.trim();
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
            groupTrainingDays: isClassTeacher || isAdmin ? activeGroupDays : [],
            otherRiskNote: isClassTeacher || isAdmin ? otherRiskNote.trim() : '',
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

      {/* Sınıf Öğretmeni veya İdareci ise: SOLDA TÜM RİSKLER (Tümü görünecek şekilde uzanır), SAĞDA ŞÖK GÖRÜŞÜ & GRUP EĞİTİMİ. Ders Öğretmeni ise sadece ŞÖK görüşü. */}
      <div className={`grid grid-cols-1 ${!isSubjectTeacher ? 'lg:grid-cols-2 items-start' : ''} gap-8`}>
        
        {/* SOL KOLON: MEB Okul Risk Haritası Modülü (SADECE SINIF REHBER ÖĞRETMENİ VE İDARECİYE AÇIK) */}
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
                    <p className="text-xs text-slate-400">Tüm riskler aşağıda tek seferde listelenmiştir.</p>
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
              <div className="mb-4">
                <input 
                  type="text"
                  placeholder="36 risk maddesi içinde ara (örn: devamsızlık, şiddet, vefat)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              
              {/* 36 Resmi Madde Listesi - Aşağıya Doğru Tamamı Açık (Scroll Yok) */}
              <div className="space-y-2">
                {filteredRiskItems.map((item) => {
                  const originalIndex = MEB_OFFICIAL_RISK_ITEMS.indexOf(item);
                  const isSelected = selectedRisks.has(originalIndex);
                  const isOther = item.toLowerCase().includes('diğer');
                  return (
                    <div 
                      key={originalIndex} 
                      className={`p-3 rounded-xl border transition-all ${
                        isSelected 
                          ? 'bg-amber-50/90 border-amber-400 text-amber-950 shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <label className="flex items-start gap-3 cursor-pointer">
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
                      {isOther && isSelected && (
                        <div className="mt-2.5 pt-2 border-t border-amber-200" onClick={(e) => e.stopPropagation()}>
                          <label className="block text-[11px] font-bold text-amber-900 mb-1">
                            Diğer Risk Durumunu Açıklayınız (İsteğe Bağlı):
                          </label>
                          <input
                            type="text"
                            value={otherRiskNote}
                            onChange={(e) => setOtherRiskNote(e.target.value)}
                            placeholder="Örn: Ailede adli cezaevi geçmişi, yabancı uyruklu uyum sorunu vb..."
                            className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
              <span>* Seçilen risk maddeleri okul risk haritası matrisine otomatik yansıtılır.</span>
            </div>
          </div>
        )}

        {/* SAĞ KOLON: ŞÖK Öğretmen Görüşü & Grup Eğitimine Hazırlık Alanı */}
        <div className="space-y-6 lg:sticky lg:top-6">
          {/* ŞÖK Görüşü Kutusu */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                    <MessageSquarePlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {isSubjectTeacher ? 'Ders Öğretmeni ŞÖK Görüşü' : 'Kişisel ŞÖK Görüşünüz'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {isSubjectTeacher 
                        ? 'İsterseniz şablondan seçebilir, ders başlığı ekleyebilir veya serbestçe yazabilirsiniz.'
                        : 'Öğrencinin genel durumu ve kurul kararları hakkındaki görüşünüz.'
                      }
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTemplates(prev => !prev)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {showTemplates ? 'Şablonları Gizle' : 'Hazır Şablonlar'}
                </button>
              </div>

              {/* Şablondan Hazır Görüş Seçme ve Ders Başlığı Ekleme Paneli */}
              {showTemplates && (
                <div className="mb-4 bg-slate-50/90 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                  {/* 1. Ders / Alan Başlığı Etiketleri (Birden fazla derse giren öğretmenler için) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-slate-600">
                        Ders / Alan Başlığı Ekle (Çoklu derse girenler için isteğe bağlı):
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {teacher?.role && teacher.role !== 'Ders Öğretmeni' && teacher.role !== 'Sınıf Öğretmeni' && (
                        <button
                          type="button"
                          onClick={() => handleInsertSubjectTag(`[${teacher.role}]:`)}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition-colors"
                        >
                          + [{teacher.role}]
                        </button>
                      )}
                      {SUBJECT_PREFIX_TAGS.map((tag) => (
                        <button
                          type="button"
                          key={tag}
                          onClick={() => handleInsertSubjectTag(tag)}
                          className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
                        >
                          + {tag.replace(':', '')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Kategorili Hazır ŞÖK Görüş Şablonları */}
                  <div className="pt-2.5 border-t border-slate-200/80 space-y-2.5">
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        Özel Eğitim ve ŞÖK Hazır Görüş Şablonları (Tıklayarak metne ekleyin / çıkarın):
                      </span>
                      <div className="flex flex-wrap items-center gap-1 bg-white p-1.5 rounded-xl border border-slate-200">
                        {(['ozel_egitim', 'oz_bakim', 'positive', 'support', 'bep'] as const).map((tabKey) => (
                          <button
                            type="button"
                            key={tabKey}
                            onClick={() => setActiveTemplateTab(tabKey)}
                            className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                              activeTemplateTab === tabKey
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {SOK_OPINION_TEMPLATES[tabKey].title}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      {SOK_OPINION_TEMPLATES[activeTemplateTab].items.map((sentence, idx) => {
                        const isAdded = sokOpinion.includes(sentence);
                        return (
                          <button
                            type="button"
                            key={idx}
                            onClick={() => handleToggleTemplateSentence(sentence)}
                            className={`text-left text-xs p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2 ${
                              isAdded
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-medium'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/30'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <CheckCircle2
                                className={`w-4 h-4 shrink-0 mt-0.5 ${
                                  isAdded ? 'text-emerald-600' : 'text-slate-300'
                                }`}
                              />
                              <span className="leading-snug">{sentence}</span>
                            </div>
                            <span
                              className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                isAdded
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {isAdded ? '✓ EKLENDİ' : '+ TIKLA EKLE'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              
              <textarea
                value={sokOpinion}
                onChange={(e) => setSokOpinion(e.target.value)}
                placeholder="Yukarıdaki hazır şablonlara tıklayarak hızlıca görüş oluşturabilir veya kendi değerlendirmenizi buraya yazabilirsiniz..."
                className="w-full min-h-[200px] p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm text-slate-800 leading-relaxed placeholder:text-slate-400"
              />
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                {teacher?.name || teacher?.username || 'Öğretmen'}
              </span>
              <div className="flex items-center gap-3">
                {sokOpinion.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSokOpinion('')}
                    className="text-red-500 hover:text-red-700 font-medium underline underline-offset-2"
                  >
                    Metni Temizle
                  </button>
                )}
                <span>{sokOpinion.length} Karakter</span>
              </div>
            </div>
          </div>

          {/* Grup Eğitimine Hazırlık Modülü (Sadece Sınıf Öğretmenleri ve İdareciler İçin) */}
          {!isSubjectTeacher && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${isGroupTraining ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Grup Eğitimine Hazırlık</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Öğrenci grup eğitimine hazırlık programına dahil edilecekse işaretleyiniz.
                    </p>
                  </div>
                </div>
                
                {/* Ana Seçim Tik Kutusu */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isGroupTraining} 
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsGroupTraining(checked);
                      if (!checked) setGroupDays([]);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Tiklenince Açılan Gün Seçim Alanı */}
              {isGroupTraining && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Öğrencinin Geleceği Günler:
                    </span>
                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                      {groupDays.length > 0 ? `${groupDays.length} Gün Seçildi` : 'Gün Seçiniz'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {WEEK_DAYS.map((day) => {
                      const isDaySelected = groupDays.includes(day);
                      return (
                        <button
                          type="button"
                          key={day}
                          onClick={() => {
                            if (isDaySelected) {
                              setGroupDays(groupDays.filter(d => d !== day));
                            } else {
                              setGroupDays([...groupDays, day]);
                            }
                          }}
                          className={`px-3 py-2.5 rounded-xl text-xs font-medium border flex items-center justify-center gap-2 transition-all ${
                            isDaySelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <CheckCircle2 className={`w-3.5 h-3.5 ${isDaySelected ? 'text-white' : 'text-slate-300'}`} />
                          <span>{day}</span>
                        </button>
                      );
                    })}
                  </div>

                  {groupDays.length > 0 && (
                    <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      📌 Öğrenci haftalık <strong>{groupDays.join(', ')}</strong> günlerinde grup eğitimine hazırlık için gelecektir.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* DİĞER ÖĞRETMENLERİN ŞÖK GÖRÜŞLERİ (Sağ sütunda veya altta okunabilir) */}
          {!isSubjectTeacher && otherOpinions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Diğer Branş Öğretmenlerinin ŞÖK Görüşleri ({otherOpinions.length})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Sınıf öğretmeni ve idareciler için salt okunur görüntüleme
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  <Lock className="w-3.5 h-3.5 text-slate-400" /> Salt Okunur
                </div>
              </div>

              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                {otherOpinions.map((op, idx) => (
                  <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {op.teacherName[0]}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 text-xs block">{op.teacherName}</span>
                          <span className="text-[10px] text-slate-400">{op.branch}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" /> {op.date}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100">
                      "{op.opinion}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>


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
