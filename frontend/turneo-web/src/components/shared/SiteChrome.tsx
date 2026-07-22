"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/src/components/shared/Navbar";

// La home comercial de Turneo ("/") no lleva el Navbar del negocio (ese es
// el logo/nombre del tenant y sus anchors a Servicios/Trabajos) — vive fuera
// de app/layout.tsx (Server Component, no puede usar usePathname porque
// exporta metadata) para poder decidir esto por ruta.
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/") {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <div className="pt-20">{children}</div>
    </>
  );
}
