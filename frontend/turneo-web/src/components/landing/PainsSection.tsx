import Reveal from "@/src/components/public/Reveal";
import SectionHeading from "@/src/components/landing/SectionHeading";
import { PAINS } from "@/src/components/landing/content";

// "¿Te suena?": los cuatro dolores, una línea cada uno, como lista editorial
// numerada (no cards). Cada fila lleva al bloque que lo resuelve.
export default function PainsSection() {
  return (
    <section id="problemas" className="scroll-mt-20 mx-auto max-w-6xl px-6 py-20 md:py-28">
      <div className="flex flex-col gap-10 md:flex-row md:gap-16">
        <Reveal className="md:sticky md:top-28 md:flex-1 md:self-start">
          <SectionHeading eyebrow={PAINS.eyebrow} title={PAINS.title} tone="cream" className="[&_h2]:text-5xl md:[&_h2]:text-7xl" />
        </Reveal>
        <Reveal stagger className="md:flex-[1.6]">
          {PAINS.items.map(({ title, detail, href }, i) => (
            <a
              key={href}
              href={href}
              data-testid="home-pain"
              className="group flex min-h-[72px] items-baseline gap-4 border-t border-mauve/30 py-5 last:border-b md:gap-6 md:py-7 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosewood"
            >
              <span aria-hidden="true" className="accent-serif w-7 shrink-0 text-2xl text-rosewood md:text-3xl">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-semibold leading-snug tracking-tight text-charcoal md:text-[1.7rem]">
                  {title}
                </span>
                <span className="mt-1 block text-[15px] leading-relaxed text-charcoal/70">{detail}</span>
              </span>
              <span
                aria-hidden="true"
                className="shrink-0 self-center text-charcoal/40 transition group-hover:translate-y-1 group-hover:text-rosewood"
              >
                ↓
              </span>
            </a>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
