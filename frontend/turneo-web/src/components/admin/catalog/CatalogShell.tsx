"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

const TABS = [
  { href: "/admin/catalogo", label: "Productos" },
  { href: "/admin/catalogo/categorias", label: "Categorías" },
  { href: "/admin/catalogo/atributos", label: "Atributos" },
];

// Same guard as the other admin pages: without a panel session, go to login.
export function useAdminGuard(): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
      return;
    }
    setReady(true);
  }, [router]);
  return ready;
}

export const labelClass = "text-charcoal/60 text-xs font-medium uppercase tracking-wider";

export default function CatalogShell({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin/catalogo"
      ? pathname === href || pathname.startsWith("/admin/catalogo/productos")
      : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-charcoal">{title}</h1>
            <p className="text-charcoal/50 text-sm mt-1">{description}</p>
          </div>
          {action}
        </div>

        <nav className="mb-6 flex gap-1 border-b border-mauve/10 overflow-x-auto" aria-label="Secciones del catálogo">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition ${
                isActive(tab.href)
                  ? "border-blush text-blushdark font-medium"
                  : "border-transparent text-charcoal/50 hover:text-charcoal"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </div>
  );
}

export function CatalogModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useModalHotkeys(true, { onClose });
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-ivory border border-mauve/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-charcoal">{title}</h2>
          <button type="button" onClick={onClose} className="text-charcoal/40 hover:text-charcoal transition text-xl" aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
        active ? "bg-green-500/20 text-green-700" : "bg-orange-500/20 text-orange-700"
      }`}
    >
      {active ? "ACTIVO" : "INACTIVO"}
    </span>
  );
}

export function EmptyState({ message, actionLabel, onAction }: { message: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="text-center py-16 border border-dashed border-mauve/10 rounded-xl">
      <p className="text-charcoal/40 text-lg">{message}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="mt-4 text-blushdark hover:text-blush transition text-sm">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
