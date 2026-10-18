import { extractText } from 'unpdf';

export interface Student {
  number: string;
  name: string;
  gender?: string;
  className: string;
}

export interface Teacher {
  name: string;
  role?: string; // 'Sınıf Öğretmeni', 'Müdür Yardımcısı', 'Branş Öğretmeni'
  branch?: string;
  classes: string[];
  username?: string;
  password?: string;
  whatsappLink?: string;
}

// Şifre üretici yardımcı fonksiyon: 8 karakterli güvenli şifre
export function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let pass = '';
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

// Türkçe karakterleri latin harflerine çevirici
export function slugifyTr(text: string): string {
  const trMap: Record<string, string> = {
    'ç': 'c', 'Ç': 'c',
    'ğ': 'g', 'Ğ': 'g',
    'ı': 'i', 'I': 'i', 'İ': 'i',
    'ö': 'o', 'Ö': 'o',
    'ş': 's', 'Ş': 's',
    'ü': 'u', 'Ü': 'u'
  };
  return text.split('').map(ch => trMap[ch] || ch).join('')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// İsimden otomatik kullanıcı adı üretici
export function generateUsername(name: string): string {
  const cleanName = slugifyTr(name || '');
  const baseName = cleanName.length >= 4 ? cleanName : `ogretmen${cleanName}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${baseName}${randomSuffix}`;
}

/**
 * Sınıf adlarının (Öğrenci Listesi PDF'indeki parantezli tam ad ile Ders Programı PDF'indeki kısa adın)
 * aynı sınıfı temsil edip etmediğini anlamak için normalize edilmiş temel anahtar üretir.
 * Örn:
 * - "ÖEİU - 9. Sınıf Orta-Ağır Zihinsel / A Şubesi (ORTA AĞIR ZİHİNSEL ENGELLİLER)" -> "9sinifortaagirzihinselasubesi"
 * - "ÖEİU - 9. Sınıf Orta-Ağır Zihinsel / A Şubesi" -> "9sinifortaagirzihinselasubesi"
 */
export function getClassBaseKey(clsName: string): string {
  if (!clsName) return '';
  const withoutParens = clsName
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

/**
 * Aynı sınıfın farklı yazımlarını (uzun parantezli ve kısa) tekilleştirir; her zaman daha açıklayıcı/uzun olan ismi korur.
 */
export function deduplicateClasses(classList: string[]): string[] {
  const map = new Map<string, string>();
  for (const raw of classList || []) {
    const trimmed = (raw || '').trim();
    if (!trimmed) continue;
    const key = getClassBaseKey(trimmed);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing || trimmed.length > existing.length) {
      map.set(key, trimmed);
    }
  }
  return Array.from(map.values());
}

// WhatsApp paylaşım bağlantısı oluşturucu
export function buildWhatsAppLink(
  name: string,
  username: string,
  password: string,
  classesOrRole?: string[] | string,
  role?: string
): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://risk.onlinepdr.com/teacher/login';
  const classes = Array.isArray(classesOrRole) ? classesOrRole : [];
  const finalRole = typeof classesOrRole === 'string' ? classesOrRole : (role || '');
  const roleText = finalRole ? ` (${finalRole})` : '';
  const classLine = classes.length > 0 ? `Sınıflar: ${classes.join(', ')}\n` : '';
  const waMessage = encodeURIComponent(
    `Sayın ${name}${roleText}, Okul Risk Haritası ve ŞÖK sistemine giriş bilgileriniz:\n\n` +
    `Giriş Adresi: ${siteUrl}\n` +
    `Kullanıcı Adı: ${username}\n` +
    `Şifre: ${password}\n` +
    classLine +
    `\nLütfen sisteme giriş yaparak işlemlerinizi tamamlayınız.`
  );
  return `https://wa.me/?text=${waMessage}`;
}

// Öğretmen için kullanıcı adı ve WhatsApp bağlantısı oluşturucu
export function createTeacherCredentials(name: string, role?: string, branch?: string, classes: string[] = []): Teacher {
  const username = generateUsername(name);
  const password = generatePassword();

  return {
    name,
    role,
    branch,
    classes,
    username,
    password,
    whatsappLink: buildWhatsAppLink(name, username, password, role || branch)
  };
}

export interface StudentListParseResult {
  students: Student[];
  teachers: Teacher[]; // Sınıf Öğretmeni ve Müdür Yardımcısı
}

export async function parseStudentList(buffer: Buffer): Promise<StudentListParseResult> {
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: false });
  const pages: string[] = Array.isArray(text) ? text : [text || ''];
  
  const students: Student[] = [];
  const teachersMap = new Map<string, Teacher>();

  const registerTeacher = (rawName: string, role: string, branch: string, clsName: string) => {
    const clean = rawName
      .replace(/Sınıf\s*Başkan.*$/i, '')
      .replace(/Sınıf\s*Müdür.*$/i, '')
      .replace(/Sınıf\s*Öğretmeni.*$/i, '')
      .trim();
    if (!clean || clean.length < 2 || clean.toLowerCase().includes('bulunamadı')) return;

    const mapKey = `${slugifyTr(clean)}_${role}`;
    if (teachersMap.has(mapKey)) {
      const existing = teachersMap.get(mapKey)!;
      if (clsName && clsName !== 'Bilinmeyen Sınıf') {
        existing.classes = deduplicateClasses([...existing.classes, clsName]);
      }
    } else {
      teachersMap.set(
        mapKey,
        createTeacherCredentials(clean, role, branch, clsName && clsName !== 'Bilinmeyen Sınıf' ? [clsName] : [])
      );
    }
  };

  for (const pageText of pages) {
    const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);
    let pageClassName = "Bilinmeyen Sınıf";
    const pageClassTeachers: string[] = [];
    const pageVicePrincipals: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 1. Sınıf adını başlıktan bul (Örn: "ÖEİU - 9. Sınıf Orta-Ağır Zihinsel / A Şubesi (ORTA AĞIR ZİHİNSEL ENGELLİLER) Sınıf Listesi")
      if (line.includes('Şubesi') && (line.includes('Sınıf Listesi') || line.includes('Sınıf'))) {
        pageClassName = line.replace(/Sınıf\s*Listesi.*$/i, '').trim();
      } else if (line.includes('Sınıf') && line.includes('Şubesi') && !line.includes('Öğretmeni')) {
        pageClassName = line.trim();
      }

      // 2. Sınıf Öğretmenini bul (Örn: "Sınıf Öğretmeni: İ*** Ö***" veya "Sınıf Rehber Öğretmeni : ...")
      if (/Sınıf\s*(?:Rehber\s*)?Öğretmeni\s*:/i.test(line)) {
        const m = line.match(/Sınıf\s*(?:Rehber\s*)?Öğretmeni\s*:\s*(.+?)(?:\s+Sınıf\s+Müdür|\s+Müdür\s+Yrd|\s+Sınıf\s+Başkan|$)/i);
        if (m && m[1].trim()) {
          pageClassTeachers.push(m[1].trim());
        }
      }

      // 3. Sınıf Müdür Yardımcısını bul (Örn: "Sınıf Müdür Yrd: İ*** A*** Sınıf Başkan Yrd:")
      if (/(?:Sınıf\s*)?Müdür\s*Yrd\s*:/i.test(line) || /Müdür\s*Yardımcısı\s*:/i.test(line)) {
        const m = line.match(/(?:Sınıf\s*)?Müdür\s*(?:Yrd|Yardımcısı)\s*:\s*(.+?)(?:\s+Sınıf\s+Başkan|\s+Başkan|\s+Sınıf\s+Öğretmeni|$)/i);
        if (m && m[1].trim()) {
          pageVicePrincipals.push(m[1].trim());
        }
      }

      // 4. Öğrenci satırlarını eşleştir (Format A: "1  22  Ad Soyad  Erkek/Kız")
      let match = line.match(/^\d+\s+(\d+)\s+(.+?)\s+(Erkek|Kız)/i);
      if (match) {
        students.push({
          number: match[1],
          name: match[2].trim(),
          gender: match[3],
          className: pageClassName
        });
        continue;
      }

      // Format B: E-Okul tablo düzeni ("22 S*** ErkekÜ***1")
      match = line.match(/^(\d+)\s+(.+?)\s+(Erkek|Kız)\s*(.+?)(\d+)$/i);
      if (match) {
        students.push({
          number: match[1],
          name: `${match[2].trim()} ${match[4].trim()}`.replace(/\s+/g, ' ').trim(),
          gender: match[3],
          className: pageClassName
        });
      }
    }

    for (const ct of pageClassTeachers) {
      registerTeacher(ct, 'Sınıf Öğretmeni', 'Sınıf Rehberliği', pageClassName);
    }
    for (const vp of pageVicePrincipals) {
      registerTeacher(vp, 'Müdür Yardımcısı', 'İdare', pageClassName);
    }
  }

  return {
    students,
    teachers: Array.from(teachersMap.values())
  };
}

export async function parseTeacherSchedule(buffer: Buffer): Promise<Teacher[]> {
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: false });
  const pages: string[] = Array.isArray(text) ? text : [text || ''];
  const teachersMap = new Map<string, Teacher>();

  for (const pageText of pages) {
    const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);
    let teacherName = "";
    let branch = "";
    const classes = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 1. Öğretmen Adı ve Branşını yakalama (Tüm E-Okul formatları)
      if (/Adı\s*Soyadı\s*:/i.test(line)) {
        const nameMatch = line.match(/Adı\s*Soyadı\s*:\s*(.+?)(?:\s*\d{4}\s*[-/]\s*\d{4}|\s*[I12]+\.\s*Dönem|\s*Branşı\s*:|\s*Görev|$)/i);
        if (nameMatch && nameMatch[1].trim()) {
          teacherName = nameMatch[1].trim();
        }
      }

      if (/Branşı\s*:/i.test(line)) {
        const branchMatch = line.match(/Branşı\s*:\s*(.+?)(?:\s*Öğretmen|\s*Adı\s*Soyadı|\s*\d{4}\s*[-/]\s*\d{4}|$)/i);
        if (branchMatch && branchMatch[1].trim()) {
          branch = branchMatch[1].trim();
        }
      }

      // 2. Sınıf / Şube satırlarını yakalama
      // Durum A: "<->" ve "Şubesi" aynı satırda ise (Örn: "MATEMATİK <-> 9. Sınıf / A Şubesi")
      if (line.includes('<->') && line.includes('Şubesi')) {
        const parts = line.split('<->');
        if (parts.length > 1) {
          const cleanClass = parts[1].replace(/\s+/g, ' ').trim();
          if (cleanClass) classes.add(cleanClass);
        }
        continue;
      }

      // Durum B: "Şubesi" alt satıra taşmışsa (Örn: Üst satır: "BEDEN EĞİTİMİ <-> ÖEİU - 12. Sınıf", Alt satır: "Orta-Ağır Zihinsel / A Şubesi")
      if (line.includes('Şubesi') && !line.includes('Sınıf Listesi')) {
        let cleanClass = line.replace(/\s+/g, ' ').trim();
        if (i > 0) {
          const prev = lines[i - 1];
          if (prev.includes('<->')) {
            const parts = prev.split('<->');
            if (parts.length > 1) {
              const prefix = parts[1].trim();
              cleanClass = `${prefix} ${cleanClass}`.replace(/\s+/g, ' ').trim();
            }
          } else if (prev.includes('Sınıf') && !prev.includes('Şubesi')) {
            cleanClass = `${prev.trim()} ${cleanClass}`.replace(/\s+/g, ' ').trim();
          }
        }
        if (cleanClass) classes.add(cleanClass);
      }
    }

    if (teacherName) {
      const mapKey = slugifyTr(teacherName);
      const normBranch = slugifyTr(branch);
      // Özel Eğitim okullarında bir sınıfta iki Özel Eğitim sınıf öğretmeni olabildiği için,
      // Branşı "Özel Eğitim" veya "Sınıf Öğretmenliği" olan öğretmenler de Sınıf Öğretmeni yetkisi alır:
      const inferredRole = (normBranch.includes('ozelegitim') || normBranch.includes('sinifogretmen'))
        ? 'Sınıf Öğretmeni'
        : 'Ders Öğretmeni';

      if (teachersMap.has(mapKey)) {
        const existing = teachersMap.get(mapKey)!;
        existing.classes = deduplicateClasses([...existing.classes, ...Array.from(classes)]);
        if (branch && !existing.branch) existing.branch = branch;
        if (inferredRole === 'Sınıf Öğretmeni' && existing.role === 'Ders Öğretmeni') {
          existing.role = 'Sınıf Öğretmeni';
        }
      } else {
        teachersMap.set(
          mapKey,
          createTeacherCredentials(teacherName, inferredRole, branch, deduplicateClasses(Array.from(classes)))
        );
      }
    }
  }

  return Array.from(teachersMap.values());
}
