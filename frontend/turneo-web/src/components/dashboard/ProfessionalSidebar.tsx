"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, History, LayoutDashboard, LogOut, UserCog, Wallet } from "lucide-react";
import { getSiteConfig } from "@/src/lib/siteConfig";
import { isAdminAuthenticated } from "@/src/lib/auth";

const navItems = [
  { href: "/profesional/agenda", label: "Mi Agenda", shortLabel: "Agenda", icon: CalendarDays },
  { href: "/profesional/historial", label: "Historial", shortLabel: "Historial", icon: History },
  { href: "/profesional/comisiones", label: "Mis comisiones", shortLabel: "Comisiones", icon: Wallet },
  { href: "/profesional/cuenta", label: "Mi cuenta", shortLabel: "Cuenta", icon: UserCog },
];

export default function ProfessionalSidebar() {
  const pathname = usePathname();
  const [logoUrl, setLogoUrl] = useState("/img/logo.png");
  // Un profesional con permisos de panel otorgados desde Permisos (mismo login,
  // acceso extra) ve un link a /admin. Sin permisos otorgados, no aparece.
  const [hasPanelAccess, setHasPanelAccess] = useState(false);

  useEffect(() => {
    getSiteConfig().then((config) => { if (config.logoUrl) setLogoUrl(config.logoUrl); });
    setHasPanelAccess(isAdminAuthenticated());
  }, []);

  const handleLogout = async () => {
    const { logout } = await import("@/src/lib/auth");
    await logout();
  };

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* DESKTOP */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-56 bg-ivory border-r border-mauve/10 flex-col z-40">
        <div className="px-5 py-6 border-b border-mauve/10">
          <Link href="/reservar" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full overflow-hidden border border-mauve/15 bg-white">
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
            </div>
            <span className="text-charcoal text-sm font-semibold">Mi Agenda</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive(href)
                  ? "bg-blush/12 text-blushdark font-medium"
                  : "text-charcoal/50 hover:text-charcoal hover:bg-porcelain"
              }`}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-mauve/10 space-y-1">
          {hasPanelAccess && (
            <Link
              href="/admin"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-charcoal/50 hover:text-charcoal hover:bg-porcelain transition-all"
            >
              <LayoutDashboard size={17} />
              Panel
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600/70 hover:text-red-600 hover:bg-red-50 transition-all w-full"
          >
            <LogOut size={17} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* MOBILE — top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-ivory border-b border-mauve/10 z-40 flex items-center justify-between px-4">
        <Link href="/profesional/agenda" className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full overflow-hidden border border-mauve/15 bg-white">
            <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
          </div>
          <span className="text-charcoal text-sm font-semibold">Mi Agenda</span>
        </Link>
        <div className="flex items-center gap-1">
          {hasPanelAccess && (
            <Link
              href="/admin"
              className="p-2 text-charcoal/60 hover:text-charcoal transition"
              aria-label="Panel"
            >
              <LayoutDashboard size={20} />
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="p-2 text-charcoal/60 hover:text-red-600 transition"
            aria-label="Cerrar sesión"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* MOBILE — bottom tab bar: solo 4 items, entran todos sin drawer "Más" */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-ivory border-t border-mauve/10 z-40">
        <div className="grid grid-cols-4 h-14">
          {navItems.map(({ href, shortLabel, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 transition-all ${
                  active ? "text-blushdark" : "text-charcoal/30 hover:text-charcoal/60"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                <span className="text-[9px] font-medium leading-none">{shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
