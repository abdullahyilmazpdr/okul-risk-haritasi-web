'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  MessageSquare, 
  Download, 
  FileText, 
  CheckCircle2, 
  Clock, 
  BookOpen, 
  RefreshCw,
  Printer,
  X,
  Plus,
  Trash2,
  Calendar,
  Building,
  GraduationCap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCurrentAcademicYear } from '@/lib/academic-year';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getSchoolData } from '@/lib/db';

function normalizeTurkish(text: string): string {
  return (text || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .toLowerCase();
}

function getClassBaseKey(raw: string): string {
  const withoutParens = (raw || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/^ÖE[İI]U\s*-\s*/i, '')
    .replace(/Sınıf\s*Listesi.*$/i, '');
  return withoutParens
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

const SOK_TERM_TEMPLATES: Record<string, { agenda: string[]; decisions: string[] }> = {
  '1. Dönem Başı': {
    agenda: [
      'Açılış, yoklama ve kurul başkanının konuşması.',
      'Bir önceki eğitim öğretim yılı genel değerlendirmesi ve hedeflerin belirlenmesi.',
      '{CLASS} şubesi öğrencilerinin hazırbulunuşluk düzeyleri, devam-devamsızlık ve uyum süreçlerinin görüşülmesi.',
      'Sınıf Risk Haritasının oluşturulması, risk faktörlerinin ve öğrenci ihtiyaçlarının belirlenmesi.',
      'Özel eğitim ve kaynaştırma öğrencilerinin (BEP) planlamalarının yapılması.',
      'Akademik başarıyı artırıcı ve riskleri önleyici tedbirlerin kararlaştırılması.',
      'Alınan kurul kararları ve kapanış.'
    ],
    decisions: [
      'Risk altında olduğu tespit edilen öğrencilerin durumlarının okul rehberlik servisine iletilerek takibinin sağlanmasına,',
      'Akademik ve davranışsal gelişim ihtiyacı bulunan öğrenciler için veli görüşmelerinin ve bilgilendirmelerin sıklaştırılmasına,',
      'Ders içi motivasyonu artırmak amacıyla öğrenci merkezli ve destekleyici öğretim yöntemlerinin uygulanmasına,',
      'Kaynaştırma ve özel eğitim ihtiyacı olan öğrenciler için Bireyselleştirilmiş Eğitim Planı (BEP) hedeflerinin güncellenmesine,',
      'Öğrencilerin devamsızlık ve ders takibinin sınıf rehber öğretmeni ve ilgili müdür yardımcısı tarafından koordineli yürütülmesine.'
    ]
  },
  '1. Dönem Sonu': {
    agenda: [
      'Açılış, yoklama ve kurul başkanının konuşması.',
      '1. Dönem başında alınan ŞÖK kararlarının uygulama sonuçlarının değerlendirilmesi.',
      '{CLASS} şubesi öğrencilerinin 1. dönem ders başarı durumları, ders notları ve akademik gelişimlerinin değerlendirilmesi.',
      'Öğrencilerin 1. dönem devamsızlık ve disiplin durumlarının görüşülmesi.',
      'Risk haritasında takip edilen öğrencilerin 1. dönem gelişim ve takip süreçlerinin incelenmesi.',
      'Başarısızlık veya uyum sorunu yaşayan öğrenciler için ara tatil önerileri ve 2. dönem eylem planının oluşturulması.',
      'Alınan kurul kararları ve kapanış.'
    ],
    decisions: [
      '1. Dönem sonu ders başarı analizlerine göre başarısı düşük derslerde telafi ve pekiştirme etkinliklerinin 2. dönem başında planlanmasına,',
      'Özellikle devamsızlık sınırına yaklaşan öğrencilerin velilerine ara tatil öncesi yazılı bildirim yapılmasına,',
      'Risk grubundaki öğrencilerin rehberlik servisiyle yürütülen izleme çalışmalarının 2. dönemde de kararlılıkla sürdürülmesine,',
      'BEP uygulanan özel eğitim öğrencilerinin 1. dönem kazanımlarının değerlendirilerek 2. dönem bireysel hedeflerinin gözden geçirilmesine,',
      'Öğrencilerin ara tatilde verimli ders çalışma ve kitap okuma alışkanlıklarını destekleyici yönlendirmelerin yapılmasına.'
    ]
  },
  '2. Dönem Başı': {
    agenda: [
      'Açılış, yoklama ve kurul başkanının konuşması.',
      '1. Dönem sonu ŞÖK kararlarının ve karne sonuçlarının gözden geçirilmesi.',
      '{CLASS} şubesi öğrencilerinin 2. döneme yönelik akademik hedeflerinin ve çalışma planlarının görüşülmesi.',
      'Risk grubundaki öğrencilerin güncel durumları ve rehberlik servisi izleme raporlarının değerlendirilmesi.',
      'BEP uygulanan öğrencilerin 2. dönem bireysel gelişim hedeflerinin revize edilmesi.',
      'Destekleme ve Yetiştirme Kursları (DYK), ders dışı etütler ve veli iş birliği çalışmalarının planlanması.',
      'Alınan kurul kararları ve kapanış.'
    ],
    decisions: [
      '1. Dönem akademik açığı bulunan öğrencilere yönelik ders içi destek ve etüt çalışmalarının başlatılmasına,',
      'Devamsızlık riski taşıyan öğrencilerin günlük takibinin hassasiyetle yapılarak veli ile anlık iletişim kurulmasına,',
      'Sınıf Risk Haritasında yer alan öğrencilerin sosyal, kültürel ve sportif etkinliklere katılımlarının teşvik edilmesine,',
      'Özel eğitim ve kaynaştırma öğrencilerinin BEP hedefleri doğrultusunda sınav uyarlamalarının yapılmasına,',
      'LGS/YKS veya üst öğrenime geçiş sürecindeki öğrencilere yönelik sınav kaygısı ve motivasyon seminerleri düzenlenmesine.'
    ]
  },
  '2. Dönem Sonu': {
    agenda: [
      'Açılış, yoklama ve kurul başkanının konuşması.',
      'Yıl boyunca alınan ŞÖK kararlarının gerçekleşme düzeylerinin ve şube hedeflerinin değerlendirilmesi.',
      '{CLASS} şubesi öğrencilerinin yıl sonu başarı, ders geçme, teşekkür/takdir ve sınıf tekrarı durumlarının görüşülmesi.',
      'Öğrencilerin yıllık devam-devamsızlık ve davranış değerlendirmelerinin yapılması.',
      'Risk haritasında takip edilen öğrencilerin yıllık gelişim ve sonuç raporlarının değerlendirilmesi.',
      'Özel eğitim ve BEP öğrencilerinin yıl sonu gelişim düzeylerinin RAM’a bildirilmek üzere karara bağlanması.',
      'Üst öğrenim kurumuna veya bir sonraki sınıfa geçecek öğrencilere yönelik yönlendirme ve yaz tatili önerileri.',
      'Alınan kurul kararları ve kapanış.'
    ],
    decisions: [
      'Yıl sonu ders başarı durumları ve sınıf geçme kararlarının mevzuat doğrultusunda e-Okul sistemine işlenmesine,',
      'Sınıf tekrarı riski olan öğrencilerin ders bazında durumlarının hassasiyetle incelenerek kurulca karara bağlanmasına,',
      'Risk haritasında yer alan öğrencilerin yıl boyunca gösterdikleri olumlu gelişimlerin öğrenci dosyasında muhafaza edilmesine,',
      'BEP uygulanan öğrencilerin yıl sonu bireysel gelişim raporlarının hazırlanarak RAM’a gönderilmek üzere idareye teslim edilmesine,',
      'Öğrencilerin yaz tatili döneminde kişisel gelişimlerini sürdürebilmeleri için rehberlik servisi tavsiyelerinin velilerle paylaşılmasına.'
    ]
  }
};

export default function AdminSokPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [opinionsList, setOpinionsList] = useState<any[]>([]);
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('Okul Yönetimi');

  // ŞÖK Karar Tutanağı Modalı ve Alanları
  const [showMinutesModal, setShowMinutesModal] = useState(false);
  const [minutesClass, setMinutesClass] = useState('');
  const [minutesTerm, setMinutesTerm] = useState('1. Dönem Başı');
  const [minutesDate, setMinutesDate] = useState('2025-09-15');
  const [currentAcademicYear, setCurrentAcademicYear] = useState('2025-2026');
  const [decisionItems, setDecisionItems] = useState<string[]>(SOK_TERM_TEMPLATES['1. Dönem Başı'].decisions);
  const [agendaItems, setAgendaItems] = useState<string[]>(SOK_TERM_TEMPLATES['1. Dönem Başı'].agenda);
  const [newDecision, setNewDecision] = useState('');
  const [studentGeneralNotes, setStudentGeneralNotes] = useState('');

  const fetchOpinions = async () => {
    setIsLoading(true);
    try {
      const storedSpreadsheetId = typeof window !== 'undefined' ? localStorage.getItem('active_spreadsheet_id') : null;
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('google_access_token') : null;
      const activeSchoolKey = typeof window !== 'undefined' ? localStorage.getItem('admin_active_school_key') : null;

      const url = new URL('/api/student-opinion', window.location.origin);
      url.searchParams.set('all', 'true');
      if (storedSpreadsheetId) url.searchParams.set('spreadsheetId', storedSpreadsheetId);
      if (activeSchoolKey) url.searchParams.set('schoolKey', activeSchoolKey);

      const res = await fetch(url.toString(), {
        headers: storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {}
      });
      const data = await res.json();

      if (data.success && Array.isArray(data.opinions) && data.opinions.length > 0) {
        setOpinionsList(data.opinions.filter((o: any) => (o.opinion && o.opinion.trim()) || (Array.isArray(o.groupTrainingDays) && o.groupTrainingDays.length > 0)));
      } else {
        setOpinionsList([]);
      }
    } catch (err) {
      console.error('ŞÖK görüşleri alınamadı:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentAcademicYear(getCurrentAcademicYear());
    const today = new Date();
    setMinutesDate(today.toISOString().split('T')[0]);
    fetchOpinions();

    // Okul adı ve öğretmen listesini çek
    if (typeof window !== 'undefined') {
      const storedTeachers = localStorage.getItem('school_teachers');
      if (storedTeachers) {
        try {
          setTeachersList(JSON.parse(storedTeachers));
        } catch (e) {}
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const activeKey = typeof window !== 'undefined' ? localStorage.getItem('admin_active_school_key') : null;
        const data = await getSchoolData(user.uid, activeKey || undefined);
        if (data?.schoolName) setSchoolName(data.schoolName);

        const sheetId = data?.spreadsheetId || (typeof window !== 'undefined' ? localStorage.getItem('active_spreadsheet_id') : null);
        const token = (typeof window !== 'undefined' ? localStorage.getItem('google_access_token') : null) || data?.accessToken;
        if (sheetId) {
          try {
            const res = await fetch(`/api/school-data?spreadsheetId=${sheetId}&schoolKey=${data?.schoolKey || activeKey || ''}`, {
              headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const json = await res.json();
            if (res.ok && json.data?.teachers && json.data.teachers.length > 0) {
              setTeachersList(json.data.teachers);
              if (typeof window !== 'undefined') {
                localStorage.setItem('school_teachers', JSON.stringify(json.data.teachers));
              }
            }
          } catch (e) {}
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const uniqueClasses = useMemo(() => {
    const raw = opinionsList.map(o => o.className).filter(Boolean);
    const map = new Map<string, string>();
    for (const c of raw) {
      const key = getClassBaseKey(c);
      if (!key) continue;
      const existing = map.get(key);
      if (!existing || (existing.includes('(') && !c.includes('(')) || c.length < existing.length) {
        map.set(key, c);
      }
    }
    return Array.from(map.values());
  }, [opinionsList]);

  // Modalı açarken varsayılan sınıfı seç
  const handleOpenMinutesModal = () => {
    if (selectedClass !== 'ALL') {
      setMinutesClass(selectedClass);
    } else if (uniqueClasses.length > 0) {
      setMinutesClass(uniqueClasses[0]);
    } else {
      setMinutesClass('Genel Şube');
    }
    setShowMinutesModal(true);
  };

  const handleTermChange = (newTerm: string) => {
    setMinutesTerm(newTerm);
    const template = SOK_TERM_TEMPLATES[newTerm];
    if (template) {
      setAgendaItems(template.agenda);
      setDecisionItems(template.decisions);
    }
  };

  const handleAddDecision = () => {
    if (newDecision.trim()) {
      setDecisionItems(prev => [...prev, newDecision.trim()]);
      setNewDecision('');
    }
  };

  const handleRemoveDecision = (index: number) => {
    setDecisionItems(prev => prev.filter((_, i) => i !== index));
  };

  const filteredOpinions = opinionsList.filter(item => {
    const matchesSearch = 
      (item.studentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.studentNumber || '').includes(searchTerm) ||
      (item.teacherName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.opinion || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesClass = selectedClass === 'ALL' || getClassBaseKey(item.className || '') === getClassBaseKey(selectedClass) || (item.className || '').includes(selectedClass);
    return matchesSearch && matchesClass;
  });

  // Seçilen sınıf için tutanaktaki görüşler ve öğretmenler
  const minutesClassOpinions = useMemo(() => {
    const targetKey = getClassBaseKey(minutesClass);
    return opinionsList.filter(o => !minutesClass || getClassBaseKey(o.className || '') === targetKey || o.className === minutesClass);
  }, [opinionsList, minutesClass]);

  // Öğrenci bazında grupla (tutanak tablosu için)
  const studentsWithOpinions = useMemo(() => {
    const map = new Map<string, { studentNumber: string; studentName: string; className: string; groupTrainingDays: string[]; opinions: { teacherName: string; branch: string; opinion: string }[] }>();
    
    for (const op of minutesClassOpinions) {
      const key = `${op.studentNumber}-${op.studentName}`;
      if (!map.has(key)) {
        map.set(key, {
          studentNumber: op.studentNumber,
          studentName: op.studentName,
          className: op.className,
          groupTrainingDays: [],
          opinions: []
        });
      }
      const entry = map.get(key)!;
      if (Array.isArray(op.groupTrainingDays) && op.groupTrainingDays.length > 0) {
        entry.groupTrainingDays = Array.from(new Set([...entry.groupTrainingDays, ...op.groupTrainingDays]));
      }
      if (op.opinion && op.opinion.trim()) {
        entry.opinions.push({
          teacherName: op.teacherName,
          branch: op.branch,
          opinion: op.opinion
        });
      }
    }

    return Array.from(map.values());
  }, [minutesClassOpinions]);

  // O sınıfa giren öğretmenler (imza alanı için)
  const classTeachers = useMemo(() => {
    const targetKey = getClassBaseKey(minutesClass);
    // 1. Öğretmen listesinden sorumlu olanlar
    const teachersFromList = teachersList.filter(t => 
      Array.isArray(t.classes) && t.classes.some((c: string) => {
        const cKey = getClassBaseKey(c);
        return (cKey && cKey === targetKey) || c.includes(minutesClass) || minutesClass.includes(c);
      })
    );

    // 2. O sınıfa görüş yazmış öğretmenler
    const allMatching = [...teachersFromList];

    for (const op of minutesClassOpinions) {
      if (!allMatching.some(t => t.name === op.teacherName)) {
        allMatching.push({
          name: op.teacherName,
          roleOrBranch: op.branch || 'Ders Öğretmeni'
        });
      }
    }

    return allMatching;
  }, [teachersList, minutesClass, minutesClassOpinions]);

  const classCounselorNames = useMemo(() => {
    const counselors = classTeachers.filter(t => {
      const bLower = normalizeTurkish(t.roleOrBranch || '');
      return bLower.includes('sinif') || bLower.includes('rehber') || bLower.includes('ozel egitim') || bLower.includes('ozelegitim');
    });
    if (counselors.length > 0) {
      return Array.from(new Set(counselors.map(c => c.name))).join(' / ');
    }
    return classTeachers[0]?.name || 'Belirtilmedi';
  }, [classTeachers]);

  const vicePrincipal = useMemo(() => {
    return teachersList.find(t => (t.roleOrBranch || '').includes('Müdür Yardımcısı')) || {
      name: 'Müdür Yardımcısı',
      roleOrBranch: 'Müdür Yardımcısı (Kurul Başkanı)'
    };
  }, [teachersList]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Üst Başlık Kartı */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            Şube Öğretmenler Kurulu (ŞÖK) Yönetim Modülü
          </div>
          <h1 className="text-2xl font-bold">Öğretmen Görüşleri ve ŞÖK Kararları</h1>
          <p className="text-blue-100 text-sm mt-1">
            Branş ve sınıf rehber öğretmenlerinin öğrencilere yönelik girdiği tüm görüşler toplanır. Resmi MEB ŞÖK Karar Tutanağı imzaya hazır şekilde üretilir.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <button
            onClick={fetchOpinions}
            disabled={isLoading}
            className="bg-blue-800/80 hover:bg-blue-800 text-white font-medium px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 border border-blue-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Canlı Yenile
          </button>

          <button
            onClick={handleOpenMinutesModal}
            className="bg-white text-blue-900 hover:bg-blue-50 font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            ŞÖK Tutanağını Dışa Aktar (İmzalı)
          </button>
        </div>
      </div>

      {/* Filtre ve Arama */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Öğrenci adı, no veya öğretmen ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="ALL">Tüm Sınıflar</option>
            {uniqueClasses.map((cls, i) => (
              <option key={i} value={cls}>{cls}</option>
            ))}
          </select>
          <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-3 py-2 rounded-lg border border-blue-100">
            {filteredOpinions.length} Görüş
          </span>
        </div>
      </div>

      {/* Görüş Kartları Listesi */}
      {filteredOpinions.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3 print:hidden">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">Henüz ŞÖK Görüşü Bulunamadı</h3>
          <p className="text-slate-500 text-xs max-w-md mx-auto">
            Öğretmenler giriş yaparak öğrencilerine ŞÖK görüşü yazdıkça veriler Google E-Tablo üzerinden anında burada listelenecektir.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
        {filteredOpinions.map((op, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-200 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-bold text-sm">
                    {op.studentNumber}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{op.studentName}</h3>
                    <p className="text-xs text-slate-400 line-clamp-1">{op.className}</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">
                  {op.date}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 my-3">
                <p className="text-xs text-slate-700 leading-relaxed italic">
                  "{op.opinion}"
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-800">
                {op.teacherName} <span className="text-slate-400 font-normal">({op.branch})</span>
              </span>
              <div className="flex items-center gap-2">
                {op.groupTrainingDays && op.groupTrainingDays.length > 0 && (
                  <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                    Grup Eğitimi: {op.groupTrainingDays.join(', ')}
                  </span>
                )}
                <span className="text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                  Kayıtlı
                </span>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}

      {/* ŞÖK KARAR TUTANAĞI MODALI & YAZDIRMA ALANI */}
      {showMinutesModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:z-auto">
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden my-auto print:shadow-none print:border-none print:max-w-none">
            
            {/* Modal Kontrol Çubuğu (Yazdırma esnasında gizlenir) */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm">Resmi ŞÖK Kurul Karar Tutanağı</h3>
                  <p className="text-xs text-slate-400">MEB Yönetmeliğine uygun yazdırılabilir ve imzalanabilir kurul tutanağı</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Yazdır / PDF Olarak Kaydet
                </button>
                <button
                  onClick={() => setShowMinutesModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Ayar Çubuğu (Yazdırma esnasında gizlenir) */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tutanak Sınıfı / Şubesi:</label>
                <select
                  value={minutesClass}
                  onChange={(e) => setMinutesClass(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {uniqueClasses.map((cls, idx) => (
                    <option key={idx} value={cls}>{cls}</option>
                  ))}
                  {uniqueClasses.length === 0 && <option value="Genel Şube">Genel Şube</option>}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Dönem / Toplantı Zamanı:</label>
                <select
                  value={minutesTerm}
                  onChange={(e) => handleTermChange(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1. Dönem Başı">1. Dönem Başı</option>
                  <option value="1. Dönem Sonu">1. Dönem Sonu</option>
                  <option value="2. Dönem Başı">2. Dönem Başı</option>
                  <option value="2. Dönem Sonu">2. Dönem Sonu</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Toplantı Tarihi:</label>
                <input
                  type="date"
                  value={minutesDate}
                  onChange={(e) => setMinutesDate(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* RESMİ MEB TUTANAK SAYFASI (Yazdırılan Alan) */}
            <div className="p-8 sm:p-12 space-y-6 text-slate-900 bg-white font-serif leading-relaxed text-sm print:p-6 print:text-xs">
              
              {/* Tutanak Başlığı */}
              <div className="text-center space-y-1.5 border-b-2 border-slate-900 pb-4">
                <p className="font-bold text-xs uppercase tracking-widest text-slate-700 font-sans">T.C.</p>
                <p className="font-bold text-xs uppercase tracking-wider text-slate-700 font-sans">MİLLÎ EĞİTİM BAKANLIĞI</p>
                <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-950 font-sans">
                  {schoolName}
                </h2>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 font-sans">
                  {currentAcademicYear} EĞİTİM ÖĞRETİM YILI {minutesTerm.toUpperCase()}
                </h3>
                <h4 className="text-sm font-bold text-slate-900 underline font-sans">
                  {minutesClass} ŞUBE ÖĞRETMENLER KURULU (ŞÖK) TOPLANTI KARAR TUTANAĞI
                </h4>
              </div>

              {/* Toplantı Künyesi */}
              <div className="grid grid-cols-2 gap-2 text-xs font-sans border border-slate-300 p-3 rounded-lg bg-slate-50/50 print:bg-transparent">
                <div><strong>Toplantı Yeri / Şube:</strong> {minutesClass} Dersliği</div>
                <div><strong>Toplantı Tarihi:</strong> {new Date(minutesDate).toLocaleDateString('tr-TR')}</div>
                <div><strong>Kurul Başkanı:</strong> {vicePrincipal.name} ({vicePrincipal.roleOrBranch})</div>
                <div><strong>Sınıf Rehber Öğretmeni:</strong> {classCounselorNames}</div>
              </div>

              {/* Gündem Maddeleri */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                  <h4 className="font-bold text-xs uppercase tracking-wide font-sans">
                    I. GÜNDEM MADDELERİ ({minutesTerm})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const tmpl = SOK_TERM_TEMPLATES[minutesTerm];
                      if (tmpl) setAgendaItems(tmpl.agenda);
                    }}
                    className="text-[10px] text-blue-600 hover:underline print:hidden font-sans font-medium"
                  >
                    Gündemi Döneme Göre Sıfırla
                  </button>
                </div>
                <ol className="list-decimal list-inside text-xs space-y-1 text-slate-800">
                  {agendaItems.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item.replace('{CLASS}', minutesClass || 'Şube')}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Görüşülen Öğrenciler ve Öğretmen Değerlendirmeleri */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wide border-b border-slate-300 pb-1 font-sans">
                  II. ÖĞRENCİ BAZINDA ÖĞRETMEN GÖRÜŞ VE DEĞERLENDİRMELERİ
                </h4>
                {studentsWithOpinions.length === 0 ? (
                  <p className="text-xs italic text-slate-500 py-2">
                    Bu sınıf için sisteme girilmiş henüz öğretmen görüşü bulunmamaktadır.
                  </p>
                ) : (
                  <table className="w-full border-collapse border border-slate-400 text-xs text-left">
                    <thead>
                      <tr className="bg-slate-100 font-sans">
                        <th className="border border-slate-400 p-2 w-12 text-center">No</th>
                        <th className="border border-slate-400 p-2 w-40">Öğrenci Adı Soyadı</th>
                        <th className="border border-slate-400 p-2">Branş ve Sınıf Öğretmenlerinin Görüşleri</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentsWithOpinions.map((st, i) => (
                        <tr key={i} className="align-top">
                          <td className="border border-slate-400 p-2 text-center font-mono font-bold">{st.studentNumber}</td>
                          <td className="border border-slate-400 p-2 font-bold font-sans">{st.studentName}</td>
                          <td className="border border-slate-400 p-2 space-y-1.5">
                            {st.opinions.map((op, opIdx) => (
                              <div key={opIdx} className="text-[11px] leading-snug">
                                <span className="font-bold text-slate-800 font-sans">[{op.branch} - {op.teacherName}]:</span>{" "}
                                <span className="italic text-slate-700">"{op.opinion}"</span>
                              </div>
                            ))}
                            {st.groupTrainingDays && st.groupTrainingDays.length > 0 && (
                              <div className="text-[11px] leading-snug pt-1 border-t border-slate-200 font-sans">
                                <span className="font-bold text-slate-900">Grup Eğitimine Hazırlık Uygulaması Günleri:</span>{" "}
                                <span className="font-semibold text-slate-800">{st.groupTrainingDays.join(', ')}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Öğrenci Bazında Genel Kurul Notları ve İlave Açıklamalar */}
                <div className="pt-1">
                  <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs leading-relaxed print:bg-transparent">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-900 font-sans">
                        Öğrenci Bazında Alınan Genel Kurul Notları ve İlave Açıklamalar:
                      </span>
                      <span className="text-[10px] text-slate-400 print:hidden font-sans">İsteğe bağlı metin kutusu</span>
                    </div>
                    <div className="print:hidden mb-1">
                      <textarea
                        value={studentGeneralNotes}
                        onChange={(e) => setStudentGeneralNotes(e.target.value)}
                        rows={2}
                        placeholder="Öğrencilerle ilgili kurulda alınan özel kararları, veli görüşme planlarını veya şube geneli tespitleri buraya yazabilirsiniz (resmi çıktıda yer alır)..."
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-sans focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {studentGeneralNotes.trim() ? (
                      <p className="text-slate-800 whitespace-pre-wrap italic print:block hidden">
                        {studentGeneralNotes}
                      </p>
                    ) : (
                      <p className="text-slate-400 italic text-[11px] print:block hidden">
                        (Kurul tarafından öğrenci bazında ilave özel bir şerh veya açıklama düşülmemiştir.)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Alınan Kararlar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                  <h4 className="font-bold text-xs uppercase tracking-wide font-sans">
                    III. KURULDA ALINAN KARARLAR ({minutesTerm})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const tmpl = SOK_TERM_TEMPLATES[minutesTerm];
                      if (tmpl) setDecisionItems(tmpl.decisions);
                    }}
                    className="text-[10px] text-blue-600 hover:underline print:hidden font-sans font-medium"
                  >
                    Kararları Döneme Göre Sıfırla
                  </button>
                </div>

                <ol className="list-decimal list-inside text-xs space-y-1.5 text-slate-800">
                  {decisionItems.map((item, idx) => (
                    <li key={idx} className="group flex items-start gap-2">
                      <span className="font-bold">{idx + 1}.</span>
                      <span className="flex-1">{item}</span>
                      <button
                        onClick={() => handleRemoveDecision(idx)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 print:hidden text-xs"
                        title="Kararı Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ol>

                {/* Yeni Karar Ekleme (Yazdırmada gizlenir) */}
                <div className="flex items-center gap-2 pt-2 print:hidden">
                  <input
                    type="text"
                    value={newDecision}
                    onChange={(e) => setNewDecision(e.target.value)}
                    placeholder="Yeni bir kurul kararı yazın..."
                    className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddDecision(); }}
                  />
                  <button
                    onClick={handleAddDecision}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Karar Ekle
                  </button>
                </div>
              </div>

              {/* İMZA SİRKÜSÜ ALANI */}
              <div className="pt-6 space-y-6 page-break-inside-avoid">
                <h4 className="font-bold text-xs uppercase tracking-wide border-b border-slate-300 pb-1 font-sans text-center">
                  IV. KURUL ÜYELERİ VE İMZA SİRKÜSÜ
                </h4>

                {/* Sınıf Öğretmenleri İmza Kutuları */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-center text-xs font-sans">
                  {classTeachers.map((t, idx) => (
                    <div key={idx} className="border border-slate-300 p-3 rounded-lg flex flex-col justify-between min-h-[100px] bg-slate-50/30 print:bg-transparent">
                      <div>
                        <p className="font-bold text-slate-900">{t.name}</p>
                        <p className="text-[10px] text-slate-500">{t.roleOrBranch || 'Ders Öğretmeni'}</p>
                      </div>
                      <div className="pt-6 border-t border-dashed border-slate-300 text-[10px] text-slate-400">
                        İmza
                      </div>
                    </div>
                  ))}
                </div>

                {/* Kurul Başkanı & Okul Müdürü Onayı */}
                <div className="grid grid-cols-2 gap-8 pt-6 text-center text-xs font-sans">
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900">{vicePrincipal.name}</p>
                    <p className="text-[11px] text-slate-500">{vicePrincipal.roleOrBranch || 'Müdür Yardımcısı'}</p>
                    <p className="text-[11px] font-semibold text-slate-700">Kurul Başkanı</p>
                    <div className="pt-8 text-[10px] text-slate-400">İmza</div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-slate-700">UYGUNDUR</p>
                    <p className="text-[10px] text-slate-500">{new Date(minutesDate).toLocaleDateString('tr-TR')}</p>
                    <p className="font-bold text-slate-900 pt-1">Okul Müdürü</p>
                    <div className="pt-6 text-[10px] text-slate-400">Mühür / İmza</div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
