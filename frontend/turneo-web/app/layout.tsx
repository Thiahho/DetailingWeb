// app/layout.tsx
import "./globals.css";
import SiteChrome from "@/src/components/shared/SiteChrome";
import type { Metadata } from "next";
import localFont from "next/font/local";

// Las fuentes van como archivos dentro del repo (app/fonts/) y no por
// next/font/google. Con Google, el nombre de clase que genera Next sale de la
// hoja de estilos que Google devuelve en el momento del build: en un deploy de
// Vercel con caché de build, el HTML quedó con un nombre viejo y el CSS con el
// nuevo, --font-sans quedó vacía y todo el sitio cayó a Times New Roman. Con
// el archivo local el nombre depende solo de lo que está commiteado.
//
// Son los subconjuntos "latin" de Google Fonts (cubren español y el resto de
// Europa occidental), ambas con licencia SIL Open Font License.

// Plus Jakarta Sans, variable (pesos 200 a 800).
const sans = localFont({
  src: "./fonts/PlusJakartaSans-latin.woff2",
  weight: "200 800",
  style: "normal",
  variable: "--font-sans",
  display: "swap",
  adjustFontFallback: "Arial",
});

// Instrument Serif itálica: acento de los títulos del sitio público (clase .accent-serif).
const serif = localFont({
  src: "./fonts/InstrumentSerif-Italic-latin.woff2",
  weight: "400",
  style: "italic",
  variable: "--font-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Turneo";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
const metaDescription = process.env.NEXT_PUBLIC_META_DESCRIPTION || "";

export const metadata: Metadata = {
  ...(siteUrl && { metadataBase: new URL(siteUrl) }),
  title: {
    default: businessName,
    template: `%s | ${businessName}`,
  },
  description: metaDescription,
  ...(siteUrl && { alternates: { canonical: siteUrl } }),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  authors: [{ name: businessName, ...(siteUrl && { url: siteUrl }) }],
  publisher: businessName,
  openGraph: {
    type: "website",
    ...(siteUrl && { url: siteUrl }),
    title: businessName,
    description: metaDescription,
    siteName: businessName,
    locale: "es_AR",
    images: [
      {
        url: "/img/og.jpg",
        width: 1200,
        height: 630,
        alt: businessName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: businessName,
    description: metaDescription,
    images: ["/img/og.jpg"],
  },
  icons: {
    icon: "/img/logo.png",
    shortcut: "/img/logo.png",
    apple: "/img/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`scroll-smooth ${sans.variable} ${serif.variable}`}>
      <body className="bg-cream font-sans antialiased text-charcoal">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
