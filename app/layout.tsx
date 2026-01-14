// app/layout.tsx
import "./globals.css"; // Ruta corregida para Vercel
import Navbar from "../src/components/Navbar";

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
