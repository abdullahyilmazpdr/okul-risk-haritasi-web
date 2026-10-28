'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, User, MessageSquarePlus, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';
import { FALLBACK_STUDENTS, FALLBACK_CLASSES } from '@/lib/school-constants';

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

function ClassDetailsContent() {
  const params = useParams();
  const classId = (params?.classId as string) || '1';
  
  const [teacher, setTeacher] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentClassName, setCurrentClassName] = useState<string>('');
  const [studentStatuses, setStudentStatuses] = useState<Record<string, { sokCount: number; mySokFilled: boolean; riskCount: number; groupTrainingDays?: string[] }>>({});

  useEffect(() => {
    let currentTeacher: any = null;
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem('teacher_session');
    if (stored) {
      try {
        currentTeacher = JSON.parse(stored);
        if (Array.isArray(currentTeacher.classes)) {
          currentTeacher.classes = deduplicateClassesClient(currentTeacher.classes);
        }
        setTeacher(currentTeacher);
      } catch (e) {}
    }

    // Sınıf adını belirle
    let resolvedClass = '';
    const decodedClassId = decodeURIComponent(classId).trim();
    const targetBaseKey = getClassBaseKeyClient(decodedClassId);

    // 1. Önce localStorage'dan öğrenci listesini yükle
    let loadedStudents: any[] = [];
    let allParsedStudents: any[] = [];
    const storedStudentsRaw = localStorage.getItem('school_students');
    if (storedStudentsRaw) {
      try {
        const parsed = JSON.parse(storedStudentsRaw);
        if (Array.isArray(parsed)) allParsedStudents = parsed;
      } catch (e) {}
    }

    const distinctSchoolClasses = deduplicateClassesClient(allParsedStudents.map((s: any) => s.className).filter(Boolean));
    const teacherClasses: string[] = Array.isArray(currentTeacher?.classes) ? currentTeacher.classes : [];

    const isManager = Boolean(
      currentTeacher?.isAdmin ||
      currentTeacher?.role?.toLowerCase().includes('müdür') ||
      currentTeacher?.role?.toLowerCase().includes('idare')
    );

    // ÖNCELİK 1: Doğrudan baseKey eşleşmesi (Örn: "9a" -> "ÖEİU - 9/A" veya "9/A")
    // İdareci / Müdür Yardımcısı için öncelikle tüm okul sınıflarında ara
    let matchedClass: string | undefined = undefined;
    if (isManager) {
      matchedClass = distinctSchoolClasses.find(c => getClassBaseKeyClient(c) === targetBaseKey);
      if (!matchedClass) {
        matchedClass = teacherClasses.find(c => getClassBaseKeyClient(c) === targetBaseKey);
      }
    } else {
      matchedClass = teacherClasses.find(c => getClassBaseKeyClient(c) === targetBaseKey);
      if (!matchedClass) {
        matchedClass = distinctSchoolClasses.find(c => getClassBaseKeyClient(c) === targetBaseKey);
      }
    }

    // ÖNCELİK 2: Metin/İsim eşleşmesi (Tam eşitlik veya includes)
    if (!matchedClass) {
      const lowerDecoded = decodedClassId.toLowerCase();
      if (isManager) {
        matchedClass = distinctSchoolClasses.find(c => c.toLowerCase().trim() === lowerDecoded || c.toLowerCase().includes(lowerDecoded));
        if (!matchedClass) {
          matchedClass = teacherClasses.find(c => c.toLowerCase().trim() === lowerDecoded || c.toLowerCase().includes(lowerDecoded));
        }
      } else {
        matchedClass = teacherClasses.find(c => c.toLowerCase().trim() === lowerDecoded || c.toLowerCase().includes(lowerDecoded));
        if (!matchedClass) {
          matchedClass = distinctSchoolClasses.find(c => c.toLowerCase().trim() === lowerDecoded || c.toLowerCase().includes(lowerDecoded));
        }
      }
    }

    // ÖNCELİK 3: Sayısal İndeks (Yalnızca parametre TAMAMEN rakamlardan oluşuyorsa, örn: "1", "2")
    if (!matchedClass && /^\d+$/.test(decodedClassId)) {
      const numericIndex = parseInt(decodedClassId, 10);
      if (isManager && distinctSchoolClasses.length > 0 && numericIndex >= 1 && numericIndex <= distinctSchoolClasses.length) {
        matchedClass = distinctSchoolClasses[numericIndex - 1];
      } else if (teacherClasses.length > 0 && numericIndex >= 1 && numericIndex <= teacherClasses.length) {
        matchedClass = teacherClasses[numericIndex - 1];
      } else if (distinctSchoolClasses.length > 0 && numericIndex >= 1 && numericIndex <= distinctSchoolClasses.length) {
        matchedClass = distinctSchoolClasses[numericIndex - 1];
      }
    }

    resolvedClass = matchedClass || (decodedClassId !== '1' ? decodedClassId : (distinctSchoolClasses[0] || 'Genel Sınıf'));

    if (allParsedStudents.length > 0) {
      // Sınıfa göre filtrele (Yalnızca bu sınıfa ait öğrencileri al)
      const baseKey = getClassBaseKeyClient(resolvedClass);
      const filtered = allParsedStudents.filter((s: any) => {
        if (!s.className) return false;
        return getClassBaseKeyClient(s.className) === baseKey;
      });

      if (filtered.length > 0 && filtered[0]?.className && filtered[0].className.length > resolvedClass.length) {
        resolvedClass = filtered[0].className;
      }

      loadedStudents = filtered;
    }

    setCurrentClassName(resolvedClass);
    setStudents(loadedStudents);
    setIsLoading(false);

    // 2. Durumları ve /api/school-data üzerinden canlı öğrenci verilerini çek
    const loadDataAndStatuses = async () => {
      try {
        const storedSpreadsheetId = currentTeacher?.spreadsheetId || localStorage.getItem('active_spreadsheet_id') || '';
        const schoolKey = currentTeacher?.schoolKey || localStorage.getItem('last_school_key') || '';

        // Canlı okul verisini API'den çek (sunucu tarafındaki okul / servis hesabı yetkilendirmesini kullanır)
        const schoolDataUrl = new URL('/api/school-data', window.location.origin);
        if (storedSpreadsheetId) schoolDataUrl.searchParams.set('spreadsheetId', storedSpreadsheetId);
        if (schoolKey) schoolDataUrl.searchParams.set('schoolKey', schoolKey);

        const schoolRes = await fetch(schoolDataUrl.toString());

        let freshStudents = loadedStudents;

        if (schoolRes.ok) {
          const schoolJson = await schoolRes.json();

          // Öğretmenin güncel sınıflarını canlı veriden güncelle
          if (schoolJson?.data?.teachers && Array.isArray(schoolJson.data.teachers) && currentTeacher) {
            const uNorm = (currentTeacher.username || '').toLowerCase().trim();
            const nNorm = (currentTeacher.name || '').toLowerCase().trim();
            const liveT = schoolJson.data.teachers.find((t: any) =>
              (uNorm && (t.username || '').toLowerCase().trim() === uNorm) ||
              (nNorm && (t.name || '').toLowerCase().trim() === nNorm)
            );
            if (liveT && Array.isArray(liveT.classes) && liveT.classes.length > 0) {
              const updated = deduplicateClassesClient(liveT.classes);
              currentTeacher.classes = updated;
              localStorage.setItem('teacher_session', JSON.stringify(currentTeacher));
              setTeacher({ ...currentTeacher });
            }
          }

          if (schoolJson?.data?.students && Array.isArray(schoolJson.data.students) && schoolJson.data.students.length > 0) {
            localStorage.setItem('school_students', JSON.stringify(schoolJson.data.students));
            
            const freshDistinct = deduplicateClassesClient(schoolJson.data.students.map((s: any) => s.className).filter(Boolean));
            const freshMatch = freshDistinct.find((c: string) => getClassBaseKeyClient(c) === targetBaseKey);
            if (freshMatch) {
              resolvedClass = freshMatch;
            } else if (!matchedClass && freshDistinct.length > 0) {
              resolvedClass = freshDistinct[0];
            }

            const baseKey = getClassBaseKeyClient(resolvedClass);
            const filtered = schoolJson.data.students.filter((s: any) => {
              if (!s.className) return false;
              return getClassBaseKeyClient(s.className) === baseKey;
            });

            if (filtered.length > 0 && filtered[0]?.className && filtered[0].className.length > resolvedClass.length) {
              setCurrentClassName(filtered[0].className);
            } else {
              setCurrentClassName(resolvedClass);
            }

            freshStudents = filtered;
            setStudents(freshStudents);
          }
        }

        // ŞÖK görüşlerini çekerek her öğrenci için durumları güncelle
        const opinionUrl = new URL('/api/student-opinion', window.location.origin);
        opinionUrl.searchParams.set('all', 'true');
        if (storedSpreadsheetId) opinionUrl.searchParams.set('spreadsheetId', storedSpreadsheetId);
        if (schoolKey) opinionUrl.searchParams.set('schoolKey', schoolKey);

        const opRes = await fetch(opinionUrl.toString());
        const opJson = await opRes.json();

        const statuses: Record<string, { sokCount: number; mySokFilled: boolean; riskCount: number; groupTrainingDays: string[] }> = {};
        const tUser = (currentTeacher?.username || '').toLowerCase().trim();
        const tName = (currentTeacher?.name || '').toLowerCase().trim();

        for (const st of freshStudents) {
          const sNum = String(st.number || st.id || '').trim();
          let rCount = 0;
          let opCount = 0;
          let myFilled = false;
          let gDays: string[] = [];

          // LocalStorage kontrolü
          const evalRaw = localStorage.getItem(`student_eval_${sNum}`);
          if (evalRaw) {
            try {
              const parsed = JSON.parse(evalRaw);
              if (Array.isArray(parsed.risks)) rCount = parsed.risks.length;
              if (Array.isArray(parsed.groupTrainingDays)) {
                gDays = parsed.groupTrainingDays;
                if (gDays.length > 0) myFilled = true;
              }
              if (parsed.opinions && typeof parsed.opinions === 'object') {
                for (const [uKey, opObj] of Object.entries<any>(parsed.opinions)) {
                  if (uKey.toLowerCase().trim() === tUser) {
                    myFilled = true;
                  }
                  if (opObj?.opinion && opObj.opinion.trim()) {
                    opCount++;
                  }
                }
              }
            } catch (e) {}
          }

          // API'den gelen canlı görüşler
          if (opJson?.success && Array.isArray(opJson.opinions)) {
            const studentOps = opJson.opinions.filter((o: any) => String(o.studentNumber).trim() === sNum);
            for (const op of studentOps) {
              const opTeacher = (op.teacherName || '').toLowerCase().trim();
              if (opTeacher === tName || opTeacher === tUser) {
                myFilled = true;
              }
              if (op.opinion && op.opinion.trim()) {
                opCount++;
              }
              if (Array.isArray(op.risks) && op.risks.length > 0) {
                rCount = Math.max(rCount, op.risks.length);
              }
              if (Array.isArray(op.groupTrainingDays) && op.groupTrainingDays.length > 0) {
                gDays = op.groupTrainingDays;
              }
            }
          }

          statuses[sNum] = { sokCount: opCount, mySokFilled: myFilled, riskCount: rCount, groupTrainingDays: gDays };
        }

        setStudentStatuses(statuses);
      } catch (err) {
        console.error('Sınıf ve öğrenci verileri yükleme hatası:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDataAndStatuses();
  }, [classId]);

  const isAdmin = Boolean(teacher?.isAdmin || teacher?.role?.toLowerCase().includes('müdür') || teacher?.role?.toLowerCase().includes('idare'));
  const isClassTeacher = Boolean(
    teacher?.isClassTeacher ||
    teacher?.role?.toLowerCase().includes('sınıf') ||
    teacher?.role?.toLowerCase().includes('rehber') ||
    teacher?.role?.toLowerCase().includes('özel eğitim')
  );
  const isSubjectTeacher = !isAdmin && !isClassTeacher;

  const maleCount = students.filter(s => s.gender === 'Erkek').length;
  const femaleCount = students.filter(s => s.gender === 'Kız').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/teacher" className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                Sınıf Listesi
              </span>
              {isAdmin && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> İdareci / Müdür Yardımcısı
                </span>
              )}
              {isClassTeacher && !isAdmin && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Sınıf Rehber Öğretmeni
                </span>
              )}
              {!isAdmin && !isClassTeacher && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                  Ders Öğretmeni
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{currentClassName || 'Sınıf Detayı'}</h1>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-4 text-xs font-semibold text-slate-600 shadow-sm self-start sm:self-auto">
          <span>Toplam: <strong>{students.length} Öğrenci</strong></span>
          <span className="text-slate-300">|</span>
          <span className="text-emerald-600">Erkek: <strong>{maleCount}</strong></span>
          <span className="text-slate-300">|</span>
          <span className="text-purple-600">Kız: <strong>{femaleCount}</strong></span>
        </div>
      </div>

      {/* İlerleme Durumu Rozeti */}
      {students.length > 0 && (() => {
        const completedCount = students.filter(s => {
          const sNum = String(s.number || s.id || '').trim();
          return studentStatuses[sNum]?.mySokFilled;
        }).length;
        const percent = Math.round((completedCount / students.length) * 100);

        return (
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-900">Görüş / Değerlendirme İlerlemeniz:</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                  {completedCount} / {students.length} Öğrenci (%{percent})
                </span>
              </div>
              <p className="text-[11px] text-indigo-700">
                {percent === 100 
                  ? '🎉 Tebrikler! Bu sınıftaki tüm öğrencilerin işlemlerini eksiksiz tamamladınız.' 
                  : `Kalan ${students.length - completedCount} öğrencinin değerlendirmesini tamamlayınız.`}
              </p>
            </div>
            <div className="w-full sm:w-48 bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
              <div 
                className={`h-2.5 rounded-full transition-all duration-500 ${percent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })()}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm">Öğrenci Listesi ve Durumları</h2>
          <p className="text-xs text-slate-500">Öğrencinin satırındaki butona tıklayarak ŞÖK ve Risk Haritası işlemlerini yapabilirsiniz.</p>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Öğrenci listesi ve durumları yükleniyor...
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <User className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">Bu Sınıfta Kayıtlı Öğrenci Bulunamadı</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Google E-Tablo'da veya sistemde bu sınıfa ait öğrenci kaydı bulunamadı. Lütfen yönetici panelinden E-Okul Öğrenci Listesi (PDF) dosyasının yüklendiğinden emin olun.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">No</th>
                  <th className="px-6 py-4">Öğrenci Adı Soyadı</th>
                  <th className="px-6 py-4">Cinsiyet</th>
                  <th className="px-6 py-4">İşlem Durumu</th>
                  <th className="px-6 py-4 text-right">Eylemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student, idx) => {
                  const sId = String(student.number || student.id || idx + 1);
                  const status = studentStatuses[sId] || studentStatuses[student.number] || { sokCount: 0, mySokFilled: false, riskCount: 0 };
                  const hasRisk = status.riskCount > 0;

                  return (
                    <tr key={sId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-800 text-base">{student.number || idx + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                            student.gender === 'Kız' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {student.gender === 'Kız' ? 'K' : 'E'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{student.name}</div>
                            <div className="text-xs text-slate-400">{student.className || currentClassName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                          student.gender === 'Kız' ? 'bg-pink-50 text-pink-700 border border-pink-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}>
                          {student.gender || 'Belirtilmedi'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {/* Ders Öğretmeni ise kendi görüşünü görsün */}
                          {isSubjectTeacher ? (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                              status.mySokFilled
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {status.mySokFilled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                              {status.mySokFilled ? 'ŞÖK Görüşünüz Girildi' : 'ŞÖK Görüşü Bekliyor'}
                            </span>
                          ) : (
                            // Sınıf Öğretmeni veya İdareci ise genel ŞÖK sayısını ve Risk Haritasını görsün
                            <>
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                status.sokCount > 0 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {status.sokCount > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                {status.sokCount > 0 ? `ŞÖK (${status.sokCount} Görüş)` : 'ŞÖK Bekliyor'}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                hasRisk 
                                  ? 'bg-indigo-100 text-indigo-800' 
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {hasRisk ? `Risk Haritası (${status.riskCount} Madde)` : 'Risk Haritası Boş'}
                              </span>
                              {status.groupTrainingDays && status.groupTrainingDays.length > 0 && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                                  Grup Eğitimi ({status.groupTrainingDays.join(', ')})
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          href={`/teacher/class/${classId}/student/${student.number || student.id || sId}`}
                          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm"
                        >
                          <MessageSquarePlus className="w-4 h-4" />
                          Görüş / Form Doldur
                        </Link>
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
  );
}

export default function ClassDetailsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Yükleniyor...</div>}>
      <ClassDetailsContent />
    </Suspense>
  );
}
