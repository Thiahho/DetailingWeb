import Reveal from "@/src/components/public/Reveal";
import { CLOSING, WHATSAPP } from "@/src/components/landing/content";

// Cierre: un único CTA a WhatsApp. Conserva el id "contacto" (lo observa
// MobileCtaBar para esconderse cuando este botón ya está en pantalla).
export default function ClosingCta() {
  return (
    <section id="contacto" className="scroll-mt-16 bg-ink text-cream">
      <Reveal className="mx-auto flex max-w-4xl flex-col items-start gap-6 px-6 py-24 md:items-center md:py-32 md:text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-blush">{CLOSING.eyebrow}</span>
        <h2 className="text-balance text-[2.6rem] font-semibold leading-[1.02] tracking-tight md:text-7xl">
          {CLOSING.title.before}
          <span className="accent-serif text-blush">{CLOSING.title.accent}</span>
        </h2>
        <p className="max-w-xl text-pretty text-base leading-relaxed text-mist md:text-lg">{CLOSING.lead}</p>
        <a
          href={WHATSAPP.closing}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full bg-blush px-9 text-base font-semibold text-ink transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream sm:w-auto"
        >
          {CLOSING.cta}
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </a>
      </Reveal>
    </section>
  );
}
