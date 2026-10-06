import { Check } from "lucide-react";

// Preview ilustrativo (datos ficticios): el paso "horario" de la reserva online
// en un teléfono, fuera de hora, y la tarjeta del portal "Mis turnos".
// Decorativo, va sobre fondo cream.

const STEPS = ["Servicio", "Profesional", "Horario", "Datos"];
const ACTIVE_STEP = 2;
const DAYS = [
  { dow: "Jue", day: "15" },
  { dow: "Vie", day: "16" },
  { dow: "Sáb", day: "17" },
  { dow: "Lun", day: "19" },
];
const SLOTS = ["10:00", "11:30", "14:00", "16:00", "17:30", "19:00"];
const SELECTED_SLOT = "16:00";

export default function BookingPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto max-w-md select-none pb-16 lg:max-w-none lg:pb-12">
      {/* Teléfono con el paso de horario */}
      <div className="mx-auto w-[82%] max-w-[19rem] rounded-[2.6rem] bg-ink p-2.5 shadow-elevated lg:ml-6">
        <div className="overflow-hidden rounded-[2.1rem] bg-cream">
          <div className="flex items-center justify-between px-6 pb-1 pt-3 text-[11px] font-semibold text-charcoal">
            <span>23:47</span>
            <span className="h-4 w-16 rounded-full bg-ink" />
            <span className="text-charcoal/60">Dom</span>
          </div>
          <div className="space-y-4 px-4 pb-5 pt-3">
            <div className="flex items-center gap-1.5">
              {STEPS.map((step, i) => (
                <span key={step} className="flex flex-1 flex-col gap-1.5">
                  <span className={`h-1 rounded-full ${i <= ACTIVE_STEP ? "bg-rosewood" : "bg-mauve/25"}`} />
                  <span className={`truncate text-[9px] font-semibold ${i === ACTIVE_STEP ? "text-charcoal" : "text-charcoal/50"}`}>
                    {step}
                  </span>
                </span>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-rosewood">Paso 3 de 4</p>
              <p className="text-lg font-semibold leading-tight tracking-tight text-charcoal">
                Elegí el <span className="accent-serif text-rosewood">horario</span>
              </p>
              <p className="mt-0.5 text-[11px] text-charcoal/60">Color · con Caro</p>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {DAYS.map((d, i) => (
                <span
                  key={d.day}
                  className={`flex flex-col items-center rounded-xl py-2 ${
                    i === 0 ? "bg-ink text-cream" : "bg-ivory text-charcoal"
                  }`}
                >
                  <span className={`text-[9px] font-semibold uppercase ${i === 0 ? "text-mist" : "text-charcoal/60"}`}>{d.dow}</span>
                  <span className="text-sm font-semibold">{d.day}</span>
                </span>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {SLOTS.map((slot) => (
                <span
                  key={slot}
                  className={`rounded-full py-2 text-center text-xs font-semibold ${
                    slot === SELECTED_SLOT ? "bg-blush text-ink" : "border border-mauve/30 bg-ivory text-charcoal"
                  }`}
                >
                  {slot}
                </span>
              ))}
            </div>
            <span className="flex items-center justify-center rounded-full bg-ink py-3 text-xs font-semibold text-cream">
              Continuar →
            </span>
          </div>
        </div>
      </div>

      {/* Portal "Mis turnos" */}
      <div className="absolute bottom-0 right-0 w-[70%] max-w-[17rem] rounded-3xl bg-ivory p-4 text-charcoal shadow-elevated ring-1 ring-mauve/15 sm:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rosewood">Mis turnos</p>
        <p className="mt-2 flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-cream">
            <Check size={12} strokeWidth={3} />
          </span>
          Jue 15 · 16:00 hs
        </p>
        <p className="mt-0.5 pl-7 text-xs text-charcoal/60">Color · con Caro</p>
        <div className="mt-3 flex gap-1.5 text-[11px] font-semibold">
          <span className="rounded-full bg-cream px-3 py-1.5">Reprogramar</span>
          <span className="rounded-full bg-cream px-3 py-1.5">Cancelar</span>
        </div>
      </div>
    </div>
  );
}
