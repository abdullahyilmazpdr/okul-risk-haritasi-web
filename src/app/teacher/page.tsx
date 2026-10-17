'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, ArrowRight, GraduationCap, School } from 'lucide-react';
import { FALLBACK_CLASSES } from '@/lib/school-constants';

function getClassBaseKeyClient(clsName: string): string {
  const trMap: Record<string, string> = {
    'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'I': 'i', 'İ': 'i',
    'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u'
  };
  return (clsName || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/^ÖE[İI]U\s*-\s*/i, '')
    .replace(/Sınıf\s*Listesi.*$/i, '')
    .split('')
    .map(ch => trMap[ch] || ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
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
  const [classes, setClasses] = useState<any[]>(FALLBACK_CLASSES);
  const [teacher, setTeacher] = useState<any>(null);

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

      const buildClassList = (allStudents: any[]) => {
        let targetClassNames: string[] = deduplicateClassesClient(parsed.classes || []);
        if ((!targetClassNames.length || parsed.isAdmin) && allStudents.length > 0) {
          const distinctClasses = deduplicateClassesClient(allStudents.map(s => s.className).filter(Boolean));
          if (distinctClasses.length > 0) {
            targetClassNames = distinctClasses;
          }
        }

        if (targetClassNames.length > 0) {
          const dynamicList = targetClassNames.map((clsName: string, idx: number) => {
            const baseKey = getClassBaseKeyClient(clsName);
            // Eğer öğrencilerde bu sınıfın daha tam/parantezli adı varsa onu başlık olarak göster
            let displayName = clsName;
            const matchingStudents = allStudents.filter(s => {
              if (!s.className) return false;
              const sKey = getClassBaseKeyClient(s.className);
              if (sKey === baseKey || (sKey && baseKey && (sKey.includes(baseKey) || baseKey.includes(sKey)))) {
                if (s.className.length > displayName.length) {
                  displayName = s.className;
                }
                return true;
              }
              return false;
            });

            return {
              id: String(idx + 1),
              name: displayName,
              shortName: displayName.replace('ÖEİU - ', ''),
              studentCount: matchingStudents.length
            };
          });
          setClasses(dynamicList);
        } else if (allStudents.length > 0) {
          const distinctClasses = deduplicateClassesClient(allStudents.map(s => s.className).filter(Boolean));
          const dynamicList = distinctClasses.map((clsName: string, idx: number) => {
            const baseKey = getClassBaseKeyClient(clsName);
            return {
              id: String(idx + 1),
              name: clsName,
              shortName: clsName.replace('ÖEİU - ', ''),
              studentCount: allStudents.filter(s => getClassBaseKeyClient(s.className) === baseKey).length
            };
          });
          setClasses(dynamicList);
        }
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

      // 2. Canlı E-Tablo verisinden öğrenci sayılarını güncelle
      const schoolKey = parsed?.schoolKey || localStorage.getItem('last_school_key') || '';
      const spreadsheetId = parsed?.spreadsheetId || localStorage.getItem('active_spreadsheet_id') || '';
      const url = new URL('/api/school-data', window.location.origin);
      if (schoolKey) url.searchParams.set('schoolKey', schoolKey);
      if (spreadsheetId) url.searchParams.set('spreadsheetId', spreadsheetId);

      fetch(url.toString())
        .then(r => r.json())
        .then(json => {
          if (json?.data?.students && Array.isArray(json.data.students)) {
            localStorage.setItem('school_students', JSON.stringify(json.data.students));
            buildClassList(json.data.students);
          }
        })
        .catch(() => {});
    } catch (e) {}
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
      </div>
    </div>
  );
}
