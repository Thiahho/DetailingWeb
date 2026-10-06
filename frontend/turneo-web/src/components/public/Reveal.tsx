"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  // true: en vez de animar el contenedor, anima sus hijos directos en cascada
  // (grillas de cards). Los hijos no deben depender de `transform` propio.
  stagger?: boolean;
}

// Entrada suave al entrar en pantalla (estilos en globals.css). El estado
// oculto se "arma" recién al montar: si el JS no corre, el contenido queda
// visible. Con "reducir movimiento" no se arma nunca.
export default function Reveal({ children, className = "", stagger = false }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const attr = stagger ? "data-reveal-stagger" : "data-reveal";
    // Lo que ya está en pantalla al cargar no se esconde para volver a mostrarlo.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    el.setAttribute(attr, "armed");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("is-in");
        observer.disconnect();
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [stagger]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
