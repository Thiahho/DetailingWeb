"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/src/components/shared/Navbar";

// Las páginas comerciales de Turneo ("/" y "/ruleta") no llevan el Navbar del
// negocio (ese es el logo/nombre del tenant y sus anchors a Servicios/Trabajos)
// — vive fuera de app/layout.tsx (Server Component, no puede usar usePathname
// porque exporta metadata) para poder decidir esto por ruta.
const TURNEO_COMERCIAL_PATHS = ["/", "/ruleta"];

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (TURNEO_COMERCIAL_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <div className="pt-20">{children}</div>
    </>
  );
}
