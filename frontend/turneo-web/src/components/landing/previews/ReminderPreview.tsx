import { Mail, RotateCcw } from "lucide-react";

// Preview ilustrativo (datos ficticios): el email de recordatorio que recibe la
// clienta y la automatización de reactivación. Decorativo, va sobre fondo ink.

const INACTIVE = [
  { name: "Agustina R.", since: "Sin turno hace 2 meses", status: "Mensaje enviado", sent: true },
  { name: "Paula M.", since: "Sin turno hace 3 meses", status: "Mensaje enviado", sent: true },
  { name: "Daniela F.", since: "Cumple el viernes", status: "Programado", sent: false },
];

export default function ReminderPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto max-w-md select-none pb-36 sm:pb-24 lg:max-w-none">
      {/* Email de recordatorio */}
      <div className="mr-6 rounded-[1.75rem] bg-ivory p-5 text-charcoal shadow-[0_24px_60px_rgba(0,0,0,0.4)] sm:mr-16 sm:p-6">
        <div className="flex items-center gap-3 border-b border-mauve/20 pb-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-cream">
            <Mail size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Estudio Alma</p>
            <p className="truncate text-xs text-charcoal/60">Recordatorio de tu turno</p>
          </div>
          <span className="shrink-0 rounded-full bg-cream px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-charcoal/70">
            Automático
          </span>
        </div>
        <p className="pt-4 text-[15px] leading-relaxed text-charcoal/80">
          Hola Juli, te esperamos <strong className="font-semibold text-charcoal">mañana a las 16:00</strong> para tu turno
          de Color con Caro.
        </p>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-cream p-3.5">
          <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-ink text-cream">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-mist">Jue</span>
            <span className="text-lg font-semibold leading-none">15</span>
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-semibold">Color · 16:00 hs</p>
            <p className="truncate text-charcoal/60">con Caro · 2 h</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2 text-xs font-semibold">
          <span className="rounded-full border border-mauve/40 px-3.5 py-2">Reprogramar</span>
          <span className="rounded-full border border-mauve/40 px-3.5 py-2">Cancelar turno</span>
        </div>
      </div>

      {/* Automatización de reactivación */}
      <div className="absolute bottom-0 right-0 w-[78%] rounded-3xl bg-inksoft p-4 text-cream shadow-[0_24px_60px_rgba(0,0,0,0.45)] ring-1 ring-cream/10 sm:w-[62%] sm:p-5">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-blush">
          <RotateCcw size={13} strokeWidth={2.2} /> Reactivación
        </p>
        <ul className="mt-3 space-y-2.5">
          {INACTIVE.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{c.name}</span>
                <span className="block truncate text-mist">{c.since}</span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  c.sent ? "bg-champagne/25 text-champagne" : "border border-cream/25 text-mist"
                }`}
              >
                {c.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
