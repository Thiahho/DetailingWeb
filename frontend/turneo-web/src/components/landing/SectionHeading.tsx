import { type AccentTitle } from "@/src/components/landing/content";

export type Tone = "ink" | "cream";

interface SectionHeadingProps {
  eyebrow: string;
  title: AccentTitle;
  tone: Tone;
  // "lg" para los títulos de sección que van solos arriba; "md" dentro de un
  // bloque de dos columnas, donde el título comparte ancho con un preview.
  size?: "md" | "lg";
  className?: string;
}

// Eyebrow en mayúsculas + h2 con una parte en .accent-serif: la misma jerarquía
// que usan las secciones de /reservar. Sobre cream el acento va en rosewood
// (blush no llega a contraste AA sobre fondos claros).
export default function SectionHeading({ eyebrow, title, tone, size = "lg", className = "" }: SectionHeadingProps) {
  const onInk = tone === "ink";
  return (
    <div className={`space-y-3 ${className}`}>
      <span className={`block text-xs font-semibold uppercase tracking-[0.2em] ${onInk ? "text-blush" : "text-rosewood"}`}>
        {eyebrow}
      </span>
      <h2
        className={`text-balance font-semibold leading-[1.05] tracking-tight ${onInk ? "text-cream" : "text-charcoal"} ${
          size === "lg" ? "text-4xl md:text-[3.25rem]" : "text-[2.1rem] md:text-5xl"
        }`}
      >
        {title.before}
        <span className={`accent-serif ${onInk ? "text-blush" : "text-rosewood"}`}>{title.accent}</span>
        {title.after}
      </h2>
    </div>
  );
}
