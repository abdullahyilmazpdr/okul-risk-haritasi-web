'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  RefreshCw, 
  Search, 
  Users, 
  School, 
  CheckCircle2,
  Table,
  Filter,
  BarChart3,
  ShieldAlert,
  BookOpen,
  Sparkles,
  Copy,
  AlertTriangle,
  HeartHandshake,
  TrendingUp,
  UserCheck,
  ClipboardList
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MEB_OFFICIAL_RISK_ITEMS } from '@/lib/meb-risk-items';
import { getCurrentAcademicYear } from '@/lib/academic-year';

interface RiskCategoryConfig {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  badgeClass: string;
  barClass: string;
  itemIndices: number[]; // 0-based indices into MEB_OFFICIAL_RISK_ITEMS
  adminPdrActions: string[];
  teacherClassroomActions: string[];
  familyAndInstitutionActions: string[];
  sampleActivityText: string;
}

const RISK_CATEGORIES_GUIDE: RiskCategoryConfig[] = [
  {
    id: 'family_structure',
    title: '1. Aile Yapısı, Ebeveyn Kaybı ve Parçalanmış Aile Riskleri',
    subtitle: 'Boşanma, ayrı yaşama, ebeveyn vefatı, büyükanne/akraba yanında yaşama, kalabalık aile (Maddeler 1–14)',
    color: 'indigo',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    barClass: 'bg-indigo-600',
    itemIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    adminPdrActions: [
      'Ebeveyn kaybı (anne/baba vefatı) yaşayan öğrenciler için yas ve uyum sürecine yönelik bireysel psikolojik danışma/destek planlaması yapılması.',
      'Anne-babası boşanmış veya ayrı yaşayan öğrencilerin velayet/iletişim bilgilerinin güncellenmesi ve her iki ebeveynle (yasal engel yoksa) eğitim sürecinin paylaşılması.',
      'Yalnızca büyükanne/büyükbaba veya akrabalarıyla yaşayan öğrencilerin bakım verenlerine yönelik periyodik rehberlik görüşmeleri düzenlenmesi.'
    ],
    teacherClassroomActions: [
      'Anneler Günü, Babalar Günü, aile ağacı gibi etkinliklerde ebeveyn kaybı veya parçalanmış aile durumu olan öğrencilerin duygusal hassasiyetlerinin gözetilmesi ve kapsayıcı dil kullanılması.',
      'Ev içi akademik destek imkânı kısıtlı olan (ebeveyn öğrenim düzeyi düşük veya çok kardeşli) öğrencilere okul içi çalışma/tekrar fırsatları sunulması.',
      'Öğrencinin okula aidiyetini güçlendirecek sınıf içi olumlu sorumluluklar verilmesi.'
    ],
    familyAndInstitutionActions: [
      'Bakım veren aile büyüklerine (büyükanne/büyükbaba) sınır koyma, şefkatli disiplin ve özel eğitim/BEP hedeflerinin evde desteklenmesi konusunda seminer/bülten sunulması.',
      'Şehit çocuğu veya ebeveyn kaybı olan öğrenciler için ilgili sosyal destek birimleriyle koordinasyon sağlanması.'
    ],
    sampleActivityText:
      'Parçalanmış aile ve ebeveyn kaybı yaşayan öğrencilere yönelik okul rehberlik servisi koordinesinde psikolojik sağlamlık ve duygusal uyum çalışmaları yürütülmekte; bakım veren aile bireyleriyle düzenli veli görüşmeleri yapılarak okul-aile iş birliği güçlendirilmektedir.'
  },
  {
    id: 'protection_legal',
    title: '2. Koruma Altındaki Öğrenciler, Kurum Bakımı ve Yasal Tedbirler',
    subtitle: 'Koruyucu aile, Sevgi Evleri, SHÇEK, Danışmanlık ve Eğitim Tedbir Kararları (Maddeler 15–17, 28–29)',
    color: 'rose',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    barClass: 'bg-rose-600',
    itemIndices: [14, 15, 16, 27, 28],
    adminPdrActions: [
      'Danışmanlık veya Eğitim Tedbir Kararı bulunan öğrenciler için MEB / Mahkeme kararları doğrultusunda bireysel müdahale ve izleme planı hazırlanması, dönemlik raporların zamanında gönderilmesi.',
      'Sevgi Evleri, Çocuk Evleri veya Koruyucu Aile gözetimindeki öğrenciler için kuruluş bakım personeli / koruyucu aile ile aylık koordinasyon toplantısı yapılması.',
      'Bu gruptaki öğrencilerin tüm bilgi ve belgelerinin KVKK ve gizlilik esaslarına uygun şekilde yalnızca yetkili kurul üyeleriyle paylaşılması.'
    ],
    teacherClassroomActions: [
      'Etiketlenmeyi önleyici, güvenli ve kabul edici sınıf iklimi oluşturulması; akran ilişkilerinde dışlanma riskine karşı grup etkinliklerinde destekleyici eşleştirmeler yapılması.',
      'Öğrencinin duygu durumundaki ani değişimlerin (içe kapanma, öfke patlaması, devamsızlık) sınıf öğretmeni tarafından erken fark edilerek PDR servisine bildirilmesi.'
    ],
    familyAndInstitutionActions: [
      'Aile ve Sosyal Hizmetler İl/İlçe Müdürlüğü, Çocuk Evleri Koordinasyon Merkezi ve RAM ile düzenli resmi iletişim kurulması.',
      'Koruyucu ailelere öğrencinin BEP/akademik gelişimi hakkında düzenli geri bildirim verilmesi.'
    ],
    sampleActivityText:
      'Koruyucu aile, kurum bakımı veya hakkında Danışmanlık/Eğitim Tedbir Kararı bulunan öğrencilerimiz için gizlilik ilkesi çerçevesinde bireysel izleme programı uygulanmakta; Aile ve Sosyal Hizmetler birimleri ve RAM ile eşgüdümlü takip çalışmaları yürütülmektedir.'
  },
  {
    id: 'domestic_violence_health',
    title: '3. Aile İçi Şiddet, Bağımlılık ve Ailevi Sağlık / Kriz Riskleri',
    subtitle: 'Aile içi şiddet, ailede bağımlı birey, ruhsal/süreğen hastalık, cezai hüküm (Maddeler 18–21, 23)',
    color: 'amber',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    barClass: 'bg-amber-600',
    itemIndices: [17, 18, 19, 20, 22],
    adminPdrActions: [
      'Aile içi şiddet veya ihmal/istismar şüphesi/bildirimi durumlarında MEB Kriz Müdahale ve Bildirim Yükümlülüğü protokollerinin derhal işletilmesi.',
      'Ailesinde ruhsal hastalık, bağımlılık veya cezai hüküm bulunan öğrencilerin evde maruz kaldığı travmatik stres yükünü azaltmak için bireysel psikolojik destek sunulması.',
      'Öğrenciye okul içinde güvenebileceği bir "destekleyici yetişkin / rehber öğretmen" teması sağlanması.'
    ],
    teacherClassroomActions: [
      'Sınıf içinde öngörülebilir, sakin ve güvenli rutinler oluşturulması; öğrencinin hata yaptığında cezalandırılmayacağı güven ortamının hissettirilmesi.',
      'Duygusal öz düzenleme, öfke kontrolü ve güvenli sınırlar (beden güvenliği / hayır diyebilme) becerilerinin günlük etkinliklere yedirilmesi.'
    ],
    familyAndInstitutionActions: [
      'Ailede bağımlılık veya ruhsal hastalık durumlarında Yeşilay Danışmanlık Merkezi (YEDAM), Sosyal Hizmet Merkezleri (SHM) ve sağlık kuruluşları hakkında aileye rehberlik edilmesi.',
      'Gerekli hallerde Sosyal İnceleme ve Danışmanlık Tedbiri için ilgili kurumlara bildirimde bulunulması.'
    ],
    sampleActivityText:
      'Aile içi şiddet, bağımlılık veya ailevi sağlık krizleri nedeniyle risk altında bulunan öğrenciler için kriz müdahale ve psikososyal destek çalışmaları yürütülmekte; öğrencinin okulda güvenli bir ortamda eğitimini sürdürmesi için rehberlik ve kurumlar arası yönlendirme mekanizmaları işletilmektedir.'
  },
  {
    id: 'special_ed_health',
    title: '4. Özel Eğitim, Yetersizlik Raporu, Süreğen ve Ruhsal Sağlık Riskleri',
    subtitle: 'Özel eğitim raporu, özel yetenek, süreğen hastalık, ruhsal hastalık (Maddeler 24–27)',
    color: 'emerald',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    barClass: 'bg-emerald-600',
    itemIndices: [23, 24, 25, 26],
    adminPdrActions: [
      'BEP (Bireyselleştirilmiş Eğitim Programı) Geliştirme Birimi toplantılarının zamanında yapılarak öğrencinin bireysel performans düzeyine uygun gerçekçi hedefler belirlenmesi.',
      'Süreğen veya ruhsal hastalığı olan öğrencilerin ilaç kullanım saatleri, nöbet/acil durum müdahale protokolleri ve doktor kontrolleri için veli-idare iletişim kartı oluşturulması.',
      'Grup eğitimine hazırlık programına dahil edilen öğrencilerin haftalık katılım ve uyum süreçlerinin ŞÖK kurullarında değerlendirilmesi.'
    ],
    teacherClassroomActions: [
      'Çoklu duyuya hitap eden somut materyaller, görsel etkinlik çizelgeleri ve adım adım (fiziksel, model olma, sözel) ipucu basamaklarının kullanılması.',
      'Öz bakım, günlük yaşam ve bağımsız hareket becerilerinin gelişimi için sınıf içi uygulama tekrarlarının yapılması.',
      'Duyusal hassasiyeti olan öğrenciler için sınıf içi gürültü/ışık düzenlemesi ve sakinleşme molaları planlanması.'
    ],
    familyAndInstitutionActions: [
      'Okulda çalışılan öz bakım, iletişim ve davranış becerilerinin ev ortamına genellenmesi için velilere "Evde Tekrar ve Pekiştirme Rehberi" sunulması.',
      'RAM raporu yenileme ve sağlık kurulu süreçlerinde aileye zamanında bilgilendirme yapılması.'
    ],
    sampleActivityText:
      'Özel eğitim raporu ve süreğen/ruhsal sağlık durumu bulunan öğrencilerimiz için BEP hedefleri doğrultusunda bireyselleştirilmiş öğretim, öz bakım ve günlük yaşam becerileri çalışmaları yürütülmekte; okulda kazanılan becerilerin ev ortamına genellenmesi amacıyla düzenli aile eğitimi ve sağlık/acil durum takibi yapılmaktadır.'
  },
  {
    id: 'socioeconomic_attendance',
    title: '5. Sosyo-Ekonomik Güçlükler, Sürekli Devamsızlık ve Mevsimlik İşçilik',
    subtitle: 'Maddi sıkıntı, sürekli devamsızlık, mevsimlik işçi ailesi, bir işte çalışma (Maddeler 22, 30–32)',
    color: 'purple',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    barClass: 'bg-purple-600',
    itemIndices: [21, 29, 30, 31],
    adminPdrActions: [
      'Sürekli devamsızlık yapan öğrencilerin devamsızlık nedenlerinin (sağlık, ulaşım/servis, maddi yetersizlik, ailevi ihmal) erken uyarı sistemiyle tespit edilip veli/ev ziyareti yapılması.',
      'Maddi sıkıntı yaşayan öğrencilerin kırtasiye, giyim, beslenme ve ulaşım ihtiyaçları için Okul Aile Birliği, Sosyal Yardımlaşma ve Dayanışma Vakfı ve yerel yönetimlerle (rencide etmeden) destek sağlanması.',
      'Mevsimlik tarım işçisi ailelerin çocukları veya çalışan öğrenciler için e-Okul nakil/devam ve telafi eğitimi süreçlerinin izlenmesi.'
    ],
    teacherClassroomActions: [
      'Maddi maliyet gerektiren materyal/etkinlik taleplerinde okul imkânlarının kullanılması ve öğrenciler arasında sosyo-ekonomik farkların görünür kılınmaması.',
      'Devamsızlık sonrası okula dönen öğrencinin dışlanmadan sınıf rutinlerine hızla adapte edilmesi ve eksik kazanımlarının bireysel destekle tamamlanması.'
    ],
    familyAndInstitutionActions: [
      'Veliye zorunlu eğitim kapsamında okula devamın yasal ve gelişimsel önemi hakkında bilgilendirme yapılması.',
      'Özel eğitim öğrencilerinin taşıma/servis süreçlerindeki aksaklıkların il/ilçe milli eğitim birimleriyle çözülmesi.'
    ],
    sampleActivityText:
      'Maddi sıkıntı yaşayan ve sürekli devamsızlık riski bulunan öğrencilerimiz için erken uyarı devamsızlık takibi ve veli görüşmeleri gerçekleştirilmekte; öğrencilerin eğitim materyali, beslenme ve ulaşım ihtiyaçlarının karşılanması amacıyla sosyal yardımlaşma birimleri ve Okul Aile Birliği ile destek çalışmaları yürütülmektedir.'
  },
  {
    id: 'academic_peer_adaptation',
    title: '6. Akademik Güçlük, Riskli Akran Grubu ve Sosyal Uyum Riskleri',
    subtitle: 'Akademik başarısı düşük, riskli akran grubu, yabancı uyruklu, diğer uyum riskleri (Maddeler 33–36)',
    color: 'blue',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    barClass: 'bg-blue-600',
    itemIndices: [32, 33, 34, 35],
    adminPdrActions: [
      'Riskli akran grubuna dahil olan öğrencilerle akran baskısına direnme, hayır diyebilme, siber güvenlik ve zararlı alışkanlıklardan korunma temalı bireysel/grup rehberliği yapılması.',
      'Yabancı uyruklu veya dil/kültür uyum güçlüğü çeken öğrenciler için okul uyum programı ve akran rehberliği uygulanması.',
      'Akademik başarısı düşük öğrencilerin görsel sanatlar, müzik, beden eğitimi ve uygulama atölyelerindeki yeteneklerinin keşfedilerek özgüvenlerinin desteklenmesi.'
    ],
    teacherClassroomActions: [
      'Öğrencinin küçük başarılarının anında fark edilip somut/sözel pekiştireçlerle ödüllendirilmesi.',
      'Olumsuz akran etkileşimini azaltmak için sınıf içi oturma düzeninin ve grup çalışması eşleşmelerinin pedagojik olarak yeniden planlanması.',
      'Uygulama, atölye, spor ve sanat derslerinde öğrenciye liderlik/görev sorumluluğu verilmesi.'
    ],
    familyAndInstitutionActions: [
      'Velilere ergenlik dönemi özellikleri, ekran/internet kullanımı, arkadaş çevresi takibi ve olumlu iletişim konularında rehberlik yapılması.',
      'Okul içi ve okul dışı sosyal, sportif ve kültürel kurslara/etkinliklere yönlendirme yapılması.'
    ],
    sampleActivityText:
      'Akademik güçlük veya riskli akran grubu etkisinde olan öğrencilerimizin okula bağlılığını artırmak amacıyla yetenek ve ilgi alanlarına (uygulama, sanat, spor) yönelik güçlendirme çalışmaları yapılmakta; akran zorbalığını önleme, sosyal beceri geliştirme ve verimli çalışma alışkanlıkları kazandırma etkinlikleri uygulanmaktadır.'
  }
];

export default function AdminRiskMapPage() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'interventions' | 'matrix'>('analytics');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [selectedRiskItemFilter, setSelectedRiskItemFilter] = useState<number | 'ALL'>('ALL');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingDetailed, setIsExportingDetailed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [classRows, setClassRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<number[]>([]);
  const [riskStudents, setRiskStudents] = useState<Array<{ number: string; name: string; className: string; risks: number[] }>>([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    evaluatedStudentsCount: 0,
    riskStudentCount: 0
  });
  const [currentYear, setCurrentYear] = useState('2025-2026');
  const [schoolInfo, setSchoolInfo] = useState<{ schoolName: string; district: string }>({
    schoolName: '',
    district: ''
  });

  const fetchMatrixData = async () => {
    setIsLoading(true);
    try {
      const storedSpreadsheetId = typeof window !== 'undefined' ? localStorage.getItem('active_spreadsheet_id') : null;
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('google_access_token') : null;
      const activeSchoolKey = typeof window !== 'undefined' ? localStorage.getItem('admin_active_school_key') : null;

      const url = new URL('/api/school-risk-matrix', window.location.origin);
      if (storedSpreadsheetId) url.searchParams.set('spreadsheetId', storedSpreadsheetId);
      if (activeSchoolKey) url.searchParams.set('schoolKey', activeSchoolKey);

      const res = await fetch(url.toString(), {
        headers: storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {}
      });
      const data = await res.json();

      if (data.success && Array.isArray(data.classRows)) {
        setClassRows(data.classRows);
        setTotals(data.totals || []);
        if (Array.isArray(data.riskStudents)) {
          setRiskStudents(data.riskStudents);
        }
        if (data.stats) {
          setStats({
            totalStudents: data.stats.totalStudents || 0,
            totalTeachers: data.stats.totalTeachers || 0,
            evaluatedStudentsCount: data.stats.evaluatedStudentsCount || 0,
            riskStudentCount: data.stats.riskStudentCount || 0
          });
        }
        if (data.schoolInfo) {
          setSchoolInfo({
            schoolName: data.schoolInfo.schoolName || '',
            district: data.schoolInfo.district || ''
          });
        }
      }
    } catch (err) {
      console.error('Matrix getirme hatası:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentYear(getCurrentAcademicYear());
    fetchMatrixData();
  }, []);

  // Konsolide matris filtreleme
  const filteredRows = classRows.filter(row => {
    const matchesSearch = row.className.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClassFilter === 'ALL' || row.className === selectedClassFilter;
    return matchesSearch && matchesClass;
  });

  // Analitik Hesaplamalar
  const analyticsData = useMemo(() => {
    const totalRiskMarks = totals.reduce((acc, v) => acc + (v || 0), 0);

    // 36 maddenin sıralı listesi
    const rankedRisks = MEB_OFFICIAL_RISK_ITEMS.map((label, idx) => {
      const count = totals[idx] || 0;
      const studentPercent = stats.totalStudents > 0 ? Math.round((count / stats.totalStudents) * 100) : 0;
      const shareOfRisks = totalRiskMarks > 0 ? Math.round((count / totalRiskMarks) * 100) : 0;
      return {
        index: idx,
        no: idx + 1,
        label,
        count,
        studentPercent,
        shareOfRisks
      };
    }).sort((a, b) => b.count - a.count);

    const topRisks = rankedRisks.filter(r => r.count > 0).slice(0, 10);
    const topSingleRisk = rankedRisks[0] && rankedRisks[0].count > 0 ? rankedRisks[0] : null;

    // 3 veya daha fazla risk faktörü taşıyan (Yüksek Öncelikli / Çoklu Risk) öğrenci sayısı
    const multiRiskStudentsCount = riskStudents.filter(s => s.risks.length >= 3).length;

    // Kategori bazlı toplamlar
    const categoryStats = RISK_CATEGORIES_GUIDE.map(cat => {
      const totalInCat = cat.itemIndices.reduce((sum, idx) => sum + (totals[idx] || 0), 0);
      const affectedStudentsCount = riskStudents.filter(st =>
        st.risks.some(rIdx => cat.itemIndices.includes(rIdx))
      ).length;
      const activeItems = cat.itemIndices
        .map(idx => ({ index: idx, no: idx + 1, label: MEB_OFFICIAL_RISK_ITEMS[idx], count: totals[idx] || 0 }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count);

      return {
        ...cat,
        totalInCat,
        affectedStudentsCount,
        activeItems
      };
    });

    // Sınıf bazlı risk yoğunluğu özeti
    const classSummaries = classRows.map(row => {
      const classRiskTotal = (row.risks || []).reduce((s: number, v: number) => s + (v || 0), 0);
      let topRiskIdx = -1;
      let topRiskMax = 0;
      (row.risks || []).forEach((val: number, idx: number) => {
        if (val > topRiskMax) {
          topRiskMax = val;
          topRiskIdx = idx;
        }
      });

      return {
        orderNo: row.orderNo,
        className: row.className,
        classTeacher: row.classTeacher,
        studentCount: row.studentCount || 0,
        classRiskTotal,
        avgRiskPerStudent: row.studentCount > 0 ? (classRiskTotal / row.studentCount).toFixed(1) : '0.0',
        topRiskLabel: topRiskIdx >= 0 ? `${topRiskIdx + 1}. ${MEB_OFFICIAL_RISK_ITEMS[topRiskIdx]} (${topRiskMax})` : 'Risk Kaydı Yok'
      };
    }).sort((a, b) => b.classRiskTotal - a.classRiskTotal);

    return {
      totalRiskMarks,
      rankedRisks,
      topRisks,
      topSingleRisk,
      multiRiskStudentsCount,
      categoryStats,
      classSummaries
    };
  }, [totals, stats.totalStudents, riskStudents, classRows]);

  // Filtrelenmiş Risk Grubu Öğrencileri
  const filteredRiskStudents = useMemo(() => {
    return riskStudents.filter(st => {
      if (selectedClassFilter !== 'ALL' && st.className !== selectedClassFilter) {
        return false;
      }
      if (selectedRiskItemFilter !== 'ALL' && !st.risks.includes(selectedRiskItemFilter)) {
        return false;
      }
      if (studentSearchTerm.trim()) {
        const q = studentSearchTerm.toLowerCase().trim();
        const matchName = (st.name || '').toLowerCase().includes(q);
        const matchNum = String(st.number || '').toLowerCase().includes(q);
        const matchCls = (st.className || '').toLowerCase().includes(q);
        if (!matchName && !matchNum && !matchCls) return false;
      }
      return true;
    });
  }, [riskStudents, selectedClassFilter, selectedRiskItemFilter, studentSearchTerm]);

  const handleSyncToSheets = async () => {
    const storedSpreadsheetId = typeof window !== 'undefined' ? localStorage.getItem('active_spreadsheet_id') : null;
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('google_access_token') : null;
    const activeSchoolKey = typeof window !== 'undefined' ? localStorage.getItem('admin_active_school_key') : null;

    if (!storedSpreadsheetId) {
      toast.error('E-Tablo bağlantısı bulunamadı. Lütfen sol menüden E-Tablonuzu bağlayın.');
      return;
    }

    setIsSyncing(true);
    const syncToast = toast.loading('Konsolide matris E-Tabloya (OkulRiskHaritasi sayfasına) yazılıyor...');
    try {
      const res = await fetch('/api/school-risk-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: storedSpreadsheetId,
          accessToken: storedToken,
          schoolKey: activeSchoolKey,
          classSummaries: classRows
        })
      });
      const json = await res.json();
      toast.dismiss(syncToast);
      if (json.success) {
        toast.success('Okul Risk Haritası E-Tabloya başarıyla işlendi!');
      } else {
        toast.error(json.error || 'İşleme sırasında hata oluştu.');
      }
    } catch (e: any) {
      toast.dismiss(syncToast);
      toast.error('Bağlantı hatası: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    const toastId = toast.loading('Bakanlık formatında Excel hazırlanıyor...');
    try {
      const XLSX = await import('xlsx');
      const academicYear = getCurrentAcademicYear();
      
      // Excel Sayfası Oluştur
      const wsData: any[][] = [
        [`${academicYear} EĞİTİM ÖĞRETİM YILI OKUL RİSK HARİTASI`],
        ["OKUL ADI:", schoolInfo.schoolName || "Okul Yönetimi"],
        ["İLÇESİ:", schoolInfo.district || "-"],
        ["TOPLAM ÖĞRENCİ SAYISI:", String(stats.totalStudents || 0)],
        ["TOPLAM ÖĞRETMEN SAYISI:", String(stats.totalTeachers || 0)],
        [],
        ["Sıra No", "Sınıf/Şube", ...MEB_OFFICIAL_RISK_ITEMS],
      ];

      // Sınıf satırları
      classRows.forEach((row, idx) => {
        wsData.push([idx + 1, row.className, ...row.risks]);
      });

      // Toplam satırı
      wsData.push(["TOPLAM", "Okul Geneli", ...totals]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "OKUL RİSK HARİTASI");
      
      XLSX.writeFile(wb, `${academicYear}_Okul_Risk_Haritasi.xlsx`);
      toast.dismiss(toastId);
      toast.success("Resmi MEB formatında Excel dosyası başarıyla indirildi!");
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error("Excel oluşturulurken hata: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDetailedReportExcel = async () => {
    setIsExportingDetailed(true);
    const toastId = toast.loading('Detaylı Risk Analiz ve Müdahale Raporu hazırlanıyor...');
    try {
      const XLSX = await import('xlsx');
      const academicYear = getCurrentAcademicYear();
      const wb = XLSX.utils.book_new();

      // 1. Sayfa: Risk Faktörleri Sıralı Dağılımı
      const factorRows = analyticsData.rankedRisks.map((r, idx) => ({
        "Öncelik Sırası": idx + 1,
        "Madde No": r.no,
        "Resmi MEB Risk Faktörü": r.label,
        "Tespit Edilen Öğrenci Sayısı": r.count,
        "Okul Öğrenci Oranı (%)": `%${r.studentPercent}`,
        "Toplam Riskler İçindeki Payı (%)": `%${r.shareOfRisks}`
      }));
      const wsFactors = XLSX.utils.json_to_sheet(factorRows);
      XLSX.utils.book_append_sheet(wb, wsFactors, "1-Risk Dağılım Analizi");

      // 2. Sayfa: Risk Grubu Öğrenci Listesi
      const studentRows = riskStudents.map((st, idx) => ({
        "Sıra No": idx + 1,
        "Öğrenci No": st.number,
        "Adı Soyadı": st.name,
        "Sınıfı / Şubesi": st.className,
        "Toplam Risk Sayısı": st.risks.length,
        "Öncelik Durumu": st.risks.length >= 3 ? "Yüksek Öncelik (Çoklu Risk)" : "Normal İzlem",
        "Tespit Edilen Risk Maddeleri": st.risks.map(rIdx => `(${rIdx + 1}) ${MEB_OFFICIAL_RISK_ITEMS[rIdx]}`).join(' | ')
      }));
      const wsStudents = XLSX.utils.json_to_sheet(
        studentRows.length > 0
          ? studentRows
          : [{ Bilgilendirme: "Henüz risk maddesi işaretlenmiş öğrenci bulunmamaktadır." }]
      );
      XLSX.utils.book_append_sheet(wb, wsStudents, "2-Risk Grubu Öğrenciler");

      // 3. Sayfa: Yapılacak Çalışmalar ve Müdahale Planı
      const interventionRows = analyticsData.categoryStats.map(cat => ({
        "Risk Kategorisi": cat.title,
        "Bu Kategorideki Toplam Risk İşaretlemesi": cat.totalInCat,
        "Etkilenen Öğrenci Sayısı": cat.affectedStudentsCount,
        "Okul İdaresi ve PDR Çalışmaları": cat.adminPdrActions.join(' • '),
        "Sınıf İçi Öğretmen Uygulamaları": cat.teacherClassroomActions.join(' • '),
        "Aile ve Kurum İş Birliği": cat.familyAndInstitutionActions.join(' • '),
        "Kurul / Rapor Örnek Metni": cat.sampleActivityText
      }));
      const wsInterventions = XLSX.utils.json_to_sheet(interventionRows);
      XLSX.utils.book_append_sheet(wb, wsInterventions, "3-Müdahale ve Eylem Planı");

      XLSX.writeFile(wb, `${academicYear}_Detayli_Risk_Analiz_ve_Mudahale_Raporu.xlsx`);
      toast.dismiss(toastId);
      toast.success("Detaylı Risk Analizi ve Müdahale Raporu (3 Sayfalı Excel) indirildi!");
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error("Rapor oluşturulurken hata: " + err.message);
    } finally {
      setIsExportingDetailed(false);
    }
  };

  const handleCopyActionPlanText = (text: string, title: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`"${title}" çalışma metni panoya kopyalandı!`);
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Üst Bilgi Kartı */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-1">
            <School className="w-4 h-4" />
            Bakanlık Standart Formatı & PDR Analitik Modülü
          </div>
          <h1 className="text-2xl font-bold">{currentYear} Eğitim Öğretim Yılı Okul Risk Haritası ve Müdahale Rehberi</h1>
          <p className="text-slate-300 text-sm mt-1">
            Sınıf rehber öğretmenlerinin girdiği 36 risk faktörünün canlı analizi, risk grubu öğrenci raporları ve örnek müdahale çalışmaları.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchMatrixData}
            disabled={isLoading}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-medium px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Canlı Yenile
          </button>

          <button
            onClick={handleSyncToSheets}
            disabled={isSyncing || classRows.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {isSyncing ? 'İşleniyor...' : "E-Tabloya Yaz"}
          </button>

          <button
            onClick={handleExportDetailedReportExcel}
            disabled={isExportingDetailed}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            <ClipboardList className="w-4 h-4" />
            {isExportingDetailed ? 'Hazırlanıyor...' : 'Detaylı Analiz & Eylem Planı İndir'}
          </button>

          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Hazırlanıyor...' : 'Bakanlık Excel İndir'}
          </button>
        </div>
      </div>

      {/* 4'lü Canlı Özet İstatistik Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk Kaydı Olan Öğrenci</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-slate-900">{stats.riskStudentCount}</span>
              <span className="text-xs font-semibold text-slate-500">/ {stats.totalStudents} Öğrenci</span>
            </div>
            <p className="text-[11px] text-indigo-600 font-medium mt-1.5">
              Okulun %{stats.totalStudents > 0 ? Math.round((stats.riskStudentCount / stats.totalStudents) * 100) : 0}&apos;inde en az 1 risk faktörü var
            </p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Toplam Risk İşaretlemesi</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-amber-600">{analyticsData.totalRiskMarks}</span>
              <span className="text-xs font-semibold text-slate-500">Adet Faktör</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Riskli öğrenci başına ort.{' '}
              <strong className="text-slate-700">
                {stats.riskStudentCount > 0 ? (analyticsData.totalRiskMarks / stats.riskStudentCount).toFixed(1) : '0.0'}
              </strong>{' '}
              risk faktörü
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-start justify-between">
          <div className="min-w-0 pr-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">En Yaygın Risk Faktörü</span>
            <div className="mt-1">
              <span className="text-sm font-bold text-slate-900 line-clamp-1" title={analyticsData.topSingleRisk?.label || 'Veri Yok'}>
                {analyticsData.topSingleRisk ? `${analyticsData.topSingleRisk.no}. ${analyticsData.topSingleRisk.label}` : 'Henüz Risk Girilmedi'}
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1.5">
              {analyticsData.topSingleRisk
                ? `${analyticsData.topSingleRisk.count} Öğrencide (%${analyticsData.topSingleRisk.studentPercent}) görüldü`
                : 'Öğretmen girişleri bekleniyor'}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Çoklu Risk (3+ Faktör)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-rose-600">{analyticsData.multiRiskStudentsCount}</span>
              <span className="text-xs font-semibold text-slate-500">Öğrenci</span>
            </div>
            <p className="text-[11px] text-rose-600 font-medium mt-1.5">
              Öncelikli PDR ve rehberlik takibi önerilen grup
            </p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Sekme (Tab) Seçici */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'analytics'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          1. Detaylı Risk Analizi ve Öğrenci Raporları
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('interventions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'interventions'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HeartHandshake className="w-4 h-4" />
          2. Risk Grubu Öğrencilerine Yönelik Yapılacak Çalışmalar (Rehber)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'matrix'
              ? 'bg-[#e07525] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Table className="w-4 h-4" />
          3. Resmi MEB Konsolide Risk Matrisi (36 Madde Tablosu)
        </button>
      </div>

      {/* SEKME 1: DETAYLI RİSK ANALİZİ VE ÖĞRENCİ RAPORLARI */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Tematik Risk Kategorileri Özeti (6 Kategori) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Tematik Alanlara Göre Okul Risk Dağılımı
                </h2>
                <p className="text-xs text-slate-500">
                  36 resmi MEB risk faktörünün 6 temel müdahale alanına göre okul genelindeki yoğunluğu
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('interventions')}
                className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl transition-colors self-start sm:self-auto"
              >
                Bu Risk Grupları İçin Örnek Çalışmaları Gör &rarr;
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analyticsData.categoryStats.map((cat) => (
                <div
                  key={cat.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xs font-bold text-slate-900 leading-snug">{cat.title}</h3>
                      <span className={`shrink-0 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${cat.badgeClass}`}>
                        {cat.affectedStudentsCount} Öğrenci
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{cat.subtitle}</p>
                  </div>

                  {cat.activeItems.length > 0 ? (
                    <div className="space-y-1.5 pt-2 border-t border-slate-200/80">
                      {cat.activeItems.slice(0, 3).map((item) => (
                        <div key={item.index} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-700 truncate pr-2" title={item.label}>
                            • {item.no}. {item.label}
                          </span>
                          <span className="font-mono font-bold text-slate-900 shrink-0">{item.count} kişi</span>
                        </div>
                      ))}
                      {cat.activeItems.length > 3 && (
                        <p className="text-[10px] text-slate-400 font-medium">
                          + {cat.activeItems.length - 3} farklı risk maddesinde daha kayıt var
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-400 italic">
                      Bu kategoride henüz işaretlenen risk bulunmuyor.
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 pt-1">
                    <span>Toplam İşaretleme: {cat.totalInCat}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('interventions')}
                      className="text-indigo-600 hover:underline"
                    >
                      Müdahale Planı &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* İki Kolonlu: En Çok Görülen 10 Risk & Sınıf Bazlı Risk Yoğunluğu */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sol: Okul Genelinde En Çok Görülen İlk 10 Risk Faktörü */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-600" />
                  Okul Genelinde En Sık Görülen Risk Faktörleri (İlk 10)
                </h2>
                <p className="text-xs text-slate-500">
                  Bir risk maddesine tıklayarak aşağıdaki öğrenci listesini o riske göre filtreleyebilirsiniz.
                </p>
              </div>

              {analyticsData.topRisks.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                  Henüz sınıf öğretmenleri tarafından girilmiş bir risk verisi bulunmamaktadır.
                </div>
              ) : (
                <div className="space-y-3">
                  {analyticsData.topRisks.map((item) => {
                    const isSelected = selectedRiskItemFilter === item.index;
                    const maxCount = analyticsData.topRisks[0]?.count || 1;
                    const barWidth = Math.max(8, Math.round((item.count / maxCount) * 100));

                    return (
                      <button
                        type="button"
                        key={item.index}
                        onClick={() =>
                          setSelectedRiskItemFilter(prev => (prev === item.index ? 'ALL' : item.index))
                        }
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-200'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                          <span className="font-bold text-slate-900 truncate">
                            Madde {item.no}: {item.label}
                          </span>
                          <span className="shrink-0 font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                            {item.count} Öğrenci (%{item.studentPercent})
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-600 rounded-full transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sağ: Sınıf / Şube Bazlı Risk Yoğunluk Tablosu */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <School className="w-4 h-4 text-indigo-600" />
                  Sınıf / Şube Bazlı Risk Yoğunluk Sıralaması
                </h2>
                <p className="text-xs text-slate-500">
                  Hangi şubede toplam kaç risk faktörü tespit edildiği ve şubenin en baskın risk alanı
                </p>
              </div>

              <div className="overflow-x-auto max-h-[420px] scrollbar-thin border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                      <th className="p-3">Sınıf / Şube</th>
                      <th className="p-3 text-center">Öğrenci</th>
                      <th className="p-3 text-center">Toplam Risk</th>
                      <th className="p-3">En Baskın Risk Faktörü</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {analyticsData.classSummaries.map((cs) => (
                      <tr
                        key={cs.orderNo}
                        onClick={() =>
                          setSelectedClassFilter(prev => (prev === cs.className ? 'ALL' : cs.className))
                        }
                        className={`cursor-pointer transition-colors ${
                          selectedClassFilter === cs.className ? 'bg-indigo-50/90' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="p-3 font-semibold text-slate-900">
                          <div>{cs.className}</div>
                          <div className="text-[10px] text-slate-400 font-normal">Rehber: {cs.classTeacher}</div>
                        </td>
                        <td className="p-3 text-center font-mono text-slate-700">{cs.studentCount}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                              cs.classRiskTotal > 0
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {cs.classRiskTotal}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-slate-600 max-w-[200px] truncate" title={cs.topRiskLabel}>
                          {cs.topRiskLabel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Risk Grubu Öğrencileri Bireysel Takip ve Filtreleme Tablosu */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  Risk Grubu Öğrencileri Detaylı Takip Listesi ({filteredRiskStudents.length} Öğrenci)
                </h2>
                <p className="text-xs text-slate-500">
                  En az 1 risk faktörü işaretlenmiş öğrencilerin sınıf ve risk maddelerine göre detaylı dökümü
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Öğrenci Arama */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    placeholder="Öğrenci adı veya no ara..."
                    className="pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Sınıf Filtresi */}
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none max-w-[220px]"
                >
                  <option value="ALL">Tüm Sınıflar ({classRows.length})</option>
                  {classRows.map((r) => (
                    <option key={r.orderNo} value={r.className}>
                      {r.className}
                    </option>
                  ))}
                </select>

                {/* Risk Maddesi Filtresi */}
                <select
                  value={selectedRiskItemFilter === 'ALL' ? 'ALL' : String(selectedRiskItemFilter)}
                  onChange={(e) =>
                    setSelectedRiskItemFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
                  }
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none max-w-[260px]"
                >
                  <option value="ALL">Tüm Risk Faktörleri (36 Madde)</option>
                  {MEB_OFFICIAL_RISK_ITEMS.map((item, idx) => (
                    <option key={idx} value={idx}>
                      {idx + 1}. {item} ({totals[idx] || 0})
                    </option>
                  ))}
                </select>

                {(selectedClassFilter !== 'ALL' || selectedRiskItemFilter !== 'ALL' || studentSearchTerm) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClassFilter('ALL');
                      setSelectedRiskItemFilter('ALL');
                      setStudentSearchTerm('');
                    }}
                    className="text-xs font-semibold text-rose-600 hover:underline px-2 py-1"
                  >
                    Filtreyi Temizle
                  </button>
                )}
              </div>
            </div>

            {filteredRiskStudents.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                Seçilen kriterlere uygun risk grubu öğrencisi bulunamadı.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px] scrollbar-thin border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                      <th className="p-3 whitespace-nowrap">Öğrenci No</th>
                      <th className="p-3 whitespace-nowrap">Adı Soyadı</th>
                      <th className="p-3 whitespace-nowrap">Sınıfı / Şubesi</th>
                      <th className="p-3 text-center whitespace-nowrap">Risk Sayısı</th>
                      <th className="p-3">Tespit Edilen Risk Faktörleri</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredRiskStudents.map((st, idx) => {
                      const isHighPriority = st.risks.length >= 3;
                      return (
                        <tr key={`${st.number}_${idx}`} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-slate-700 whitespace-nowrap">{st.number}</td>
                          <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{st.name}</td>
                          <td className="p-3 text-slate-600 whitespace-nowrap">{st.className}</td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                isHighPriority
                                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                                  : 'bg-amber-100 text-amber-800 border-amber-200'
                              }`}
                            >
                              {isHighPriority && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                              {st.risks.length} Risk
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1.5">
                              {st.risks.map((rIdx) => (
                                <span
                                  key={rIdx}
                                  className="text-[11px] bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-md font-medium"
                                >
                                  <strong>{rIdx + 1}.</strong> {MEB_OFFICIAL_RISK_ITEMS[rIdx]}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SEKME 2: RİSK GRUBU ÖĞRENCİLERİNE YÖNELİK YAPILACAK ÇALIŞMALAR VE MÜDAHALE REHBERİ */}
      {activeTab === 'interventions' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-emerald-950 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-700" />
                Risk Grubu Öğrencilerine Yönelik Yapılacak Çalışmalar ve Okul Müdahale Rehberi
              </h2>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Okulunuzun Risk Haritası verilerine göre her bir risk grubunda kaç öğrencinizin bulunduğunu canlı olarak görebilir; Okul İdaresi, PDR Servisi ve Sınıf/Branş Öğretmenleri tarafından yapılabilecek örnek çalışmaları inceleyip kurul tutanaklarınıza tek tıkla kopyalayabilirsiniz.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportDetailedReportExcel}
              disabled={isExportingDetailed}
              className="shrink-0 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              Tüm Çalışma Planını Excel İndir
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {analyticsData.categoryStats.map((cat) => (
              <div
                key={cat.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
              >
                {/* Kategori Başlığı ve Canlı Okul Verisi */}
                <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{cat.title}</h3>
                      <span className={`text-xs font-bold px-3 py-0.5 rounded-full border ${cat.badgeClass}`}>
                        Okulunuzda {cat.affectedStudentsCount} Öğrenci ({cat.totalInCat} Risk Kaydı)
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{cat.subtitle}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyActionPlanText(cat.sampleActivityText, cat.title)}
                    className="shrink-0 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 text-indigo-600" />
                    Kurul / Rapor Metnini Kopyala
                  </button>
                </div>

                {/* Okulda Bu Kategoride Tespit Edilen Maddeler Özeti */}
                {cat.activeItems.length > 0 && (
                  <div className="px-5 py-3 bg-amber-50/60 border-b border-amber-100 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-amber-900">
                      Okulunuzda Tespit Edilen Faktörler:
                    </span>
                    {cat.activeItems.map((ai) => (
                      <span
                        key={ai.index}
                        className="text-[11px] font-semibold bg-white text-amber-950 border border-amber-200 px-2.5 py-0.5 rounded-lg"
                      >
                        Madde {ai.no}: {ai.label} ({ai.count} Öğrenci)
                      </span>
                    ))}
                  </div>
                )}

                {/* 3 Sütunlu Müdahale Örnekleri */}
                <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-4 space-y-2.5">
                    <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-indigo-600" />
                      Okul İdaresi & PDR Servisi Çalışmaları
                    </h4>
                    <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                      {cat.adminPdrActions.map((act, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-indigo-600 font-bold mt-0.5">•</span>
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-4 space-y-2.5">
                    <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Sınıf & Branş Öğretmeni Uygulamaları
                    </h4>
                    <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                      {cat.teacherClassroomActions.map((act, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-600 font-bold mt-0.5">•</span>
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-amber-50/40 border border-amber-100 rounded-xl p-4 space-y-2.5">
                    <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-amber-600" />
                      Aile Eğitimi & Kurum İş Birliği
                    </h4>
                    <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                      {cat.familyAndInstitutionActions.map((act, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-600 font-bold mt-0.5">•</span>
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Hazır Kurul / Rapor Cümlesi */}
                <div className="px-5 pb-5">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-slate-600 leading-relaxed">
                      <strong className="text-slate-900">Örnek Kurul / Rapor Karar Metni: </strong>
                      &ldquo;{cat.sampleActivityText}&rdquo;
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEKME 3: RESMİ MEB KONSOLİDE RİSK MATRİSİ TABLOSU */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* İdareci Kontrol ve Filtre Çubuğu */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Sınıf veya şube ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
              <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100">
                {classRows.length} Şube Kayıtlı
              </span>
              <span className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-100">
                36 Resmi Risk Faktörü
              </span>
            </div>
          </div>

          {/* Geniş Matris Tablosu (Scrollable Excel Grid) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-slate-900 text-sm">Konsolide Okul Risk Matrisi (15173010_okulriskharitasi.xlsx)</span>
              </div>
              <span className="text-xs text-slate-500">
                * Sayıları incelemek için sağa doğru kaydırabilirsiniz
              </span>
            </div>

            <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  {/* Turuncu Bakanlık Header */}
                  <tr className="bg-[#f08535] text-white font-bold text-center border-b border-orange-600 sticky top-0 z-20">
                    <th className="px-3 py-3 border border-orange-600 whitespace-nowrap min-w-[50px] sticky left-0 bg-[#e07525] z-30">
                      Sıra No
                    </th>
                    <th className="px-4 py-3 border border-orange-600 whitespace-nowrap min-w-[240px] text-left sticky left-[50px] bg-[#e07525] z-30">
                      Sınıf / Şube
                    </th>
                    {MEB_OFFICIAL_RISK_ITEMS.map((item, idx) => (
                      <th 
                        key={idx} 
                        className="px-2 py-3 border border-orange-600 whitespace-nowrap min-w-[140px] max-w-[180px] font-semibold text-[11px] leading-tight"
                        title={item}
                      >
                        <div className="line-clamp-2">{item}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {filteredRows.map((row) => (
                    <tr key={row.orderNo} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-3 border border-slate-200 text-center font-bold font-mono sticky left-0 bg-white">
                        {row.orderNo}
                      </td>
                      <td className="px-4 py-3 border border-slate-200 font-semibold sticky left-[50px] bg-white">
                        <div>{row.className}</div>
                        <div className="text-[10px] text-slate-400 font-normal">Rehber: {row.classTeacher} ({row.studentCount} Öğrenci)</div>
                      </td>
                      {row.risks.map((val: number, cIdx: number) => (
                        <td 
                          key={cIdx} 
                          className={`px-2 py-3 border border-slate-200 text-center font-mono text-xs font-semibold ${
                            val > 0 ? 'bg-amber-50/80 text-amber-900 font-bold' : 'text-slate-300'
                          }`}
                        >
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* TOPLAM SATIRI (Turuncu/Krem Bakanlık Tarzı) */}
                  <tr className="bg-amber-100/70 font-bold text-slate-900 sticky bottom-0 z-10 border-t-2 border-orange-400">
                    <td className="px-3 py-3 border border-orange-300 text-center sticky left-0 bg-amber-200">
                      TOPLAM
                    </td>
                    <td className="px-4 py-3 border border-orange-300 sticky left-[50px] bg-amber-200">
                      Okul Geneli Toplamı
                    </td>
                    {totals.map((totalVal, cIdx) => (
                      <td 
                        key={cIdx} 
                        className="px-2 py-3 border border-orange-300 text-center font-mono text-xs font-bold text-amber-950 bg-amber-100"
                      >
                        {totalVal}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
