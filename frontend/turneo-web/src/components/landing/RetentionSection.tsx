import { type ReactNode } from "react";
import { Nfc, Star } from "lucide-react";
import Reveal from "@/src/components/public/Reveal";
import SectionHeading from "@/src/components/landing/SectionHeading";
import { RETENTION } from "@/src/components/landing/content";

// Colores de los gajos de la ruleta: los mismos tokens de tailwind.config.js
// (blush, ink, champagne, porcelain, mauve, inksoft). Van en hex porque
// conic-gradient necesita los valores literales.
const WHEEL_BACKGROUND =
  "conic-gradient(#D69AA6 0 60deg, #2A2025 60deg 120deg, #C6A26E 120deg 180deg, #EFE1D9 180deg 240deg, #9C7C88 240deg 300deg, #33272D 300deg 360deg)";

function RoulettePreview() {
  return (
    <div className="flex h-full items-center gap-5 rounded-[1.75rem] bg-ink p-6 text-cream">
      <div className="relative shrink-0">
        <span className="absolute -top-2 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[12px] border-x-transparent border-t-cream" />
        <div className="h-28 w-28 rounded-full ring-4 ring-cream/15" style={{ background: WHEEL_BACKGROUND }}>
          <span className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream ring-4 ring-ink" />
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blush">Tu premio</p>
        <p className="mt-1 text-lg font-semibold leading-tight">Un adicional de regalo</p>
        <p className="mt-2 inline-block rounded-lg border border-dashed border-cream/40 px-2.5 py-1 font-mono text-xs tracking-widest text-mist">
          ALMA-7KQ2
        </p>
      </div>
    </div>
  );
}

function ReviewPreview() {
  return (
    <div className="flex h-full flex-col justify-between gap-4 rounded-[1.75rem] bg-ivory p-6 text-charcoal shadow-soft">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 text-champagne">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} size={16} fill="currentColor" strokeWidth={0} />
            ))}
          </div>
          <span className="rounded-full bg-cream px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-charcoal/70">
            Aprobada
          </span>
        </div>
        <p className="accent-serif mt-3 text-xl leading-snug text-charcoal">«Me encantó cómo quedó el color.»</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-charcoal/50">Reseña de ejemplo</p>
      </div>
      <span className="self-start rounded-full border border-mauve/40 px-3.5 py-2 text-xs font-semibold">Dejar reseña en Google →</span>
    </div>
  );
}

// Patrón fijo de 7×7 que se lee como un QR a simple vista (no codifica nada).
const QR_PATTERN = [
  "1110111",
  "1010101",
  "1110111",
  "0001000",
  "1110110",
  "1010011",
  "1110101",
];

// Destinos que puede abrir una etiqueta; el primero va resaltado como el activo.
const TAG_DESTINATIONS = ["Reservar turno", "Dejar reseña", "Instagram"];

function SmartTagPreview() {
  return (
    <div className="flex h-full items-center gap-5 rounded-[1.75rem] bg-porcelain p-6 text-charcoal">
      {/* La etiqueta física: disco NFC con un mini QR en el borde. */}
      <div className="relative shrink-0">
        <div className="flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-full bg-ink text-cream shadow-elevated ring-4 ring-ivory">
          <Nfc size={30} strokeWidth={1.6} className="text-blush" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-mist">Acercá</span>
        </div>
        <div className="absolute -bottom-1 -right-1 grid w-11 grid-cols-7 gap-px rounded-md bg-ivory p-1 shadow-soft">
          {QR_PATTERN.join("")
            .split("")
            .map((cell, i) => (
              <span key={i} className={`aspect-square rounded-[1px] ${cell === "1" ? "bg-ink" : "bg-transparent"}`} />
            ))}
        </div>
      </div>
      <div className="min-w-0 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mauve">Un toque y abre</p>
        <ul className="space-y-1.5">
          {TAG_DESTINATIONS.map((label, i) => (
            <li
              key={label}
              className={`truncate rounded-full px-3 py-1 text-xs font-semibold ${
                i === 0 ? "bg-ink text-cream" : "border border-mauve/30 text-charcoal/70"
              }`}
            >
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const PREVIEWS: Record<string, ReactNode> = {
  ruleta: <RoulettePreview />,
  resenas: <ReviewPreview />,
  "smart-tags": <SmartTagPreview />,
};

// Retención: ruleta de fidelidad, reseñas y Smart Tags. Tres columnas, cada una
// con un preview distinto arriba y el texto debajo.
export default function RetentionSection() {
  return (
    <section id="fidelizacion" className="scroll-mt-16 mx-auto max-w-6xl space-y-12 px-6 py-20 md:space-y-16 md:py-28">
      <Reveal>
        <SectionHeading eyebrow={RETENTION.eyebrow} title={RETENTION.title} tone="cream" />
      </Reveal>
      <Reveal stagger className="grid gap-x-7 gap-y-12 md:grid-cols-3">
        {RETENTION.items.map(({ id, title, detail }) => (
          <article key={id} data-testid={`retention-${id}`} className="flex flex-col gap-5">
            <div aria-hidden="true" className="h-44 select-none">
              {PREVIEWS[id]}
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold tracking-tight text-charcoal">{title}</h3>
              <p className="text-[15px] leading-relaxed text-charcoal/70">{detail}</p>
            </div>
          </article>
        ))}
      </Reveal>
    </section>
  );
}
