// app/layout.tsx
import "./globals.css"; // Ruta corregida para Vercel
import Navbar from "../src/components/Navbar";
import type { Metadata } from "next";

const siteUrl = "https://detailing-web-five.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Detailing Cars",
    template: "%s | Detailing Cars",
  },
  description:
    "Servicios profesionales de detailing automotriz en Moreno, Zona Oeste. Turnos rápidos, protección cerámica, PPF y limpieza premium.",
  alternates: {
    canonical: siteUrl,
  },
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
  authors: [{ name: "Detailing Cars", url: siteUrl }],
  publisher: "Detailing Cars",
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Detailing Cars",
    description:
      "Servicios profesionales de detailing automotriz en Moreno, Zona Oeste. Turnos rápidos, protección cerámica, PPF y limpieza premium.",
    siteName: "Detailing Cars",
    locale: "es_AR",
    images: [
      {
        url: "/img/og.jpg",
        width: 1200,
        height: 630,
        alt: "Detailing Cars - Detailing premium en Zona Oeste",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Detailing Cars",
    description:
      "Servicios profesionales de detailing automotriz en Moreno, Zona Oeste. Turnos rápidos, protección cerámica, PPF y limpieza premium.",
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
        {/* El pt-20 evita que el contenido quede oculto bajo el navbar fijo */}
        <div className="pt-20">{children}</div>
      </body>
    </html>
  );
}
