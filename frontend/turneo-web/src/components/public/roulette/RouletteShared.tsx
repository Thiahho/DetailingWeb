"use client";

import Link from "next/link";
import type { ReactNode } from "react";

// Piezas compartidas por /beneficios (ruleta de fidelización del negocio) y
// /ruleta (captación de Turneo): misma rueda, mismo encabezado, mismas cards.
// Cada página conserva su propio flujo/backend; lo visual vive acá una sola vez.

export interface WheelPrize {
  id: number;
  name: string;
}

export const ROULETTE_CARD = "mx-auto max-w-sm space-y-4 rounded-3xl bg-ivory p-6 text-charcoal shadow-elevated";
export const ROULETTE_INPUT =
  "w-full rounded-xl border border-mauve/15 bg-white px-4 py-3 text-charcoal outline-none transition focus:border-blush focus:ring-1 focus:ring-blush/40";
export const ROULETTE_PRIMARY =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-blush px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-cream shadow-glow transition [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02] disabled:opacity-50";

// Gajos: tonos de la marca con texto que contrasta (oscuro sobre claros).
const SEGMENTS = [
  { fill: "#D69AA6", text: "#2A2025" }, // blush
  { fill: "#8F4C5D", text: "#F5EBE5" }, // rosewood
  { fill: "#E9DDF5", text: "#2A2025" }, // lavanda clara
  { fill: "#B96C7E", text: "#FFFFFF" }, // rosa profundo
];
const GOLD = "#C6A26E";
const CONFETTI_COLORS = ["#D69AA6", "#C6A26E", "#9C7C88", "#C9BFE0"];
const BULBS = 20;

/** Color de cada gajo; evita que el último toque al primero en la costura. */
function pickSegments(count: number) {
  const picks = Array.from({ length: count }, (_, i) => i % SEGMENTS.length);
  if (count > 2 && picks[count - 1] === picks[0]) {
    picks[count - 1] = (picks[count - 2] + 1) % SEGMENTS.length;
    if (picks[count - 1] === picks[0]) picks[count - 1] = (picks[count - 1] + 1) % SEGMENTS.length;
  }
  return picks.map((i) => SEGMENTS[i]);
}

/** Punto a `r` del centro, `deg` grados en sentido horario desde las 12. */
function polar(r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)] as const;
}

function segmentPath(startDeg: number, endDeg: number, r: number) {
  const [x1, y1] = polar(r, startDeg);
  const [x2, y2] = polar(r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M0 0 L${x1.toFixed(3)} ${y1.toFixed(3)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
}

/** Parte el nombre en hasta 2 líneas cortas para que entre a lo largo del gajo. */
function wrapLabel(name: string, max: number) {
  const words = name.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > max) {
      lines.push(line);
      line = w;
    } else {
      line = line ? line + " " + w : w;
    }
  }
  if (line) lines.push(line);
  const out = lines.slice(0, 2);
  if (lines.length > 2 || out.some((l) => l.length > max)) {
    out[out.length - 1] = out[out.length - 1].slice(0, max - 1).trimEnd() + "…";
  }
  return out;
}

/** Ángulo final de la rueda para que el puntero caiga en el premio ganado. */
export function computeSpinTarget(prizes: WheelPrize[], prizeName: string) {
  const index = prizes.findIndex((p) => p.name === prizeName);
  const safeIndex = index >= 0 ? index : 0;
  const segmentAngle = 360 / prizes.length;
  const jitter = (Math.random() - 0.5) * segmentAngle * 0.5;
  return 360 * 6 + (360 - (safeIndex * segmentAngle + segmentAngle / 2)) + jitter;
}

export function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Confetti() {
  const pieces = Array.from({ length: 22 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
    rotate: Math.random() * 360,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  }));

  return (
    <div className="pointer-events-none absolute inset-x-0 -top-2 h-0 overflow-visible">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute top-0 block h-2 w-1.5 rounded-sm"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function RouletteFrame({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center bg-ink px-6 py-16 text-cream">
      <div className="w-full max-w-xl space-y-8 text-center">{children}</div>
    </main>
  );
}

export function RouletteHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  accent,
  subtitle,
}: {
  backHref: string;
  backLabel: string;
  eyebrow: string;
  title: string;
  accent: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-3">
      <Link
        href={backHref}
        className="text-xs font-semibold uppercase tracking-[0.2em] text-mist transition hover:text-cream"
      >
        {backLabel}
      </Link>
      <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-blush">{eyebrow}</span>
      <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
        {title} <span className="accent-serif text-blush">{accent}</span>
      </h1>
      <p className="text-mist">{subtitle}</p>
    </div>
  );
}

// Capas (de abajo hacia arriba): sombra de apoyo → aro con luces → rueda que
// gira (SVG) → brillo de vidrio y centro → puntero. Todo lo que no gira es fijo.
export function RouletteWheel({
  prizes,
  rotation,
  spinning,
  confetti,
  onSpinEnd,
  centerIcon,
}: {
  prizes: WheelPrize[];
  rotation: number;
  spinning: boolean;
  confetti: boolean;
  onSpinEnd: () => void;
  centerIcon: ReactNode;
}) {
  const count = prizes.length;
  const seg = count > 0 ? 360 / count : 360;
  const picks = pickSegments(count);
  const maxChars = count > 10 ? 11 : 14;
  const fontSize = count > 10 ? 5.6 : count > 7 ? 6.4 : 7.2;

  return (
    <div className="relative flex justify-center pt-3">
      <div className={`relative aspect-square w-[min(20rem,82vw)] ${spinning ? "wheel-spinning" : ""}`}>
        {/* Sombra de apoyo: le da peso y despega la rueda del fondo */}
        <div
          aria-hidden
          className="absolute -bottom-6 left-1/2 h-8 w-[78%] -translate-x-1/2 rounded-full bg-black/55 blur-xl"
        />
        <div
          aria-hidden
          className={`absolute inset-0 rounded-full transition-shadow duration-500 ${
            spinning ? "shadow-[0_0_70px_14px_rgba(214,154,166,0.45)]" : "shadow-[0_0_46px_6px_rgba(214,154,166,0.18)]"
          }`}
        />

        {/* Aro exterior metálico + luces */}
        <svg viewBox="-100 -100 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="rw-ring" x1="0.15" y1="0" x2="0.85" y2="1">
              <stop offset="0" stopColor="#F1DDB0" />
              <stop offset="0.28" stopColor={GOLD} />
              <stop offset="0.55" stopColor="#8E6B3C" />
              <stop offset="0.8" stopColor="#D8B87F" />
              <stop offset="1" stopColor="#9A7646" />
            </linearGradient>
            <radialGradient id="rw-bulb" cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="0.5" stopColor="#FFE6B8" />
              <stop offset="1" stopColor="#D69AA6" />
            </radialGradient>
          </defs>
          <circle r="100" fill="url(#rw-ring)" />
          <circle r="100" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
          <circle r="86" fill="#2A2025" />
          <circle r="86" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="1.2" />
          {Array.from({ length: BULBS }, (_, i) => {
            const [x, y] = polar(93, (i * 360) / BULBS);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="3"
                fill="url(#rw-bulb)"
                className={i % 2 === 0 ? "wheel-bulb-a" : "wheel-bulb-b"}
              />
            );
          })}
        </svg>

        {/* Rueda giratoria — ocupa el hueco del aro (86/100) */}
        <div
          onTransitionEnd={onSpinEnd}
          className="absolute inset-[7%] rounded-full"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? "transform 4.2s cubic-bezier(0.18, 1.15, 0.32, 1)" : "none",
          }}
        >
          <svg viewBox="-100 -100 200 200" className="h-full w-full" aria-hidden>
            <defs>
              <radialGradient id="rw-depth" cx="0" cy="0" r="1">
                <stop offset="0" stopColor="rgba(255,255,255,0.28)" />
                <stop offset="0.45" stopColor="rgba(255,255,255,0)" />
                <stop offset="1" stopColor="rgba(0,0,0,0.34)" />
              </radialGradient>
            </defs>

            {count === 0 ? (
              <circle r="100" fill={SEGMENTS[0].fill} />
            ) : count === 1 ? (
              <circle r="100" fill={picks[0].fill} />
            ) : (
              prizes.map((p, i) => (
                <path
                  key={p.id}
                  d={segmentPath(i * seg, (i + 1) * seg, 100)}
                  fill={picks[i].fill}
                  stroke={GOLD}
                  strokeWidth="0.9"
                  strokeLinejoin="round"
                />
              ))
            )}

            {/* Profundidad: centro luminoso, borde sombreado */}
            <circle r="100" fill="url(#rw-depth)" />

            {prizes.map((p, i) => {
              const center = i * seg + seg / 2;
              const lines = wrapLabel(p.name, maxChars);
              return (
                <g key={`t-${p.id}`} transform={`rotate(${center - 90})`}>
                  <text
                    x="90"
                    textAnchor="end"
                    fill={picks[i].text}
                    fontSize={fontSize}
                    fontWeight="700"
                    letterSpacing="0.2"
                    style={{ textTransform: "uppercase" }}
                  >
                    {lines.map((l, k) => (
                      <tspan
                        key={k}
                        x="90"
                        dy={k === 0 ? (lines.length > 1 ? -fontSize * 0.2 : fontSize * 0.35) : fontSize * 1.15}
                      >
                        {l}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}

            {/* Clavijas doradas en cada división: "clickean" bajo el puntero */}
            {count > 1 &&
              prizes.map((p, i) => {
                const [x, y] = polar(95.5, i * seg);
                return <circle key={`p-${p.id}`} cx={x} cy={y} r="2.1" fill="#F1DDB0" stroke="#8E6B3C" strokeWidth="0.5" />;
              })}
            <circle r="99.2" fill="none" stroke={GOLD} strokeWidth="1.6" />
          </svg>
        </div>

        {/* Brillo de vidrio — fijo, no rota */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[7%] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse 60% 38% at 32% 22%, rgba(255,255,255,0.38), transparent 70%), radial-gradient(circle at 78% 86%, rgba(0,0,0,0.18), transparent 55%)",
          }}
        />

        {/* Centro: botón dorado con relieve */}
        <div className="absolute left-1/2 top-1/2 z-10 flex h-[24%] w-[24%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-[#F1DDB0] via-champagne to-[#8E6B3C] p-[5%] shadow-[0_6px_16px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.6)]">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-ink to-inksoft shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)]">
            {centerIcon}
          </div>
        </div>

        {/* Puntero — gota dorada fija, no rota con la rueda */}
        <div className="pointer-idle absolute -top-3 left-1/2 z-20 origin-top -translate-x-1/2 drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">
          <svg width="34" height="44" viewBox="0 0 34 44" aria-hidden>
            <defs>
              <linearGradient id="rw-pin" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#F6E6C2" />
                <stop offset="0.5" stopColor={GOLD} />
                <stop offset="1" stopColor="#8E6B3C" />
              </linearGradient>
            </defs>
            <path d="M17 43 C17 43 3 26 3 15 A14 14 0 0 1 31 15 C31 26 17 43 17 43 Z" fill="url(#rw-pin)" />
            <circle cx="17" cy="15" r="6" fill="#2A2025" />
            <circle cx="15.5" cy="13.5" r="1.8" fill="rgba(255,255,255,0.55)" />
          </svg>
        </div>
      </div>

      {confetti && <Confetti />}
    </div>
  );
}
