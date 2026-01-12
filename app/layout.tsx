import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Detailing premium en Zona Oeste | Moreno",
  description:
    "Detailing premium con resultados visibles. Cerámico, PPF y limpieza profunda con turnos rápidos por WhatsApp.",
  metadataBase: new URL("https://detailing-zonaoeste.example"),
  openGraph: {
    title: "Detailing premium en Zona Oeste",
    description: "Antes y después reales. Protección cerámica, PPF y turnos rápidos.",
    url: "https://detailing-zonaoeste.example",
    siteName: "Detailing Zona Oeste",
    locale: "es_AR",
    type: "website"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
