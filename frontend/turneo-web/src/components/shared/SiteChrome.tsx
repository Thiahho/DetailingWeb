"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/src/components/shared/Navbar";
import CookieConsent from "@/src/components/shared/CookieConsent";

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

// El back-office (admin/profesional) queda afuera de la barra de cookies: ahí
// el consentimiento ya se dio de alta con la cuenta y la barra solo estorba
// sobre pantallas de trabajo (agenda, caja, etc.).
function isBackOffice(pathname: string) {
  return pathname.startsWith("/admin") || pathname.startsWith("/profesional") || pathname.startsWith("/platform");
}

// Pantallas del back-office sin sesión: no tienen sidebar propio (ver
// AdminLayout / ProfessionalLayout), así que conservan el Navbar del negocio
// como única forma de volver al sitio.
const PANEL_ENTRY_PATHS = ["/admin/login", "/profesional/login", "/profesional/registro"];

// El panel admin y el del profesional traen su propia navegación
// (AdminSidebar / ProfessionalSidebar: sidebar en desktop; barra superior,
// barra inferior y drawer en mobile). El Navbar del negocio es `fixed` con
// z-50 y quedaba encima: tapaba la cabecera del sidebar y, en mobile, toda la
// barra superior del panel — el menú hamburguesa visible abría el menú del
// sitio público en vez del drawer del panel.
function hasOwnPanelChrome(pathname: string) {
  const inPanel = pathname.startsWith("/admin") || pathname.startsWith("/profesional");
  return inPanel && !PANEL_ENTRY_PATHS.includes(pathname);
}

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showCookieConsent = !isBackOffice(pathname);

  if (isTurneoOwnPage(pathname) || hasOwnPanelChrome(pathname)) {
    return (
      <>
        {children}
        {showCookieConsent && <CookieConsent />}
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="pt-20">{children}</div>
      {showCookieConsent && <CookieConsent />}
    </>
  );
}
