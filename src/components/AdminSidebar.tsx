"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays, BarChart2, Wrench, LogOut,
  List, LayoutDashboard, Menu, X, ClipboardList, KeyRound, Clapperboard, Image, Users, UserCog,
} from "lucide-react";

const navItems = [
  { href: "/admin",             label: "Panel",      icon: LayoutDashboard },
  { href: "/admin/turnos",      label: "Turnos",     icon: List },
  { href: "/admin/calendario",  label: "Calendario", icon: CalendarDays },
  { href: "/admin/historial",   label: "Historial",  icon: ClipboardList },
  { href: "/admin/clientes",    label: "Clientes",   icon: Users },
  { href: "/admin/profesionales",label: "Equipo",    icon: UserCog },
  { href: "/admin/servicios",   label: "Servicios",  icon: Wrench },
  { href: "/admin/galeria",     label: "Galería",    icon: Image },
  { href: "/admin/contenido",   label: "Contenido",  icon: Clapperboard },
  { href: "/admin/estadisticas",label: "Stats",      icon: BarChart2 },
  { href: "/admin/cuenta",      label: "Cuenta",     icon: KeyRound },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    const { logout } = await import("../lib/auth");
    await logout();
  };

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href;

  return (
    <>
      {/* ════════════════════════════════════
          DESKTOP — sidebar fijo a la izquierda
          ════════════════════════════════════ */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-56 bg-[#0d1117] border-r border-white/5 flex-col z-40">
        <div className="px-5 py-6 border-b border-white/5">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full overflow-hidden border border-white/10">
              <img src="/img/logow.png" alt="Logo" className="h-full w-full object-cover" />
            </div>
            <span className="text-white text-sm font-semibold">Panel Admin</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive(href)
                  ? "bg-white/10 text-white font-medium"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={17} />
              {label === "Stats" ? "Estadísticas" : label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all w-full"
          >
            <LogOut size={17} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════
          MOBILE — top bar
          ════════════════════════════════════ */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#0d1117] border-b border-white/5 z-40 flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full overflow-hidden border border-white/10">
            <img src="/img/logow.png" alt="Logo" className="h-full w-full object-cover" />
          </div>
          <span className="text-white text-sm font-semibold">Panel Admin</span>
        </Link>
        <button
          onClick={() => setMenuOpen(true)}
          className="p-2 text-white/60 hover:text-white transition"
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* ════════════════════════════════════
          MOBILE — bottom tab bar (siempre visible)
          ════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0d1117] border-t border-white/5 z-40">
        <div
          className="grid h-14"
          style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
        >
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 transition-all ${
                  active ? "text-white" : "text-white/30 hover:text-white/60"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                <span className="text-[9px] font-medium leading-none">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ════════════════════════════════════
          MOBILE — drawer (para logout y extras)
          ════════════════════════════════════ */}
      {menuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-50"
            onClick={() => setMenuOpen(false)}
          />
          <div className="md:hidden fixed left-0 top-0 h-full w-64 bg-[#0d1117] border-r border-white/5 z-50 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <span className="text-white font-semibold text-sm">Menú</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-1.5 text-white/40 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isActive(href)
                      ? "bg-white/10 text-white font-medium"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon size={17} />
                  {label === "Stats" ? "Estadísticas" : label}
                </Link>
              ))}
            </nav>

            <div className="px-3 py-4 border-t border-white/5">
              <button
                onClick={() => { setMenuOpen(false); handleLogout(); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all w-full"
              >
                <LogOut size={17} />
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
