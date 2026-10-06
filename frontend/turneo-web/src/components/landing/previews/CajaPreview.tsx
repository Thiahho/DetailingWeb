// Preview ilustrativo (montos ficticios, no son cifras de ningún salón): la caja
// del día por medio de pago y el reparto por profesional. Decorativo, sobre ink.

const METHODS = [
  { label: "Efectivo", amount: "$ 86.000", width: "w-[47%]", color: "bg-champagne" },
  { label: "Transferencia", amount: "$ 64.500", width: "w-[35%]", color: "bg-blush" },
  { label: "Tarjeta", amount: "$ 34.000", width: "w-[18%]", color: "bg-lavender" },
];

const BY_PROFESSIONAL = [
  { name: "Caro", turns: "5 turnos", bar: "w-[92%]", color: "bg-blush" },
  { name: "Maru", turns: "4 turnos", bar: "w-[64%]", color: "bg-champagne" },
  { name: "Sol", turns: "3 turnos", bar: "w-[48%]", color: "bg-lavender" },
];

export default function CajaPreview() {
  return (
    <div aria-hidden="true" className="mx-auto grid max-w-md select-none gap-4 sm:max-w-none sm:grid-cols-5">
      {/* Caja del día */}
      <div className="rounded-[1.75rem] bg-ivory p-5 text-charcoal shadow-[0_24px_60px_rgba(0,0,0,0.4)] sm:col-span-3 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-charcoal/60">Caja de hoy</p>
          <span className="flex items-center gap-1.5 rounded-full bg-cream px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-charcoal/70">
            <span className="h-1.5 w-1.5 rounded-full bg-rosewood" /> Abierta
          </span>
        </div>
        <p className="mt-3 text-4xl font-semibold tracking-tight sm:text-[2.6rem]">$ 184.500</p>
        <p className="mt-2 text-xs text-charcoal/60">12 turnos atendidos · 2 señas</p>

        <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-cream">
          {METHODS.map((m) => (
            <span key={m.label} className={`${m.width} ${m.color}`} />
          ))}
        </div>
        <ul className="mt-4 space-y-2.5 text-sm">
          {METHODS.map((m) => (
            <li key={m.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-charcoal/70">
                <span className={`h-2 w-2 rounded-full ${m.color}`} />
                {m.label}
              </span>
              <span className="font-semibold">{m.amount}</span>
            </li>
          ))}
        </ul>
        <span className="mt-5 flex items-center justify-center rounded-full bg-ink py-2.5 text-xs font-semibold text-cream">
          Cerrar caja
        </span>
      </div>

      {/* Por profesional */}
      <div className="rounded-[1.75rem] bg-inksoft p-5 text-cream ring-1 ring-cream/10 sm:col-span-2 sm:self-end sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blush">Por profesional</p>
        <ul className="mt-4 space-y-4">
          {BY_PROFESSIONAL.map((p) => (
            <li key={p.name} className="space-y-1.5">
              <span className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold">{p.name}</span>
                <span className="text-xs text-mist">{p.turns}</span>
              </span>
              <span className="block h-2 overflow-hidden rounded-full bg-cream/10">
                <span className={`block h-full rounded-full ${p.bar} ${p.color}`} />
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-5 border-t border-cream/15 pt-3 text-xs text-mist">Comisiones calculadas por turno atendido.</p>
      </div>
    </div>
  );
}
