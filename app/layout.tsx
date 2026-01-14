// app/layout.tsx
import "./globals.css"; // Verifica que globals.css esté en la carpeta /app
import Navbar from "../src/components/Navbar"; // Ruta según tu estructura

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="scroll-smooth">
      <body className="bg-midnight antialiased text-slate-100">
        <Navbar />
        {/* Agregamos un margen superior para que el contenido no quede bajo el Navbar fijo */}
        <div className="pt-2">{children}</div>
      </body>
    </html>
  );
}
