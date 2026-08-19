"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSiteConfig } from "@/src/lib/siteConfig";
import { usePermissions, type PermissionModuleKey } from "@/src/hooks/usePermissions";
import {
  CalendarDays, BarChart2, Wrench, LogOut,
  List, LayoutDashboard, Menu, X, ClipboardList, KeyRound, Clapperboard, Image, Users, UserCog,
  MoreHorizontal, Building2, Package, Wallet, Zap, Boxes, ShieldCheck, Nfc, Gift, ShieldAlert,
} from "lucide-react";

// `module`: a qué PermissionModule pertenece este link — un Staff sin permiso
// de View en ese módulo no lo ve. Sin `module` = visible para cualquier rol
// que ya esté en el panel (Panel, Cuenta). `adminOnly` = fuera del sistema de
// permisos (Estadísticas/Empresa/Permisos tocan datos sensibles del negocio
// completo, no de un módulo puntual) — solo Admin real, ni con todos los
// permisos de Staff alcanza.
type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; module?: PermissionModuleKey; adminOnly?: boolean };
type NavGroup = { title: string; items: NavItem[] };

// Panel queda suelto arriba (es el home). El resto se agrupa por dominio en vez
// de una lista plana de 11 links — así se lee de un vistazo, no se escanea entero.
const topItem: NavItem = { href: "/admin", label: "Panel", icon: LayoutDashboard };

const groups: NavGroup[] = [
  {
    title: "Agenda",
    items: [
      { href: "/admin/turnos", label: "Turnos", icon: List, module: "Turnos" },
      { href: "/admin/calendario", label: "Calendario", icon: CalendarDays, module: "Turnos" },
      { href: "/admin/historial", label: "Historial", icon: ClipboardList, module: "Turnos" },
    ],
  },
  {
    title: "Negocio",
    items: [
      { href: "/admin/clientes", label: "Clientes", icon: Users, module: "Clientes" },
      { href: "/admin/solicitudes-privacidad", label: "Privacidad", icon: ShieldAlert, module: "Clientes" },
      { href: "/admin/profesionales", label: "Equipo", icon: UserCog, module: "Profesionales" },
      { href: "/admin/servicios", label: "Servicios", icon: Wrench, module: "Servicios" },
      { href: "/admin/productos", label: "Productos", icon: Package, module: "Productos" },
      { href: "/admin/insumos", label: "Insumos", icon: Boxes, module: "Insumos" },
      { href: "/admin/caja", label: "Caja", icon: Wallet, module: "Caja" },
      { href: "/admin/automatizaciones", label: "Automatizaciones", icon: Zap, module: "Automatizaciones" },
      { href: "/admin/smart-tags", label: "Smart Tags", icon: Nfc, module: "SmartTags" },
      { href: "/admin/ruleta", label: "Ruleta", icon: Gift, module: "Ruleta" },
      { href: "/admin/configuracion", label: "Empresa", icon: Building2, adminOnly: true },
    ],
  },
  {
    title: "Contenido",
    items: [
      { href: "/admin/galeria", label: "Galería", icon: Image, module: "Galeria" },
      { href: "/admin/contenido", label: "Contenido", icon: Clapperboard, module: "Contenido" },
    ],
  },
  {
    title: "Cuenta",
    items: [
      { href: "/admin/estadisticas", label: "Estadísticas", icon: BarChart2, adminOnly: true },
      { href: "/admin/permisos", label: "Permisos", icon: ShieldCheck, adminOnly: true },
      { href: "/admin/cuenta", label: "Cuenta", icon: KeyRound },
    ],
  },
];

const allItems: NavItem[] = [topItem, ...groups.flatMap((g) => g.items)];

// Los 4 de uso diario van fijos en la barra mobile; el resto vive atrás del botón "Más".
const mobilePrimaryHrefs = ["/admin", "/admin/turnos", "/admin/calendario", "/admin/historial"];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState("/img/logo.png");
  const { isAdmin, can, loading: loadingPermissions } = usePermissions();

  useEffect(() => {
    getSiteConfig().then((config) => { if (config.logoUrl) setLogoUrl(config.logoUrl); });
  }, []);

  // Mientras cargan los permisos de un Staff, no mostrar nada todavía (evita el
  // parpadeo de ver todo el menú y que un ítem sin permiso desaparezca después).
  const visible = (item: NavItem) => {
    if (isAdmin) return true;
    if (item.adminOnly) return false;
    if (!item.module) return true;
    if (loadingPermissions) return false;
    return can(item.module, "View");
  };

  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter(visible) }))
    .filter((g) => g.items.length > 0);
  const visibleAllItems = [topItem, ...visibleGroups.flatMap((g) => g.items)];
  const mobilePrimary = visibleAllItems.filter((i) => mobilePrimaryHrefs.includes(i.href));

  const handleLogout = async () => {
    const { logout } = await import("@/src/lib/auth");
    await logout();
  };

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href;

  const isMoreActive = visibleAllItems
    .filter((i) => !mobilePrimaryHrefs.includes(i.href))
    .some((i) => isActive(i.href));

  const linkClasses = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
      active
        ? "bg-blush/12 text-blushdark font-medium"
        : "text-charcoal/50 hover:text-charcoal hover:bg-porcelain"
    }`;

  return (
    <>
      {/* ════════════════════════════════════
          DESKTOP — sidebar fijo a la izquierda, agrupado por secciones
          ════════════════════════════════════ */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-56 bg-ivory border-r border-mauve/10 flex-col z-40">
        <div className="px-5 py-6 border-b border-mauve/10">
          <Link href="/reservar" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full overflow-hidden border border-mauve/15 bg-white">
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
            </div>
            <span className="text-charcoal text-sm font-semibold">Panel Admin</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          <Link href={topItem.href} className={linkClasses(isActive(topItem.href))}>
            <topItem.icon size={17} />
            {topItem.label}
          </Link>

          {visibleGroups.map((group) => (
            <div key={group.title}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-charcoal/30">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className={linkClasses(isActive(href))}>
                    <Icon size={17} />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-mauve/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600/70 hover:text-red-600 hover:bg-red-50 transition-all w-full"
          >
            <LogOut size={17} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════
          MOBILE — top bar
          ════════════════════════════════════ */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-ivory border-b border-mauve/10 z-40 flex items-center justify-between px-4">
        <Link href="/reservar" className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full overflow-hidden border border-mauve/15 bg-white">
            <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
          </div>
          <span className="text-charcoal text-sm font-semibold">Panel Admin</span>
        </Link>
        <button
          onClick={() => setMenuOpen(true)}
          className="p-2 text-charcoal/60 hover:text-charcoal transition"
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* ════════════════════════════════════
          MOBILE — bottom tab bar: solo los 4 de uso diario + "Más"
          ════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-ivory border-t border-mauve/10 z-40">
        <div className="grid h-14" style={{ gridTemplateColumns: `repeat(${mobilePrimary.length + 1}, minmax(0, 1fr))` }}>
          {mobilePrimary.map(({ href, label, icon: Icon }) => {
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
                <span className="text-[9px] font-medium leading-none">{label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMenuOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 transition-all ${
              isMoreActive ? "text-blushdark" : "text-charcoal/30 hover:text-charcoal/60"
            }`}
          >
            <MoreHorizontal size={20} strokeWidth={isMoreActive ? 2.2 : 1.8} />
            <span className="text-[9px] font-medium leading-none">Más</span>
          </button>
        </div>
      </nav>

      {/* ════════════════════════════════════
          MOBILE — drawer: todo el resto, agrupado igual que el desktop
          ════════════════════════════════════ */}
      {menuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-50"
            onClick={() => setMenuOpen(false)}
          />
          <div className="md:hidden fixed left-0 top-0 h-full w-64 bg-ivory border-r border-mauve/10 z-50 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-mauve/10">
              <span className="text-charcoal font-semibold text-sm">Menú</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-1.5 text-charcoal/40 hover:text-charcoal transition"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
              <Link
                href={topItem.href}
                onClick={() => setMenuOpen(false)}
                className={linkClasses(isActive(topItem.href))}
              >
                <topItem.icon size={17} />
                {topItem.label}
              </Link>

              {visibleGroups.map((group) => (
                <div key={group.title}>
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-charcoal/30">
                    {group.title}
                  </p>
                  <div className="space-y-1">
                    {group.items.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMenuOpen(false)}
                        className={linkClasses(isActive(href))}
                      >
                        <Icon size={17} />
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="px-3 py-4 border-t border-mauve/10">
              <button
                onClick={() => { setMenuOpen(false); handleLogout(); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600/70 hover:text-red-600 hover:bg-red-50 transition-all w-full"
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
