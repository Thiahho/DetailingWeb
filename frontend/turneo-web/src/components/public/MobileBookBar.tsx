"use client";

import { useEffect, useState } from "react";

const BAR_HEIGHT_PX = 76;

// Barra fija "Reservar turno" solo en mobile: el CTA queda a mano en una página
// larga. Se esconde al llegar a la sección de reserva (ya está en pantalla) y
// publica su alto en --mobile-bar-h para que los floats (WhatsApp, Ruleta) se
// corran hacia arriba en vez de quedar tapados.
export default function MobileBookBar({ targetId }: { targetId: string }) {
  const [atTarget, setAtTarget] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setAtTarget(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    const apply = () =>
      document.documentElement.style.setProperty("--mobile-bar-h", mobile.matches && !atTarget ? `${BAR_HEIGHT_PX}px` : "0px");
    apply();
    mobile.addEventListener("change", apply);
    return () => {
      mobile.removeEventListener("change", apply);
      document.documentElement.style.removeProperty("--mobile-bar-h");
    };
  }, [atTarget]);

  return (
    <div
      className={`fixed inset-x-0 z-40 border-t border-mauve/25 bg-cream/95 px-4 py-3 backdrop-blur transition-transform duration-300 md:hidden ${
        atTarget ? "pointer-events-none translate-y-[150%]" : "translate-y-0"
      }`}
      style={{ bottom: "var(--consent-bar-h, 0px)" }}
    >
      <a
        href={`#${targetId}`}
        tabIndex={atTarget ? -1 : 0}
        className="flex min-h-[52px] items-center justify-center rounded-full bg-ink text-base font-semibold text-cream active:scale-[0.98]"
      >
        Reservar turno →
      </a>
    </div>
  );
}
