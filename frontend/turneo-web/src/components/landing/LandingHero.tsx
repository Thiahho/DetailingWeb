import { Check } from "lucide-react";
import { HERO, WHATSAPP } from "@/src/components/landing/content";
import AgendaPreview from "@/src/components/landing/previews/AgendaPreview";

// Hero oscuro (ink), mismo lenguaje que el de /reservar: titular grande con
// acento serif, un solo CTA principal (WhatsApp) y un enlace secundario discreto.
export default function LandingHero() {
  return (
    <section id="inicio" className="overflow-hidden bg-ink text-cream">
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-6 pb-20 pt-12 lg:flex-row lg:items-center lg:gap-14 lg:pb-28 lg:pt-20">
        <div className="flex min-w-0 flex-col gap-6 lg:flex-1 lg:gap-7">
          <span className="flex animate-rise items-center gap-2.5 self-start rounded-full border border-cream/20 px-3.5 py-2 text-[11px] uppercase tracking-[0.16em] text-mist">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-blush" />
            {HERO.eyebrow}
          </span>
          <h1 className="animate-rise text-balance text-[2.9rem] font-semibold leading-[0.98] tracking-[-0.035em] [animation-delay:.1s] sm:text-6xl lg:text-[4.5rem]">
            {HERO.title.before}
            <span className="accent-serif text-blush">{HERO.title.accent}</span>
          </h1>
          <p className="max-w-xl animate-rise text-base leading-relaxed text-mist [animation-delay:.2s] md:text-lg">
            {HERO.subtitle}
          </p>
          <div className="flex animate-rise flex-col gap-2 [animation-delay:.3s] sm:flex-row sm:items-center sm:gap-4">
            <a
              id="hero-cta"
              data-testid="home-hero-cta"
              href={WHATSAPP.hero}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-blush px-8 text-base font-semibold text-ink transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream"
            >
              {HERO.cta}
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </a>
            <a
              href="#problemas"
              className="flex min-h-[48px] items-center justify-center px-3 text-sm font-medium text-mist underline decoration-cream/30 underline-offset-[6px] transition hover:text-cream hover:decoration-cream/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blush"
            >
              {HERO.secondary}
            </a>
          </div>
          <ul className="mt-1 flex animate-rise flex-col gap-2.5 border-t border-cream/15 pt-5 text-sm text-mist [animation-delay:.4s] sm:flex-row sm:flex-wrap sm:gap-x-7">
            {HERO.highlights.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check aria-hidden="true" size={16} strokeWidth={2.4} className="shrink-0 text-champagne" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-rise [animation-delay:.3s] lg:flex-[1.05]">
          <AgendaPreview />
        </div>
      </div>
    </section>
  );
}
