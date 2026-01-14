// Si el archivo está en la misma carpeta que el layout:
import "./globals.css";

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
        <div className="pt-20">{children}</div>
      </body>
    </html>
  );
}
