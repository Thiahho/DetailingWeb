// Preview ilustrativo de la agenda semanal (datos ficticios). Es decorativo:
// va con aria-hidden y la información real está en el texto del hero.

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HOURS = ["9", "10", "11", "12", "13", "14", "15", "16"];

const PROFESSIONALS = {
  caro: { name: "Caro", chip: "bg-blush/35 border-blushdark/50", dot: "bg-blushdark" },
  maru: { name: "Maru", chip: "bg-champagne/35 border-champagne", dot: "bg-champagne" },
  sol: { name: "Sol", chip: "bg-lavender/60 border-mauve/50", dot: "bg-mauve" },
} as const;

type ProKey = keyof typeof PROFESSIONALS;

// day: 0-5 (columna), start: 0-7 (fila de hora), span: horas que ocupa.
const BOOKINGS: { day: number; start: number; span: number; pro: ProKey; client: string; service: string }[] = [
  { day: 0, start: 0, span: 2, pro: "caro", client: "Juli", service: "Color" },
  { day: 0, start: 3, span: 1, pro: "sol", client: "Meli", service: "Cejas" },
  { day: 0, start: 5, span: 2, pro: "maru", client: "Vale", service: "Semi" },
  { day: 1, start: 1, span: 1, pro: "maru", client: "Flor", service: "Kapping" },
  { day: 1, start: 2, span: 2, pro: "caro", client: "Agus", service: "Balayage" },
  { day: 1, start: 6, span: 1, pro: "sol", client: "Lu", service: "Lifting" },
  { day: 2, start: 0, span: 1, pro: "sol", client: "Cami", service: "Pestañas" },
  { day: 2, start: 2, span: 1, pro: "maru", client: "Sofi", service: "Semi" },
  { day: 2, start: 4, span: 3, pro: "caro", client: "Pau", service: "Alisado" },
  { day: 3, start: 1, span: 2, pro: "caro", client: "Romi", service: "Color" },
  { day: 3, start: 4, span: 1, pro: "maru", client: "Dani", service: "Esculpidas" },
  { day: 3, start: 6, span: 2, pro: "sol", client: "Euge", service: "Pestañas" },
  { day: 4, start: 0, span: 2, pro: "maru", client: "Mica", service: "Esculpidas" },
  { day: 4, start: 2, span: 1, pro: "sol", client: "Jime", service: "Cejas" },
  { day: 4, start: 3, span: 2, pro: "caro", client: "Belu", service: "Corte" },
  { day: 4, start: 6, span: 1, pro: "maru", client: "Nati", service: "Semi" },
  { day: 5, start: 0, span: 1, pro: "caro", client: "Ana", service: "Brushing" },
  { day: 5, start: 1, span: 2, pro: "sol", client: "Guada", service: "Pestañas" },
  { day: 5, start: 3, span: 2, pro: "maru", client: "Luli", service: "Kapping" },
];

export default function AgendaPreview() {
  return (
    <div aria-hidden="true" className="relative select-none">
      <div className="overflow-hidden rounded-[1.75rem] bg-cream text-charcoal shadow-[0_30px_70px_rgba(0,0,0,0.45)]">
        {/* Barra superior del panel */}
        <div className="flex items-center justify-between gap-3 border-b border-mauve/20 bg-ivory px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-charcoal/60">Agenda</p>
            <p className="truncate text-sm font-semibold sm:text-base">Semana del 12 al 17</p>
          </div>
          <div className="flex shrink-0 rounded-full bg-cream p-1 text-[11px] font-semibold">
            <span className="rounded-full px-3 py-1 text-charcoal/60">Día</span>
            <span className="rounded-full bg-ink px-3 py-1 text-cream">Semana</span>
          </div>
        </div>

        {/* Profesionales */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-3 text-[11px] font-medium text-charcoal/70 sm:px-5">
          {Object.values(PROFESSIONALS).map((p) => (
            <span key={p.name} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${p.dot}`} />
              {p.name}
            </span>
          ))}
        </div>

        {/* Grilla: columna de horas + seis días */}
        <div className="grid grid-cols-[1.5rem_repeat(6,minmax(0,1fr))] gap-x-1 px-3 pb-4 pt-2 sm:grid-cols-[2rem_repeat(6,minmax(0,1fr))] sm:gap-x-1.5 sm:px-5 sm:pb-5">
          <span />
          {DAYS.map((d) => (
            <span key={d} className="pb-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-charcoal/60">
              {d}
            </span>
          ))}
          <div className="grid grid-rows-[repeat(8,2.25rem)] text-right text-[10px] text-charcoal/50 sm:grid-rows-[repeat(8,2.5rem)]">
            {HOURS.map((h) => (
              <span key={h} className="-translate-y-1.5 pr-1">
                {h}
              </span>
            ))}
          </div>
          {DAYS.map((d, dayIndex) => (
            <div
              key={d}
              className="grid grid-rows-[repeat(8,2.25rem)] rounded-lg bg-ivory/70 [background-image:linear-gradient(to_bottom,rgba(156,124,136,0.16)_1px,transparent_1px)] [background-size:100%_2.25rem] sm:grid-rows-[repeat(8,2.5rem)] sm:[background-size:100%_2.5rem]"
            >
              {BOOKINGS.filter((b) => b.day === dayIndex).map((b) => (
                <div
                  key={`${b.day}-${b.start}`}
                  style={{ gridRow: `${b.start + 1} / span ${b.span}` }}
                  className={`m-px overflow-hidden rounded-md border-l-2 px-1 py-0.5 leading-tight sm:px-1.5 sm:py-1 ${PROFESSIONALS[b.pro].chip}`}
                >
                  <p className="truncate text-[10px] font-semibold sm:text-[11px]">{b.client}</p>
                  <p className="hidden truncate text-[10px] text-charcoal/70 sm:block">{b.service}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Aviso flotante de reserva nueva */}
      <div className="absolute -bottom-6 left-4 flex animate-floaty items-center gap-3 rounded-2xl bg-ivory px-4 py-3 text-charcoal shadow-[0_20px_50px_rgba(0,0,0,0.35)] sm:-bottom-7 sm:-left-6">
        <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-rosewood" />
        <span className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-charcoal/60">Reserva nueva · online</span>
          <span className="text-sm font-semibold">Jue 15:00 · Color con Caro</span>
        </span>
      </div>
    </div>
  );
}
