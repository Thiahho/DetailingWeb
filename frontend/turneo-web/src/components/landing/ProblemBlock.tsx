import { type ReactNode } from "react";
import { Check } from "lucide-react";
import Reveal from "@/src/components/public/Reveal";
import SectionHeading, { type Tone } from "@/src/components/landing/SectionHeading";
import { type ProblemContent } from "@/src/components/landing/content";

interface ProblemBlockProps {
  content: ProblemContent;
  tone: Tone;
  // true: el preview va a la izquierda en desktop (alterna el ritmo de la página).
  flip?: boolean;
  preview: ReactNode;
}

// Un problema del día a día y cómo lo resuelve Turneo: texto + preview de UI.
// El fondo alterna ink/cream de un bloque al siguiente.
export default function ProblemBlock({ content, tone, flip = false, preview }: ProblemBlockProps) {
  const onInk = tone === "ink";
  return (
    <section id={content.id} className={`scroll-mt-16 overflow-hidden ${onInk ? "bg-ink text-cream" : "bg-cream text-charcoal"}`}>
      <div
        className={`mx-auto flex max-w-6xl flex-col gap-12 px-6 py-20 md:py-28 lg:items-center lg:gap-16 ${
          flip ? "lg:flex-row-reverse" : "lg:flex-row"
        }`}
      >
        <Reveal className="space-y-6 lg:flex-1">
          <SectionHeading eyebrow={content.eyebrow} title={content.title} tone={tone} size="md" />
          <p className={`max-w-lg text-[17px] leading-relaxed ${onInk ? "text-mist" : "text-charcoal/70"}`}>{content.lead}</p>
          <ul className={`max-w-lg border-t ${onInk ? "border-cream/15" : "border-mauve/30"}`}>
            {content.points.map((point) => (
              <li
                key={point}
                className={`flex items-start gap-3 border-b py-4 text-[15px] leading-relaxed ${
                  onInk ? "border-cream/15 text-cream" : "border-mauve/30 text-charcoal"
                }`}
              >
                <Check
                  aria-hidden="true"
                  size={18}
                  strokeWidth={2.4}
                  className={`mt-0.5 shrink-0 ${onInk ? "text-champagne" : "text-rosewood"}`}
                />
                {point}
              </li>
            ))}
          </ul>
          {content.note && (
            <p
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium ${
                onInk ? "border-cream/20 text-mist" : "border-mauve/40 text-charcoal/70"
              }`}
            >
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${onInk ? "bg-champagne" : "bg-rosewood"}`} />
              {content.note}
            </p>
          )}
        </Reveal>
        <Reveal className="lg:flex-1">{preview}</Reveal>
      </div>
    </section>
  );
}
