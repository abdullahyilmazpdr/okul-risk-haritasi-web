import { extractText } from 'unpdf';

export interface Student {
  number: string;
  name: string;
  gender: string;
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
function slugifyTr(text: string): string {
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

// Öğretmen için kullanıcı adı ve WhatsApp bağlantısı oluşturucu
export function createTeacherCredentials(name: string, role?: string, branch?: string, classes: string[] = []): Teacher {
  // İsimden temiz ve anlamlı kullanıcı adı üret (örn: ahmet.yilmaz.742 veya ogretmen.8412)
  const cleanName = slugifyTr(name);
  const baseName = cleanName.length >= 4 ? cleanName : `ogretmen${cleanName}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4 haneli sayı
  const username = `${baseName}${randomSuffix}`;
  const password = generatePassword(); // 8 karakterli şifre
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://okulrisk.vercel.app';
  
  const roleText = role ? ` (${role})` : '';
  const waMessage = encodeURIComponent(
    `Sayın ${name}${roleText}, Okul Risk Haritası ve ŞÖK sistemine giriş bilgileriniz:\n\n` +
    `URL: ${siteUrl}\n` +
    `Kullanıcı Adı: ${username}\n` +
    `Şifre: ${password}\n\n` +
    `Lütfen sisteme giriş yaparak işlemlerinizi tamamlayınız.`
  );

  return {
    name,
    role,
    branch,
    classes,
    username,
    password,
    whatsappLink: `https://wa.me/?text=${waMessage}`
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

  for (const pageText of pages) {
    const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);
    let pageClassName = "Bilinmeyen Sınıf";
    let pageClassTeacher = "";
    let pageVicePrincipal = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 1. Sınıf adını başlıktan bul (Örn: "ÖEİU - 9. Sınıf Orta-Ağır Zihinsel / A Şubesi (ORTA AĞIR ZİHİNSEL ENGELLİLER) Sınıf Listesi")
      if (line.includes('Şubesi') && (line.includes('Sınıf Listesi') || line.includes('Sınıf'))) {
        pageClassName = line.replace(/Sınıf Listesi.*$/i, '').trim();
      } else if (line.includes('Sınıf') && line.includes('Şubesi') && !line.includes('Öğretmeni')) {
        pageClassName = line.trim();
      }

      // 2. Sınıf Öğretmenini bul (Örn: "Sınıf Öğretmeni: İ*** Ö***" veya "Sınıf Öğretmeni : İ*** Ö***")
      if (/Sınıf\s+Öğretmeni\s*:/i.test(line)) {
        const m = line.match(/Sınıf\s+Öğretmeni\s*:\s*([^:]+?)(?:\s+Sınıf\s+Müdür|\s+Müdür|$)/i);
        if (m && m[1].trim()) {
          pageClassTeacher = m[1].trim();
        } else {
          const directMatch = line.match(/Sınıf\s+Öğretmeni\s*:\s*(.+)$/i);
          if (directMatch) pageClassTeacher = directMatch[1].trim();
        }
      }

      // 3. Sınıf Müdür Yardımcısını bul (Örn: "Sınıf Müdür Yrd: İ*** A*** Sınıf Başkan Yrd:")
      if (/Sınıf\s+Müdür\s+Yrd\s*:/i.test(line)) {
        const m = line.match(/Sınıf\s+Müdür\s+Yrd\s*:\s*(.+?)(?:\s+Sınıf\s+Başkan|\s+Başkan|$)/i);
        if (m && m[1].trim()) {
          pageVicePrincipal = m[1].trim();
        }
      }

      // 4. Öğrenci satırlarını eşleştir (1  123  Ad Soyad  Erkek/Kız)
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

      // Alternatif E-Okul tablo düzeni (123  Ad  Erkek/Kız  Soyad  ...)
      match = line.match(/^(\d+)\s+(.+?)\s+(Erkek|Kız)(.+?)(\d+)$/i);
      if (match) {
        students.push({
          number: match[1],
          name: `${match[2].trim()} ${match[4].trim()}`,
          gender: match[3],
          className: pageClassName
        });
      }
    }

    // Bu sayfada tespit edilen Sınıf Öğretmenini kaydet
    if (pageClassTeacher && !pageClassTeacher.toLowerCase().includes('bulunamadı')) {
      if (teachersMap.has(pageClassTeacher)) {
        const existing = teachersMap.get(pageClassTeacher)!;
        existing.classes = Array.from(new Set([...existing.classes, pageClassName]));
      } else {
        teachersMap.set(pageClassTeacher, createTeacherCredentials(pageClassTeacher, 'Sınıf Öğretmeni', 'Sınıf Rehberliği', [pageClassName]));
      }
    }

    // Bu sayfada tespit edilen Müdür Yardımcısını kaydet
    if (pageVicePrincipal && !pageVicePrincipal.toLowerCase().includes('bulunamadı')) {
      if (teachersMap.has(pageVicePrincipal)) {
        const existing = teachersMap.get(pageVicePrincipal)!;
        existing.classes = Array.from(new Set([...existing.classes, pageClassName]));
      } else {
        teachersMap.set(pageVicePrincipal, createTeacherCredentials(pageVicePrincipal, 'Müdür Yardımcısı', 'İdare', [pageClassName]));
      }
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

      // Öğretmen Adı ve Branşını yakalama (Çoklu format desteği)
      if (line.includes('Öğretmen Adı Soyadı:') || /Öğretmen\s*Adı\s*Soyadı\s*:/i.test(line)) {
        // Format 1: "Öğretmen Adı Soyadı: E*** K***2026-2027 I. Dönem Branşı: Beden Eğitimi"
        const nameMatch = line.match(/Adı\s*Soyadı\s*:\s*(.*?)(?:\s*\d{4}-\d{4}|\s*Branşı\s*:|$)/i);
        const branchMatch = line.match(/Branşı\s*:\s*(.*)$/i);

        if (nameMatch && nameMatch[1].trim()) teacherName = nameMatch[1].trim();
        if (branchMatch && branchMatch[1].trim()) branch = branchMatch[1].trim();
      } else if (/Adı\s*Soyadı\s*:/i.test(line) && !teacherName) {
        const m = line.match(/Adı\s*Soyadı\s*:\s*([^:]+?)(?:\s*Branşı|$)/i);
        if (m && m[1].trim()) teacherName = m[1].trim();
      }

      if (/Branşı\s*:/i.test(line) && !branch) {
        const bm = line.match(/Branşı\s*:\s*(.+)$/i);
        if (bm && bm[1].trim()) branch = bm[1].trim();
      }

      // Sınıf / Şube satırlarını yakalama
      if (line.includes('Şubesi')) {
        let cleanClass = line.replace(/\s+/g, ' ').trim();
        // Eğer bir önceki satırda "BEDEN EĞİTİMİ <-> ÖEİU - 12. Sınıf" gibi ders ve sınıf kökü varsa
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
        classes.add(cleanClass);
      }
    }

    if (teacherName) {
      if (teachersMap.has(teacherName)) {
        const existing = teachersMap.get(teacherName)!;
        existing.classes = Array.from(new Set([...existing.classes, ...Array.from(classes)]));
        if (branch && !existing.branch) existing.branch = branch;
      } else {
        teachersMap.set(teacherName, createTeacherCredentials(teacherName, 'Ders Öğretmeni', branch, Array.from(classes)));
      }
    }
  }

  return Array.from(teachersMap.values());
}
