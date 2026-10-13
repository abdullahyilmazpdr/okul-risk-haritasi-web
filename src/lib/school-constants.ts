export interface RealStudent {
  id: string;
  number: string;
  name: string;
  gender: string;
  className: string;
  hasSok?: boolean;
  hasRiskMap?: boolean;
}

// Gerçekçi olmayan örnek veriler sıfırlandı: Sistem tamamen E-Okul'dan yüklenen gerçek verilerle çalışır
export const FALLBACK_STUDENTS: RealStudent[] = [];

export const FALLBACK_CLASSES: { id: string; name: string; shortName: string; studentCount: number }[] = [];
