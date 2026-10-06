"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import Reveal from "@/src/components/public/Reveal";
import SectionHeading from "@/src/components/landing/SectionHeading";
import { FAQ, WHATSAPP } from "@/src/components/landing/content";

// Preguntas frecuentes de quien evalúa sumarse — mismo patrón de acordeón que
// FaqSection de /reservar (una abierta a la vez, altura animada con grid).
export default function LandingFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="preguntas"
      className="scroll-mt-20 mx-auto flex max-w-6xl flex-col gap-10 px-6 py-20 md:flex-row md:items-start md:gap-16 md:py-28"
    >
      <Reveal className="space-y-4 md:sticky md:top-28 md:flex-1">
        <SectionHeading eyebrow={FAQ.eyebrow} title={FAQ.title} tone="cream" />
        <p className="leading-relaxed text-charcoal/70">{FAQ.help}</p>
        <a
          href={WHATSAPP.faq}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex min-h-[48px] items-center gap-2 rounded-full border border-mauve/40 px-6 text-sm font-semibold text-charcoal transition hover:-translate-y-0.5 hover:border-mauve/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosewood"
        >
          {FAQ.helpCta}
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </a>
      </Reveal>

      <Reveal className="md:flex-[1.5]">
        {FAQ.items.map(({ q, a }, i) => {
          const isOpen = open === i;
          return (
            <div key={q} className="border-t border-mauve/30 last:border-b">
              <h3 className="m-0">
                <button
                  type="button"
                  data-testid="home-faq-question"
                  aria-expanded={isOpen}
                  aria-controls={`home-faq-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex min-h-[64px] w-full items-center justify-between gap-5 py-5 text-left text-lg font-semibold tracking-tight text-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosewood md:py-6 md:text-xl"
                >
                  {q}
                  <span
                    aria-hidden="true"
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition duration-500 ease-out ${
                      isOpen ? "rotate-45 bg-ink text-cream" : "bg-ivory text-charcoal"
                    }`}
                  >
                    <Plus size={16} strokeWidth={2.2} />
                  </span>
                </button>
              </h3>
              {/* Altura animada con grid 0fr -> 1fr. `invisible` al cerrar saca
                  la respuesta del árbol de accesibilidad y del foco. */}
              <div
                id={`home-faq-${i}`}
                className={`grid transition-[grid-template-rows,visibility] duration-500 ease-out ${
                  isOpen ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="pb-7 pr-2 leading-relaxed text-charcoal/70 md:pr-14">{a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </Reveal>
    </section>
  );
}
