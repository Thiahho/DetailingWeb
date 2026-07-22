"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/src/components/shared/Navbar";

// Las páginas de Turneo mismo (marketing "/", "/ruleta", y el panel interno
// "/platform/*") no llevan el Navbar del negocio (ese es el logo/nombre del
// tenant y sus anchors a Servicios/Trabajos) — vive fuera de app/layout.tsx
// (Server Component, no puede usar usePathname porque exporta metadata) para
// poder decidir esto por ruta. PlatformLayout ya pone su propio fondo/guard;
// sin este chequeo el Navbar del negocio quedaba flotando arriba de ese panel.
const TURNEO_COMERCIAL_PATHS = ["/", "/ruleta"];

function isTurneoOwnPage(pathname: string) {
  return TURNEO_COMERCIAL_PATHS.includes(pathname) || pathname.startsWith("/platform");
}

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isTurneoOwnPage(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <div className="pt-20">{children}</div>
    </>
  );
}
