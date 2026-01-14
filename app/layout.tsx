// app/layout.tsx
import "./globals.css"; // Ruta corregida para Vercel
import Navbar from "../src/components/Navbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LK Detailing",
  description: "Servicios profesionales de detailing automotriz",
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
    <html lang="es" className="scroll-smooth">
      <body className="bg-midnight antialiased text-slate-100">
        <Navbar />
        {/* El pt-20 evita que el contenido quede oculto bajo el navbar fijo */}
        <div className="pt-20">{children}</div>
      </body>
    </html>
  );
}
