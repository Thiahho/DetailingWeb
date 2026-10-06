import { Check, Minus } from "lucide-react";

// Preview ilustrativo (datos ficticios): el panel propio de una profesional y
// la matriz de permisos por módulo del personal. Decorativo, sobre fondo ink.

const TODAY = [
  { time: "10:00", client: "Juli", service: "Color" },
  { time: "12:30", client: "Agus", service: "Balayage" },
  { time: "16:00", client: "Romi", service: "Corte" },
];

const ACTIONS = ["Ver", "Crear", "Editar", "Borrar"];
const PERMISSIONS: { module: string; allowed: boolean[] }[] = [
  { module: "Turnos", allowed: [true, true, true, false] },
  { module: "Clientes", allowed: [true, true, false, false] },
  { module: "Caja", allowed: [true, false, false, false] },
  { module: "Insumos", allowed: [false, false, false, false] },
];

export default function TeamPreview() {
  return (
    <div aria-hidden="true" className="mx-auto flex max-w-md select-none flex-col gap-4 sm:max-w-none sm:flex-row sm:items-start">
      {/* Panel de la profesional */}
      <div className="rounded-[1.75rem] bg-inksoft p-5 text-cream ring-1 ring-cream/10 sm:mt-10 sm:flex-[0.85]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blush text-base font-semibold text-ink">
            C
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Caro</p>
            <p className="truncate text-xs text-mist">Mi agenda · hoy</p>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {TODAY.map((t) => (
            <li key={t.time} className="flex items-center gap-3 rounded-2xl bg-ink px-3 py-2.5 text-sm">
              <span className="w-11 shrink-0 font-semibold text-blush">{t.time}</span>
              <span className="min-w-0 flex-1 truncate">
                {t.client} <span className="text-mist">· {t.service}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-cream/15 pt-3 text-xs text-mist">Solo ve sus turnos y sus comisiones.</p>
      </div>

      {/* Permisos por módulo */}
      <div className="rounded-[1.75rem] bg-ivory p-5 text-charcoal shadow-[0_24px_60px_rgba(0,0,0,0.4)] sm:flex-1 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-charcoal/60">Permisos</p>
        <p className="mt-1 text-base font-semibold">Recepción</p>
        <div className="mt-4 grid grid-cols-[1fr_repeat(4,2.75rem)] items-center gap-y-1 text-center">
          <span />
          {ACTIONS.map((a) => (
            <span key={a} className="pb-1 text-[9px] font-semibold uppercase text-charcoal/60">
              {a}
            </span>
          ))}
          {PERMISSIONS.map((p) => (
            <div key={p.module} className="col-span-5 grid grid-cols-subgrid items-center border-t border-mauve/15 py-2.5">
              <span className="text-left text-sm font-semibold">{p.module}</span>
              {p.allowed.map((ok, i) => (
                <span
                  key={ACTIONS[i]}
                  className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full ${
                    ok ? "bg-ink text-cream" : "bg-cream text-charcoal/40"
                  }`}
                >
                  {ok ? <Check size={13} strokeWidth={3} /> : <Minus size={13} strokeWidth={2.4} />}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
