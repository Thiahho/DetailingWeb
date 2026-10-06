"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import Reveal from "@/src/components/public/Reveal";

// Preguntas frecuentes genéricas del flujo de reserva — resuelven objeciones
// antes de que el cliente llegue al formulario, mismo criterio que el resto
// de esta landing (sacar fricción antes del CTA final de "Contacto").
const FAQS = [
  {
    q: "¿Tengo que pagar algo para reservar?",
    a: "No necesariamente. Podés reservar tu turno sin pagar nada, y si querés adelantar una seña o el pago completo, tenés la opción de hacerlo online al confirmar tu reserva.",
  },
  {
    q: "¿Puedo elegir con quién atenderme?",
    a: "Sí. Al elegir el servicio te mostramos los especialistas disponibles — también podés dejarlo en \"sin preferencia\" y te asignamos el primer horario libre.",
  },
  {
    q: "¿Con cuánta anticipación puedo reservar?",
    a: "Podés ver y reservar los horarios disponibles de los próximos días directamente desde la web, sin necesidad de llamar.",
  },
  {
    q: "¿Puedo cancelar o cambiar mi turno?",
    a: "Sí, desde el link que te llega por email o WhatsApp al confirmar la reserva podés cancelar o reprogramar tu turno cuando quieras.",
  },
  {
    q: "¿Qué pasa si no puedo ir a mi turno?",
    a: "Avisanos cancelando desde tu link de reserva para liberar el horario a tiempo — así se lo damos a otro cliente y vos podés volver a reservar cuando quieras.",
  },
];

export default function FaqSection({ waLink }: { waLink?: string | null }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="preguntas"
      className="scroll-mt-20 mx-auto flex max-w-6xl flex-col gap-10 px-6 py-20 md:flex-row md:items-start md:gap-16 md:py-28"
    >
      <Reveal className="space-y-4 md:sticky md:top-28 md:flex-1">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-rosewood">Preguntas frecuentes</span>
        <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-charcoal md:text-[3.25rem]">
          Antes de <span className="accent-serif">reservar</span>
        </h2>
        {waLink && (
          <>
            <p className="leading-relaxed text-charcoal/70">¿No encontrás lo que buscás? Escribinos y te respondemos.</p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex min-h-[48px] items-center gap-2 rounded-full border border-mauve/40 px-6 text-sm font-semibold text-charcoal transition hover:-translate-y-0.5 hover:border-mauve/80"
            >
              Preguntar por WhatsApp <span className="transition-transform group-hover:translate-x-1">→</span>
            </a>
          </>
        )}
      </Reveal>

      <Reveal className="md:flex-[1.5]">
        {FAQS.map(({ q, a }, i) => {
          const isOpen = open === i;
          return (
            <div key={q} className="border-t border-mauve/30 last:border-b">
              <h3 className="m-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex min-h-[64px] w-full items-center justify-between gap-5 py-5 text-left text-lg font-semibold tracking-tight text-charcoal md:py-6 md:text-xl"
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
              {/* Altura animada con grid 0fr -> 1fr: no hace falta medir el contenido. */}
              <div
                id={`faq-${i}`}
                className={`grid transition-[grid-template-rows] duration-500 ease-out ${
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
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
