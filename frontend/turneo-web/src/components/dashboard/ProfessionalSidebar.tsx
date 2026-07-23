"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LogOut } from "lucide-react";
import { getSiteConfig } from "@/src/lib/siteConfig";

const navItems = [
  { href: "/profesional/agenda", label: "Mi Agenda", icon: CalendarDays },
];

export default function ProfessionalSidebar() {
  const pathname = usePathname();
  const [logoUrl, setLogoUrl] = useState("/img/logo.png");

  useEffect(() => {
    getSiteConfig().then((config) => { if (config.logoUrl) setLogoUrl(config.logoUrl); });
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

        <div className="px-3 py-4 border-t border-mauve/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600/70 hover:text-red-600 hover:bg-red-500/10 transition-all w-full"
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
        <button
          onClick={handleLogout}
          className="p-2 text-charcoal/60 hover:text-red-600 transition"
          aria-label="Cerrar sesión"
        >
          <LogOut size={20} />
        </button>
      </header>
    </>
  );
}
