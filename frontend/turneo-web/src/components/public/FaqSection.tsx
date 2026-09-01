import { ChevronDown } from "lucide-react";

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

export default function FaqSection() {
  return (
    <section id="preguntas" className="mx-auto max-w-6xl space-y-10 px-6 py-16">
      <div className="space-y-3">
        <span className="badge">Preguntas frecuentes</span>
        <h3 className="text-3xl font-semibold text-charcoal">¿Tenés dudas?</h3>
      </div>

      <div className="space-y-3">
        {FAQS.map(({ q, a }) => (
          <details key={q} className="group glass-card overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-sm font-medium text-charcoal">
              {q}
              <ChevronDown
                size={18}
                className="shrink-0 text-charcoal/40 transition-transform duration-200 group-open:rotate-180"
              />
            </summary>
            <p className="px-6 pb-5 text-sm leading-relaxed text-charcoal/60">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
