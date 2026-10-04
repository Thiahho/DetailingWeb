"use client";

import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SPEED_PX_PER_S = 40; // avance automático, de derecha a izquierda
const RESUME_DELAY_MS = 1500; // espera tras interactuar (deja terminar el momentum táctil)
const DRAG_THRESHOLD_PX = 5;

// Carrusel continuo de cards de ancho fijo: se desplaza solo de derecha a
// izquierda en bucle infinito (el contenido se triplica y el scroll "salta" un
// set completo al salir del rango central, sin corte visible). Sigue siendo un
// contenedor con scroll nativo: se arrastra con dedo o mouse y tiene flechas.
// El avance se pausa al interactuar, con la pestaña oculta o con movimiento
// reducido. Si las cards entran sin desbordar, se centran y no se mueven.
export default function TeamCarousel({ children }: { children: ReactNode }) {
  const slides = Children.toArray(children);
  const count = slides.length;
  const trackRef = useRef<HTMLDivElement>(null);
  // reps = veces que se repite la lista dentro de un "set" para que el set desborde
  // el ancho visible (con pocos profesionales en pantalla ancha, 1 sola copia no alcanza).
  const [reps, setReps] = useState(0); // 0 = sin bucle
  const loop = reps > 0;

  const hoveredRef = useRef(false);
  const pausedUntilRef = useRef(0);
  const dragRef = useRef<{ startX: number; startLeft: number; moved: boolean } | null>(null);

  const pauseFor = (ms: number) => {
    pausedUntilRef.current = performance.now() + ms;
  };

  const setWidth = useCallback(() => {
    const first = trackRef.current?.children[0] as HTMLElement | undefined;
    return first ? first.offsetWidth * count * reps : 0;
  }, [count, reps]);

  // ¿Desbordan las cards el ancho disponible? Solo entonces tiene sentido el bucle.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const first = track.children[0] as HTMLElement | undefined;
      const natural = first ? first.offsetWidth * count : 0;
      setReps(count > 1 && natural > 0 ? Math.ceil(track.clientWidth / natural) : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [count]);

  // Al activar el bucle, arranca en el set del medio para poder arrastrar hacia ambos lados.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollLeft = loop ? setWidth() : 0;
  }, [loop, setWidth]);

  // Mantiene el scroll dentro del set central (salto invisible de un set completo).
  // Devuelve cuánto saltó (0 si no hizo falta).
  const wrap = useCallback(() => {
    const track = trackRef.current;
    if (!track || !loop) return 0;
    const w = setWidth();
    if (w === 0) return 0;
    if (track.scrollLeft >= 2 * w) {
      track.scrollLeft -= w;
      return -w;
    }
    if (track.scrollLeft < w) {
      track.scrollLeft += w;
      return w;
    }
    return 0;
  }, [loop, setWidth]);

  // Avance automático con rAF. pos lleva los decimales (scrollLeft puede redondear
  // y frenar velocidades bajas); si el usuario movió el scroll, se re-sincroniza.
  useEffect(() => {
    if (!loop) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const track = trackRef.current;
    if (!track) return;

    let raf = 0;
    let last = performance.now();
    let pos = track.scrollLeft;
    let lastSet = pos;

    const frame = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      const paused =
        hoveredRef.current || dragRef.current || document.hidden || now < pausedUntilRef.current;
      if (paused) {
        pos = track.scrollLeft;
      } else {
        if (Math.abs(track.scrollLeft - lastSet) > 1.5) pos = track.scrollLeft;
        pos += SPEED_PX_PER_S * dt;
        track.scrollLeft = pos;
        // Ojo: en desktop scrollLeft redondea a entero; no se relee pos de ahí
        // (se perdería el avance sub-pixel y a 40px/s nunca se movería).
        pos += wrap();
        lastSet = track.scrollLeft;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [loop, wrap]);

  const scrollByCard = (dir: 1 | -1) => {
    const track = trackRef.current;
    const first = track?.children[0] as HTMLElement | undefined;
    if (!track || !first) return;
    pauseFor(RESUME_DELAY_MS);
    track.scrollBy({ left: dir * first.offsetWidth, behavior: "smooth" });
  };

  // Arrastre con mouse (el dedo ya desplaza nativamente). El click se anula si hubo arrastre.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const track = trackRef.current;
    if (!track) return;
    dragRef.current = { startX: e.clientX, startLeft: track.scrollLeft, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const track = trackRef.current;
    if (!drag || !track) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) > DRAG_THRESHOLD_PX) {
      drag.moved = true;
      track.setPointerCapture(e.pointerId);
    }
    if (drag.moved) {
      track.scrollLeft = drag.startLeft - dx;
      wrap();
    }
  };
  const endDrag = () => {
    if (!dragRef.current) return;
    // dragRef se limpia después del click que sigue al mouseup, para poder cancelarlo
    const moved = dragRef.current.moved;
    pauseFor(RESUME_DELAY_MS);
    setTimeout(() => {
      dragRef.current = null;
    }, 0);
    if (!moved) dragRef.current = null;
  };

  if (count === 0) return null;

  const renderSlide = (slide: ReactNode, key: string, clone: boolean) => (
    <div
      key={key}
      // Los clones del bucle se ocultan a lectores de pantalla (siguen siendo clickeables).
      aria-hidden={clone || undefined}
      className="flex w-72 shrink-0 pr-5 sm:w-80"
    >
      {slide}
    </div>
  );

  return (
    <div className="relative">
      <div
        ref={trackRef}
        data-testid="team-carousel-track"
        onMouseEnter={() => (hoveredRef.current = true)}
        onMouseLeave={() => {
          hoveredRef.current = false;
          pauseFor(RESUME_DELAY_MS);
        }}
        onTouchStart={() => pauseFor(60_000)}
        onTouchEnd={() => pauseFor(RESUME_DELAY_MS)}
        onFocus={() => pauseFor(60_000)}
        onBlur={() => pauseFor(RESUME_DELAY_MS)}
        onScroll={wrap}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          if (dragRef.current?.moved) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className={`relative flex overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
          loop ? "cursor-grab active:cursor-grabbing" : "justify-center"
        }`}
      >
        {slides.map((s, i) => renderSlide(s, `a${i}`, false))}
        {loop &&
          Array.from({ length: reps * 3 - 1 }, (_, r) =>
            slides.map((s, i) => renderSlide(s, `c${r}-${i}`, true))
          )}
      </div>

      {loop && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            aria-label="Profesional anterior"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-mauve/15 bg-white text-charcoal/60 transition hover:border-mauve/30 hover:text-charcoal"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            aria-label="Siguiente profesional"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-mauve/15 bg-white text-charcoal/60 transition hover:border-mauve/30 hover:text-charcoal"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
