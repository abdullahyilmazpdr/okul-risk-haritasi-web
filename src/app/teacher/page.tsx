'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, ArrowRight, GraduationCap, School, Loader2 } from 'lucide-react';

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

export default function TeacherDashboard() {
  const [classes, setClasses] = useState<any[]>([]);
  const [teacher, setTeacher] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('teacher_session');
    if (!stored) {
      window.location.href = '/teacher/login';
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.classes)) {
        const deduped = deduplicateClassesClient(parsed.classes);
        if (deduped.length !== parsed.classes.length) {
          parsed.classes = deduped;
          localStorage.setItem('teacher_session', JSON.stringify(parsed));
        }
      }
      setTeacher(parsed);

      const buildClassList = (allStudents: any[], overrideTeacherClasses?: string[]) => {
        const isManager = Boolean(
          parsed.isAdmin || 
          parsed.role?.toLowerCase().includes('müdür') || 
          parsed.role?.toLowerCase().includes('idare')
        );

        const distinctClasses = deduplicateClassesClient(allStudents.map(s => s.className).filter(Boolean));
        let targetClassNames: string[] = [];

        if (isManager) {
          // Müdür Yardımcısı / İdareci: Okuldaki TÜM sınıfları otomatik olarak görür
          targetClassNames = distinctClasses.length > 0 ? distinctClasses : deduplicateClassesClient(overrideTeacherClasses || parsed.classes || []);
        } else {
          // Normal Öğretmen: SADECE kendisine atanmış sınıfları görür.
          // Kendisine atanmış sınıf yoksa boş liste kalır (okul sınıflarına düşmez, kart oluşmaz).
          targetClassNames = deduplicateClassesClient(overrideTeacherClasses || parsed.classes || []);
        }

        if (targetClassNames.length > 0) {
          const dynamicList = targetClassNames.map((clsName: string, idx: number) => {
            const baseKey = getClassBaseKeyClient(clsName);
            // Eğer öğrencilerde bu sınıfın daha tam/parantezli adı varsa onu başlık olarak göster
            let displayName = clsName;
            const matchingStudents = allStudents.filter(s => {
              if (!s.className) return false;
              const sKey = getClassBaseKeyClient(s.className);
              if (sKey === baseKey) {
                if (s.className.length > displayName.length) {
                  displayName = s.className;
                }
                return true;
              }
              return false;
            });

            return {
              id: baseKey || String(idx + 1),
              name: displayName,
              shortName: displayName.replace('ÖEİU - ', ''),
              studentCount: matchingStudents.length
            };
          });
          setClasses(dynamicList);
        } else {
          setClasses([]);
        }
        setIsLoading(false);
      };

      // 1. Önce yerel önbellekten hesapla
      let localStudents: any[] = [];
      const storedStudentsRaw = localStorage.getItem('school_students');
      if (storedStudentsRaw) {
        try {
          localStudents = JSON.parse(storedStudentsRaw);
        } catch (e) {}
      }
      buildClassList(localStudents);

      // 2. Canlı E-Tablo verisinden öğrenci sayılarını ve öğretmenin güncel sınıflarını senkronize et
      const schoolKey = parsed?.schoolKey || localStorage.getItem('last_school_key') || '';
      const spreadsheetId = parsed?.spreadsheetId || localStorage.getItem('active_spreadsheet_id') || '';
      const url = new URL('/api/school-data', window.location.origin);
      if (schoolKey) url.searchParams.set('schoolKey', schoolKey);
      if (spreadsheetId) url.searchParams.set('spreadsheetId', spreadsheetId);

      fetch(url.toString())
        .then(r => r.json())
        .then(json => {
          let updatedClasses: string[] | undefined = undefined;
          if (json?.data?.teachers && Array.isArray(json.data.teachers)) {
            const uNorm = (parsed.username || '').toLowerCase().trim();
            const nNorm = (parsed.name || '').toLowerCase().trim();
            const liveTeacher = json.data.teachers.find(
              (t: any) =>
                (uNorm && (t.username || '').toLowerCase().trim() === uNorm) ||
                (nNorm && (t.name || '').toLowerCase().trim() === nNorm)
            );
            if (liveTeacher && Array.isArray(liveTeacher.classes) && liveTeacher.classes.length > 0) {
              updatedClasses = deduplicateClassesClient(liveTeacher.classes);
              parsed.classes = updatedClasses;
              localStorage.setItem('teacher_session', JSON.stringify(parsed));
              setTeacher({ ...parsed });
            }
          }
          if (json?.data?.students && Array.isArray(json.data.students)) {
            localStorage.setItem('school_students', JSON.stringify(json.data.students));
            buildClassList(json.data.students, updatedClasses);
          } else if (updatedClasses) {
            buildClassList(localStudents, updatedClasses);
          } else {
            setIsLoading(false);
          }
        })
        .catch(() => {
          setIsLoading(false);
        });
    } catch (e) {
      setIsLoading(false);
    }
  }, []);

  if (!teacher) {
    return null;
  }

  const isClassTeacher = Boolean(
    teacher?.isClassTeacher ||
    teacher?.role?.toLowerCase().includes('sınıf') ||
    teacher?.role?.toLowerCase().includes('rehber') ||
    teacher?.role?.toLowerCase().includes('özel eğitim')
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-1">
            <School className="w-4 h-4" />
            {teacher?.schoolName || 'Okul Risk Haritası ve ŞÖK Sistemi'}
          </div>
          <h1 className="text-2xl font-bold flex flex-wrap items-center gap-2">
            <span>Hoş Geldiniz, {teacher?.name || teacher?.username || 'Değerli Öğretmenimiz'}</span>
            {teacher?.isAdmin && (
              <span className="bg-amber-400 text-amber-950 text-xs px-2.5 py-1 rounded-full font-bold shadow-sm">
                Müdür Yardımcısı (İdareci)
              </span>
            )}
            {isClassTeacher && !teacher?.isAdmin && (
              <span className="bg-emerald-400 text-emerald-950 text-xs px-2.5 py-1 rounded-full font-bold shadow-sm">
                Sınıf Rehber Öğretmeni
              </span>
            )}
            {!teacher?.isAdmin && !isClassTeacher && (
              <span className="bg-blue-300 text-blue-950 text-xs px-2.5 py-1 rounded-full font-bold shadow-sm">
                Ders Öğretmeni
              </span>
            )}
          </h1>
          <p className="text-indigo-200 text-sm mt-1">
            Göreviniz: <span className="font-semibold text-white">{teacher?.role || 'Öğretmen'}</span> | Sorumlu olduğunuz sınıflar aşağıda listelenmiştir.
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2.5 text-center flex-shrink-0">
          <div className="text-2xl font-bold">{classes.length}</div>
          <div className="text-xs text-indigo-200">Sorumlu Sınıf</div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
              Dersine Girdiğiniz Sınıflar
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">ŞÖK görüşü girmek veya Risk Haritası doldurmak için sınıfı seçiniz.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
            Sınıflarınız ve öğrenci bilgileri yükleniyor...
          </div>
        ) : classes.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border border-dashed border-slate-300 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Tanımlı Sınıf Bulunamadı</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto mt-1 leading-relaxed">
                Sisteme başarıyla giriş yaptınız; ancak şu anda hesabınıza atanmış sorumlu veya dersine girdiğiniz bir sınıf bulunmuyor. Ders programınız veya sınıf atamanız tamamlandığında sınıflarınız burada listelenecektir. Konuyla ilgili okul idareniz ile iletişime geçebilirsiniz.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => (
              <Link href={`/teacher/class/${cls.id}`} key={cls.id}>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Users className="w-6 h-6" />
                      </div>
                      <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                    </div>
                    
                    <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Özel Eğitim Şubesi</span>
                    <h3 className="text-base font-bold text-slate-900 mt-1 line-clamp-2 min-h-[3rem]">
                      {cls.name}
                    </h3>
                  </div>
                  
                  <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-100 text-sm">
                    <span className="text-slate-500">Kayıtlı Öğrenci</span>
                    <span className="font-semibold text-slate-800 bg-slate-100 px-3 py-1 rounded-full text-xs">
                      {cls.studentCount} Öğrenci
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
