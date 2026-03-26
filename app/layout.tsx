// app/layout.tsx
import "./globals.css";
import Navbar from "../src/components/Navbar";
import type { Metadata } from "next";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Mi Negocio";
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
    icon: "/img/logocirclew.png",
    shortcut: "/img/logocirclew.png",
    apple: "/img/logocirclew.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="scroll-smooth">
      <body className="bg-midnight antialiased text-slate-100">
        <Navbar />
        <div className="pt-20">{children}</div>
      </body>
    </html>
  );
}
