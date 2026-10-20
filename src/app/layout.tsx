import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import AIAssistantWidget from "@/components/AIAssistantWidget";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Okul Risk Haritası ve ŞÖK Sistemi | MEB Uyumlu E-Tablo Otomasyonu",
    template: "%s | Okul Risk Haritası ve ŞÖK Sistemi"
  },
  other: {
    "google-adsense-account": "ca-pub-6640600529852358"
  },
  description: "MEB Özel Eğitim ve Rehberlik Hizmetleri Genel Müdürlüğü (ÖRGM) ve RAM standartlarına tam uyumlu Okul Risk Haritası ve ŞÖK (Şube Öğretmenler Kurulu) otomasyonu. Verileriniz kendi Google Drive E-Tablonuzda %100 KVKK uyumlu olarak saklanır.",
  keywords: [
    "okul risk haritası",
    "sınıf risk haritası",
    "şök",
    "şube öğretmenler kurulu",
    "meb risk haritası",
    "örgmeb",
    "ram risk haritası",
    "rehberlik servisi",
    "pdr okul risk haritası",
    "e-okul risk haritası",
    "okul risk haritası excel",
    "meb rehberlik formları",
    "okul risk haritası otomasyonu",
    "öğrenci risk faktörleri",
    "36 risk faktörü meb"
  ],
  authors: [{ name: "Okul Risk Haritası Ekibi" }],
  creator: "Okul Risk Haritası ve ŞÖK Sistemi",
  publisher: "MEB Uyumlu Eğitim Çözümleri",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "https://risk.onlinepdr.com",
    title: "Okul Risk Haritası ve ŞÖK Sistemi | MEB Uyumlu E-Tablo Otomasyonu",
    description: "MEB ve RAM standartlarına tam uyumlu, sunucusuz ve %100 güvenli Google Drive tabanlı Okul Risk Haritası ve ŞÖK yönetim platformu.",
    siteName: "Okul Risk Haritası ve ŞÖK Sistemi",
  },
  twitter: {
    card: "summary_large_image",
    title: "Okul Risk Haritası ve ŞÖK Sistemi",
    description: "MEB ve RAM uyumlu, Google Drive üzerinde çalışan Okul Risk Haritası otomasyonu.",
  },
  alternates: {
    canonical: "https://risk.onlinepdr.com",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-XVH8NX75JE" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-XVH8NX75JE');
            `,
          }}
        />
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-PFZ4T344');`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-PFZ4T344"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',
              color: '#fff',
              fontSize: '14px',
              borderRadius: '12px',
              padding: '12px 16px',
            },
          }}
        />
        {children}
        <AIAssistantWidget />
      </body>
    </html>
  );
}
