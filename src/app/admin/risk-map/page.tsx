'use client';

import { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  RefreshCw, 
  Search, 
  Users, 
  School, 
  CheckCircle2,
  ExternalLink,
  Table,
  Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MEB_OFFICIAL_RISK_ITEMS } from '@/lib/meb-risk-items';
import { getCurrentAcademicYear } from '@/lib/academic-year';

export default function AdminRiskMapPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [classRows, setClassRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<number[]>([]);
  const [stats, setStats] = useState({ totalStudents: 0, totalTeachers: 0 });
  const [currentYear, setCurrentYear] = useState('2025-2026');

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
        if (data.stats) setStats(data.stats);
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

  // Filtreleme
  const filteredRows = classRows.filter(row => {
    const matchesSearch = row.className.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClassFilter === 'ALL' || row.className === selectedClassFilter;
    return matchesSearch && matchesClass;
  });

  const handleSyncToSheets = async () => {
    const storedSpreadsheetId = typeof window !== 'undefined' ? localStorage.getItem('active_spreadsheet_id') : null;
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('google_access_token') : null;

    if (!storedSpreadsheetId || !storedToken) {
      toast.error('E-Tablo bağlantısı veya yetkilendirme bulunamadı. Lütfen sol menüden E-Tablonuzu bağlayın.');
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
        ["OKUL ADI:", "Meram Özel Eğitim Uygulama Okulu III. Kademe"],
        ["İLÇESİ:", "Meram / KONYA"],
        ["TOPLAM ÖĞRENCİ SAYISI:", String(stats.totalStudents || 19)],
        ["TOPLAM ÖĞRETMEN SAYISI:", String(stats.totalTeachers || 14)],
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

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Üst Bilgi Kartı */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-1">
            <School className="w-4 h-4" />
            Bakanlık Standart Formatı (15173010_okulriskharitasi.xlsx)
          </div>
          <h1 className="text-2xl font-bold">{currentYear} Eğitim Öğretim Yılı Okul Risk Haritası</h1>
          <p className="text-slate-300 text-sm mt-1">
            Sınıf rehber öğretmenlerinin öğrencileri için girdiği 36 risk faktörünün Google E-Tablo'dan canlı konsolide matrisi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchMatrixData}
            disabled={isLoading}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-medium px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Canlı Yenile
          </button>

          <button
            onClick={handleSyncToSheets}
            disabled={isSyncing || classRows.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {isSyncing ? 'İşleniyor...' : "E-Tabloya Yaz"}
          </button>

          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Hazırlanıyor...' : 'Bakanlık Excel İndir'}
          </button>
        </div>
      </div>

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
            <span className="font-bold text-slate-900 text-sm">Konsolide Okul Risk Matrisi</span>
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
  );
}
