// app/layout.tsx
import "./globals.css";
import SiteChrome from "@/src/components/shared/SiteChrome";
import type { Metadata } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Acento itálico de los títulos del sitio público (clase .accent-serif).
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-serif",
  display: "swap",
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
