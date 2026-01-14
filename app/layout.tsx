// app/layout.tsx
import Navbar from "../src/components/Navbar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="scroll-smooth">
      <body>
        <Navbar />
        {/* pt-20 para dar espacio al header fijo */}
        <div className="pt-20">{children}</div>
      </body>
    </html>
  );
}
