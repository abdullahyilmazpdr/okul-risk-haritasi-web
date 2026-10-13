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
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  const lines = (text || '').split('\n').map(line => line.trim()).filter(Boolean);
  
  const students: Student[] = [];
  let className = "Bilinmeyen Sınıf";
  let classTeacherName = "";
  let vicePrincipalName = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 1. Sınıf adını başlıktan bul
    if (line.includes('Şubesi') && line.includes('Sınıf Listesi')) {
      className = line.replace(/Sınıf Listesi.*$/i, '').trim();
    } else if (line.includes('Sınıf') && line.includes('Şubesi') && !line.includes('Öğretmeni')) {
      className = line.trim();
    }

    // 2. Sınıf Öğretmenini bul (Örn: "Sınıf Öğretmeni: İ*** Ö***")
    if (line.includes('Sınıf Öğretmeni:')) {
      const match = line.match(/Sınıf Öğretmeni:\s*(.+)$/i);
      if (match) {
        classTeacherName = match[1].trim();
      }
    }

    // 3. Sınıf Müdür Yardımcısını bul (Örn: "Sınıf Müdür Yrd: İ*** A*** Sınıf Başkan Yrd:")
    if (line.includes('Sınıf Müdür Yrd:')) {
      const match = line.match(/Sınıf Müdür Yrd:\s*(.+?)(?:\s+Sınıf Başkan Yrd:|$)/i);
      if (match) {
        vicePrincipalName = match[1].trim();
      }
    }
    
    // 4. Öğrenci satırlarını eşleştir
    let match = line.match(/^\d+\s+(\d+)\s+(.+?)\s+(Erkek|Kız)/i);
    if (match) {
      students.push({
        number: match[1],
        name: match[2].trim(),
        gender: match[3],
        className
      });
      continue;
    }

    match = line.match(/^(\d+)\s+(.+?)\s+(Erkek|Kız)(.+?)(\d+)$/i);
    if (match) {
      students.push({
        number: match[1],
        name: `${match[2].trim()} ${match[4].trim()}`,
        gender: match[3],
        className
      });
    }
  }

  // Ayıklanan Sınıf Öğretmeni ve Müdür Yardımcısını öğretmen listesine hazırla
  const teachers: Teacher[] = [];
  if (classTeacherName && !classTeacherName.toLowerCase().includes('bulunamadı')) {
    teachers.push(createTeacherCredentials(classTeacherName, 'Sınıf Öğretmeni', 'Sınıf Rehberliği', [className]));
  }
  if (vicePrincipalName && !vicePrincipalName.toLowerCase().includes('bulunamadı')) {
    teachers.push(createTeacherCredentials(vicePrincipalName, 'Müdür Yardımcısı', 'İdare', [className]));
  }
  
  return {
    students,
    teachers
  };
}

export async function parseTeacherSchedule(buffer: Buffer): Promise<Teacher[]> {
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  const lines = (text || '').split('\n').map(line => line.trim()).filter(Boolean);
  
  let teacherName = "";
  let branch = "";
  const classes = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('Öğretmen Adı Soyadı:')) {
      const nameMatch = line.match(/Adı Soyadı:\s*(.*?)(?:\s*\d{4}-\d{4}|\s*Branşı:)/i);
      const branchMatch = line.match(/Branşı:\s*(.*)$/i);
      
      if (nameMatch) teacherName = nameMatch[1].trim();
      if (branchMatch) branch = branchMatch[1].trim();
    }

    if (line.includes('Şubesi')) {
      let cleanClass = line.replace(/\s+/g, ' ').trim();
      if (i > 0 && lines[i-1].includes('Sınıf') && !lines[i-1].includes('Şubesi')) {
         const parts = lines[i-1].split('<->');
         if(parts.length > 1) {
            cleanClass = parts[1].trim() + " " + cleanClass;
         }
      }
      classes.add(cleanClass);
    }
  }

  if (!teacherName) {
    return [];
  }

  return [createTeacherCredentials(teacherName, 'Ders Öğretmeni', branch, Array.from(classes))];
}
