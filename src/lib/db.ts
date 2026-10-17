import { db } from './firebase';
import { doc, setDoc, getDoc, collection, getDocs, query, limit, deleteDoc, deleteField } from 'firebase/firestore';

// 10 dakikalık bellek içi önbellek (In-Memory Cache) — Firestore okuma kotasını %95+ oranında korur
const SCHOOL_CACHE_TTL_MS = 10 * 60 * 1000; // 10 dakika
const schoolDataCache = new Map<string, { data: any; expiresAt: number }>();

function getCachedSchool(key: string): any | null {
  const entry = schoolDataCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    schoolDataCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedSchool(key: string, data: any) {
  if (!data) return;
  // Bellek şişmesini önlemek için maksimum 5.000 okul önbellekte tutulur
  if (schoolDataCache.size > 5000) {
    const firstKey = schoolDataCache.keys().next().value;
    if (firstKey) schoolDataCache.delete(firstKey);
  }
  schoolDataCache.set(key, {
    data,
    expiresAt: Date.now() + SCHOOL_CACHE_TTL_MS
  });
}

export function invalidateSchoolCache(schoolKey?: string) {
  if (schoolKey) {
    schoolDataCache.delete(String(schoolKey).trim());
  }
  schoolDataCache.delete('__DEFAULT__');
}

export const saveSchoolData = async (
  adminUid: string, 
  data: { 
    spreadsheetId: string; 
    accessToken?: string; 
    spreadsheetUrl?: string;
    schoolName?: string;
    schoolKey?: string; // MEBBIS Kurum Kodu
    serviceAccountKey?: string | object;
    academicYear?: string;
    district?: string;
    adminEmail?: string;
  }
) => {
  try {
    const cleanKey = String(data.schoolKey || 'DEFAULT').trim();
    const cleanData: Record<string, any> = {
      adminUid,
      schoolKey: cleanKey,
      spreadsheetId: data.spreadsheetId,
      updatedAt: new Date().toISOString(),
      // Öğretmen ve öğrenci listeleri / şifreleri Firestore kotasını doldurmamak için ASLA Firestore'da tutulmaz, yalnızca E-Tabloda barınır:
      teachers: deleteField(),
      students: deleteField()
    };
    if (data.adminEmail) cleanData.adminEmail = data.adminEmail;
    if (data.accessToken) cleanData.accessToken = data.accessToken;
    if (data.schoolName) cleanData.schoolName = data.schoolName;
    if (data.district) cleanData.district = data.district;
    if (data.academicYear) cleanData.academicYear = data.academicYear;
    if (data.serviceAccountKey) {
      cleanData.serviceAccountKey = typeof data.serviceAccountKey === 'string' 
        ? data.serviceAccountKey 
        : JSON.stringify(data.serviceAccountKey);
    }
    if (data.spreadsheetUrl) {
      cleanData.spreadsheetUrl = data.spreadsheetUrl;
    } else {
      cleanData.spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}`;
    }

    // 1. schools_by_key/{schoolKey}: Her okul kendi kurum kodu ile tekil olarak saklanır
    // 2. Yöneticinin altındaki okullar listesi: users/{adminUid}/schools/{schoolKey}
    const updates = [
      setDoc(doc(db, 'schools_by_key', cleanKey), cleanData, { merge: true }),
      setDoc(doc(db, 'users', adminUid, 'schools', cleanKey), cleanData, { merge: true })
    ];

    await Promise.all(updates);

    // Önbelleği anında temizle ki yeni ayarlar beklemeden devreye girsin
    invalidateSchoolCache(cleanKey);

    return true;
  } catch (error) {
    console.error("Error saving school data:", error);
    return false;
  }
};

export const getSchoolsByAdmin = async (adminUid: string) => {
  try {
    const colRef = collection(db, 'users', adminUid, 'schools');
    const snap = await getDocs(colRef);
    const schools: any[] = [];
    snap.forEach(d => {
      schools.push(d.data());
    });
    // Eğer users subcollection'da yoksa eski schools/{adminUid}'ye bak
    if (schools.length === 0) {
      const oldDoc = await getDoc(doc(db, 'schools', adminUid));
      if (oldDoc.exists() && oldDoc.data()?.spreadsheetId) {
        schools.push(oldDoc.data());
      }
    }
    return schools;
  } catch (error) {
    console.error("Error getting schools by admin:", error);
    return [];
  }
};

export const getSchoolData = async (adminUid: string, schoolKey?: string) => {
  try {
    if (schoolKey) {
      const cleanKey = String(schoolKey).trim();
      const cached = getCachedSchool(cleanKey);
      if (cached && (!cached.adminUid || cached.adminUid === adminUid)) {
        return cached;
      }

      const userSchoolRef = doc(db, 'users', adminUid, 'schools', cleanKey);
      const userSchoolSnap = await getDoc(userSchoolRef);
      if (userSchoolSnap.exists()) {
        const data = userSchoolSnap.data();
        setCachedSchool(cleanKey, data);
        return data;
      }

      const docRef = doc(db, 'schools_by_key', cleanKey);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCachedSchool(cleanKey, data);
        return data;
      }
      return null;
    }
    const docRef = doc(db, 'schools', adminUid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error getting school data:", error);
    return null;
  }
};

export const getSchoolByKey = async (schoolKey: string) => {
  try {
    const cleanKey = String(schoolKey).trim();
    if (!cleanKey) return null;

    const cached = getCachedSchool(cleanKey);
    if (cached) return cached;

    const docRef = doc(db, 'schools_by_key', cleanKey);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      setCachedSchool(cleanKey, data);
      return data;
    }
    return null;
  } catch (error) {
    console.error("Error getting school by key:", error);
    return null;
  }
};

export const getLatestSchoolData = async (schoolKey?: string) => {
  try {
    if (schoolKey) {
      const byKey = await getSchoolByKey(schoolKey);
      if (byKey) return byKey;
    }

    const cachedDefault = getCachedSchool('__DEFAULT__');
    if (cachedDefault) return cachedDefault;

    // 1. Sabit aktif okul kaydına bak
    const activeDoc = await getDoc(doc(db, 'schools', 'active_school'));
    if (activeDoc.exists() && activeDoc.data()?.spreadsheetId) {
      const data = activeDoc.data();
      setCachedSchool('__DEFAULT__', data);
      return data;
    }
    // 2. Yoksa schools koleksiyonundaki herhangi bir kayda bak
    const q = query(collection(db, 'schools'), limit(5));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data();
      if (data && data.spreadsheetId) {
        setCachedSchool('__DEFAULT__', data);
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error("Error getting latest school data:", error);
    return null;
  }
};

/**
 * E-posta adresini maskeler: "ab***@gm***.com" formatında
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.***';
  const [user, domain] = email.split('@');
  const maskedUser = user.length <= 2 
    ? user[0] + '***' 
    : user.slice(0, 2) + '***';

  const domainParts = domain.split('.');
  const provider = domainParts[0] || '';
  const ext = domainParts.slice(1).join('.');

  const maskedProvider = provider.length <= 2 
    ? provider[0] + '***' 
    : provider.slice(0, 2) + '***';

  return `${maskedUser}@${maskedProvider}${ext ? '.' + ext : ''}`;
}

/**
 * MEBBİS Kurum kodunun başka bir yönetici tarafından sahiplenilip sahiplenilmediğini denetler.
 * Aynı kurum kodu ile başka bir e-posta kayıt açmaya çalışırsa engeller.
 */
export const checkSchoolKeyOwnership = async (schoolKey: string, currentUid: string) => {
  try {
    const cleanKey = String(schoolKey).trim();
    if (!cleanKey) return { isAvailable: true };

    const docRef = doc(db, 'schools_by_key', cleanKey);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Eğer kayıt bu kullanıcıya ait değilse
      if (data.adminUid && data.adminUid !== currentUid) {
        return {
          isAvailable: false,
          ownerEmailMasked: maskEmail(data.adminEmail || ''),
          ownerEmailRaw: data.adminEmail || '',
          ownerUid: data.adminUid,
          schoolName: data.schoolName || '',
          spreadsheetId: data.spreadsheetId || ''
        };
      }
    }

    return { isAvailable: true };
  } catch (error) {
    console.error("Kurum kodu sahiplik kontrolü hatası:", error);
    return { isAvailable: true };
  }
};

/**
 * 6 haneli transfer doğrulama kodunu kaydeder (15 dakika geçerli)
 */
export const saveTransferVerificationCode = async (
  schoolKey: string,
  code: string,
  requestedByUid: string,
  requestedByEmail: string
) => {
  try {
    const cleanKey = String(schoolKey).trim();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 dakika

    await setDoc(doc(db, 'school_transfers', cleanKey), {
      schoolKey: cleanKey,
      code,
      requestedByUid,
      requestedByEmail,
      expiresAt,
      createdAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error("Transfer kodu kaydetme hatası:", error);
    return false;
  }
};

/**
 * 6 haneli transfer kodunu doğrular ve mülkiyeti yeni yöneticiye aktarır
 */
export const verifyAndExecuteTransfer = async (
  schoolKey: string,
  inputCode: string,
  newAdminUid: string,
  newAdminEmail: string,
  newAccessToken?: string
) => {
  try {
    const cleanKey = String(schoolKey).trim();
    const transferRef = doc(db, 'school_transfers', cleanKey);
    const transferSnap = await getDoc(transferRef);

    if (!transferSnap.exists()) {
      return { success: false, error: 'Doğrulama talebi bulunamadı veya süresi dolmuş.' };
    }

    const tData = transferSnap.data();
    if (Date.now() > tData.expiresAt) {
      await deleteDoc(transferRef);
      return { success: false, error: 'Doğrulama kodunun 15 dakikalık süresi dolmuştur. Lütfen yeni kod isteyiniz.' };
    }

    if (String(tData.code).trim() !== String(inputCode).trim()) {
      return { success: false, error: 'Girdiğiniz doğrulama kodu hatalıdır.' };
    }

    // Mevcut okul kaydını al
    const schoolRef = doc(db, 'schools_by_key', cleanKey);
    const schoolSnap = await getDoc(schoolRef);
    const oldSchoolData = schoolSnap.exists() ? schoolSnap.data() : null;
    const oldAdminUid = oldSchoolData?.adminUid;
    const oldAdminEmail = oldSchoolData?.adminEmail || '';

    const updatedSchoolData: Record<string, any> = {
      ...(oldSchoolData || {}),
      adminUid: newAdminUid,
      adminEmail: newAdminEmail,
      schoolKey: cleanKey,
      transferredAt: new Date().toISOString(),
      previousAdminEmailMasked: maskEmail(oldAdminEmail),
      teachers: deleteField(),
      students: deleteField()
    };

    if (newAccessToken) {
      updatedSchoolData.accessToken = newAccessToken;
    }

    // 1. schools_by_key güncelle
    await setDoc(schoolRef, updatedSchoolData, { merge: true });

    // 2. Yeni yöneticinin altına ekle
    await setDoc(doc(db, 'users', newAdminUid, 'schools', cleanKey), updatedSchoolData, { merge: true });

    // 3. Eski yöneticinin listesinden bu okulu kaldır
    if (oldAdminUid && oldAdminUid !== newAdminUid) {
      await deleteDoc(doc(db, 'users', oldAdminUid, 'schools', cleanKey));
      
      // Eski yönetici için bilgilendirme kaydı oluştur (Eski yönetici girdiğinde uyarı göstermek için)
      await setDoc(doc(db, 'transfer_notifications', `${oldAdminUid}_${cleanKey}`), {
        schoolKey: cleanKey,
        schoolName: oldSchoolData?.schoolName || '',
        newOwnerEmailMasked: maskEmail(newAdminEmail),
        transferredAt: new Date().toISOString(),
        viewed: false
      });
    }

    // Kullanılan transfer talebini sil ve önbelleği temizle
    await deleteDoc(transferRef);
    invalidateSchoolCache(cleanKey);

    return { 
      success: true, 
      oldSpreadsheetId: oldSchoolData?.spreadsheetId || '',
      oldAccessToken: oldSchoolData?.accessToken || '',
      schoolName: oldSchoolData?.schoolName || ''
    };
  } catch (error: any) {
    console.error("Transfer tamamlama hatası:", error);
    return { success: false, error: error.message || 'Transfer gerçekleştirilemedi.' };
  }
};

/**
 * Eski yönetici için devir bildirimini sorgular
 */
export const checkTransferNotification = async (adminUid: string) => {
  try {
    const colRef = collection(db, 'transfer_notifications');
    const snap = await getDocs(colRef);
    const notes: any[] = [];
    for (const d of snap.docs) {
      if (d.id.startsWith(`${adminUid}_`)) {
        notes.push({ id: d.id, ...d.data() });
      }
    }
    return notes;
  } catch (e) {
    return [];
  }
};

export const dismissTransferNotification = async (docId: string) => {
  try {
    await deleteDoc(doc(db, 'transfer_notifications', docId));
  } catch (e) {}
};

