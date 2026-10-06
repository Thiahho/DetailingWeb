"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSiteConfig } from "@/src/lib/siteConfig";
import { usePermissions, type PermissionModuleKey } from "@/src/hooks/usePermissions";
import { useTeamMode } from "@/src/hooks/useTeamMode";
import {
  CalendarDays, BarChart2, Wrench, Globe,
  LogOut,
  List, LayoutDashboard, Menu, X, ClipboardList, KeyRound, Clapperboard, Image, Users, UserCog,
  MoreHorizontal, ChevronDown, Building2, Package, Wallet, Zap, Boxes, ShieldCheck, Nfc, Gift, ShieldAlert, Star,
} from "lucide-react";

// `module`: a qué PermissionModule pertenece este link — un Staff sin permiso
// de View en ese módulo no lo ve. Sin `module` = visible para cualquier rol
// que ya esté en el panel (Panel, Cuenta). `adminOnly` = fuera del sistema de
// permisos (Estadísticas/Empresa/Permisos tocan datos sensibles del negocio
// completo, no de un módulo puntual) — solo Admin real, ni con todos los
// permisos de Staff alcanza.
// `soloHidden`: se oculta cuando el tenant no tiene ningún profesional activo
// (negocio de una sola persona) — "Equipo"/"Permisos" no aplican hasta que
// haya alguien más a quien gestionar. Reaparece solo al sumar el primer
// profesional, sin ningún toggle manual (ver useTeamMode).
type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; module?: PermissionModuleKey; adminOnly?: boolean; soloHidden?: boolean };
type NavGroup = { title: string; items: NavItem[] };

// Panel queda suelto arriba (es el home). El resto se agrupa por dominio, con
// secciones chicas (2-4 links) — así se lee de un vistazo, no se escanea entero.
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
    title: "Clientes",
    items: [
      { href: "/admin/clientes", label: "Clientes", icon: Users, module: "Clientes" },
      { href: "/admin/resenas", label: "Reseñas", icon: Star, module: "Resenas" },
      { href: "/admin/solicitudes-privacidad", label: "Privacidad", icon: ShieldAlert, module: "Clientes" },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/admin/servicios", label: "Servicios", icon: Wrench, module: "Servicios" },
      { href: "/admin/productos", label: "Productos", icon: Package, module: "Productos" },
      { href: "/admin/insumos", label: "Insumos", icon: Boxes, module: "Insumos" },
    ],
  },
  {
    title: "Finanzas",
    items: [
      { href: "/admin/caja", label: "Caja", icon: Wallet, module: "Caja" },
      { href: "/admin/estadisticas", label: "Estadísticas", icon: BarChart2, adminOnly: true },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/admin/automatizaciones", label: "Automatizaciones", icon: Zap, module: "Automatizaciones" },
      { href: "/admin/smart-tags", label: "Smart Tags", icon: Nfc, module: "SmartTags" },
      { href: "/admin/ruleta", label: "Ruleta", icon: Gift, module: "Ruleta" },
    ],
  },
  {
    title: "Sitio web",
    items: [
      { href: "/admin/galeria", label: "Galería", icon: Image, module: "Galeria" },
      { href: "/admin/contenido", label: "Contenido", icon: Clapperboard, module: "Contenido" },
    ],
  },
  {
    title: "Administración",
    items: [
      { href: "/admin/configuracion", label: "Empresa", icon: Building2, adminOnly: true },
      { href: "/admin/profesionales", label: "Equipo", icon: UserCog, module: "Profesionales", soloHidden: true },
      { href: "/admin/permisos", label: "Permisos", icon: ShieldCheck, adminOnly: true, soloHidden: true },
      { href: "/admin/cuenta", label: "Cuenta", icon: KeyRound },
    ],
  },
];

const COLLAPSED_STORAGE_KEY = "admin-sidebar-collapsed";

// Los 4 de uso diario van fijos en la barra mobile; el resto vive atrás del botón "Más".
const mobilePrimaryHrefs = ["/admin", "/admin/turnos", "/admin/calendario", "/admin/historial"];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState("/img/logo.png");
  const { role, isAdmin, can, loading: loadingPermissions } = usePermissions();
  const { hasTeam } = useTeamMode();

  // Secciones plegadas por el usuario (por título). Todas abiertas por defecto;
  // se lee de localStorage después del mount para no romper la hidratación.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getSiteConfig().then((config) => { if (config.logoUrl) setLogoUrl(config.logoUrl); });
    try {
      const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (stored) setCollapsed(JSON.parse(stored));
    } catch {}
  }, []);

  const toggleGroup = (title: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try { localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Mientras cargan los permisos de un Staff, no mostrar nada todavía (evita el
  // parpadeo de ver todo el menú y que un ítem sin permiso desaparezca después).
  // El chequeo de soloHidden va primero y aplica también a Admin — es
  // justamente a la dueña sola a quien hay que ocultarle Equipo/Permisos.
  // useTeamMode arranca con professionals=[] hasta que resuelve el fetch, así
  // que el ítem ya queda oculto durante esa carga sin lógica extra.
  const visible = (item: NavItem) => {
    if (item.soloHidden && !hasTeam) return false;
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
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

  const isMoreActive = visibleAllItems
    .filter((i) => !mobilePrimaryHrefs.includes(i.href))
    .some((i) => isActive(i.href));

  const linkClasses = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
      active
        ? "bg-blush/12 text-blushdark font-medium"
        : "text-charcoal/50 hover:text-charcoal hover:bg-porcelain"
    }`;

  // Mismo árbol para el sidebar desktop y el drawer mobile. La sección que
  // contiene la página actual se muestra siempre, aunque esté plegada.
  const renderNav = (onNavigate?: () => void) => (
    <nav className="flex-1 px-3 py-4 space-y-3 overflow-y-auto">
      <Link href={topItem.href} onClick={onNavigate} className={linkClasses(isActive(topItem.href))}>
        <topItem.icon size={17} />
        {topItem.label}
      </Link>

      {visibleGroups.map((group) => {
        const open = !collapsed[group.title] || group.items.some((i) => isActive(i.href));
        return (
          <div key={group.title} className="pt-3 border-t border-mauve/10">
            <button
              type="button"
              onClick={() => toggleGroup(group.title)}
              aria-expanded={open}
              className="flex items-center justify-between w-full px-3 py-1 mb-1 text-[10px] font-semibold uppercase tracking-wider text-charcoal/40 hover:text-charcoal/70 transition"
            >
              {group.title}
              <ChevronDown size={13} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
            </button>
            {open && (
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} onClick={onNavigate} className={linkClasses(isActive(href))}>
                    <Icon size={17} />
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

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

        {renderNav()}

        <div className="px-3 py-4 border-t border-mauve/10 space-y-1">
          {/* Vuelta al sitio público: el panel no lleva el Navbar del negocio
              (ver SiteChrome), así que este es el acceso explícito. */}
          <Link href="/reservar" data-testid="panel-site-link" className={linkClasses(false)}>
            <Globe size={17} />
            Ver sitio web
          </Link>
          {role === "Professional" && (
            <Link href="/profesional/agenda" className={linkClasses(false)}>
              <CalendarDays size={17} />
              Mi agenda
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
        <div className="flex items-center gap-1">
          <Link
            href="/reservar"
            data-testid="panel-site-link-mobile"
            className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-mauve/20 px-3 text-xs font-medium text-charcoal/70 transition hover:text-charcoal"
          >
            <Globe size={15} />
            Ver sitio
          </Link>
          <button
            onClick={() => setMenuOpen(true)}
            className="p-2 text-charcoal/60 hover:text-charcoal transition"
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
        </div>
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

            {renderNav(() => setMenuOpen(false))}

            <div className="px-3 py-4 border-t border-mauve/10 space-y-1">
              <Link href="/reservar" onClick={() => setMenuOpen(false)} className={linkClasses(false)}>
                <Globe size={17} />
                Ver sitio web
              </Link>
              {role === "Professional" && (
                <Link href="/profesional/agenda" onClick={() => setMenuOpen(false)} className={linkClasses(false)}>
                  <CalendarDays size={17} />
                  Mi agenda
                </Link>
              )}
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
