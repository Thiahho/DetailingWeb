"use client";

import { useEffect, useState } from "react";

interface MobileCtaBarProps {
  href: string;
  label: string;
  // Ids de elementos que ya ofrecen el mismo CTA: mientras alguno esté en
  // pantalla la barra se esconde (un solo CTA principal por pantalla).
  hideWhenVisible: string[];
}

// Barra fija de contacto, solo en mobile — mismo criterio que MobileBookBar de
// /reservar: el CTA queda a mano en una página larga. Se apoya sobre la barra
// de cookies (--consent-bar-h) en vez de quedar tapada por ella, y se esconde
// al llegar al cierre, así nunca cubre el final de la página.
export default function MobileCtaBar({ href, label, hideWhenVisible }: MobileCtaBarProps) {
  // Arranca escondida: al cargar, el CTA del hero está en pantalla.
  const [hidden, setHidden] = useState(true);
  const targets = hideWhenVisible.join(",");

  useEffect(() => {
    const elements = targets
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0 || !("IntersectionObserver" in window)) {
      setHidden(false);
      return;
    }
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        setHidden(visible.size > 0);
      },
      { threshold: 0.05 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [targets]);

  return (
    <div
      className={`fixed inset-x-0 z-40 border-t border-mauve/25 bg-cream/95 px-4 py-3 backdrop-blur transition-transform duration-300 md:hidden ${
        hidden ? "pointer-events-none translate-y-[150%]" : "translate-y-0"
      }`}
      style={{ bottom: "var(--consent-bar-h, 0px)" }}
    >
      <a
        data-testid="home-mobile-cta"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={hidden ? -1 : 0}
        aria-hidden={hidden}
        className="flex min-h-[52px] items-center justify-center rounded-full bg-ink text-base font-semibold text-cream active:scale-[0.98]"
      >
        {label} →
      </a>
    </div>
  );
}
