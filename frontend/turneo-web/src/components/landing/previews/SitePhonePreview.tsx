import { Star } from "lucide-react";

// Preview ilustrativo (salón ficticio): la página pública de un salón dentro de
// un teléfono — portada, servicios, equipo, reseñas y el botón de reserva.
// Decorativo, va sobre fondo ink.

const SERVICES = [
  { name: "Color", meta: "2 h", tone: "bg-blush/50" },
  { name: "Esculpidas", meta: "1 h 30", tone: "bg-champagne/50" },
  { name: "Lifting", meta: "1 h", tone: "bg-lavender/70" },
];

const TEAM = [
  { initial: "C", name: "Caro", tone: "bg-blush" },
  { initial: "M", name: "Maru", tone: "bg-champagne" },
  { initial: "S", name: "Sol", tone: "bg-lavender" },
];

export default function SitePhonePreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[20rem] select-none">
      <div className="rounded-[2.8rem] bg-inksoft p-2.5 shadow-[0_30px_70px_rgba(0,0,0,0.5)] ring-1 ring-cream/15">
        <div className="overflow-hidden rounded-[2.3rem] bg-cream text-charcoal">
          {/* Portada */}
          <div className="bg-ink px-5 pb-6 pt-4 text-cream">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span>Estudio Alma</span>
              <span className="h-4 w-14 rounded-full bg-black/60" />
              <span className="text-mist">Menú</span>
            </div>
            <p className="mt-6 text-[1.7rem] font-semibold leading-[1] tracking-tight">
              Tu momento, <span className="accent-serif text-blush">bien reservado.</span>
            </p>
            <span className="mt-4 inline-flex rounded-full bg-blush px-4 py-2 text-xs font-semibold text-ink">Reservar turno →</span>
          </div>

          {/* Servicios */}
          <div className="px-5 pt-5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-rosewood">Servicios</p>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {SERVICES.map((s) => (
                <div key={s.name} className="overflow-hidden rounded-2xl bg-ivory">
                  <div className={`h-12 ${s.tone}`} />
                  <div className="px-2 py-1.5">
                    <p className="truncate text-[11px] font-semibold">{s.name}</p>
                    <p className="text-[9px] text-charcoal/60">{s.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Equipo */}
          <div className="px-5 pt-5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-rosewood">El equipo</p>
            <div className="mt-2.5 flex gap-4">
              {TEAM.map((t) => (
                <div key={t.name} className="flex flex-col items-center gap-1">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-ink ${t.tone}`}>
                    {t.initial}
                  </span>
                  <span className="text-[10px] font-medium text-charcoal/70">{t.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reseña */}
          <div className="px-5 pb-6 pt-5">
            <div className="rounded-2xl bg-ivory p-3.5">
              <div className="flex gap-0.5 text-champagne">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} size={12} fill="currentColor" strokeWidth={0} />
                ))}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-charcoal/80">
                «Muy buena atención, vuelvo seguro.»
              </p>
              <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-charcoal/50">Reseña de ejemplo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dirección propia */}
      <div className="absolute -bottom-5 -right-3 animate-floaty rounded-2xl bg-ivory px-4 py-3 text-charcoal shadow-[0_20px_50px_rgba(0,0,0,0.35)] sm:-right-14 sm:bottom-16">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-charcoal/60">Link para tu bio</p>
        <p className="text-sm font-semibold">La web de tu salón</p>
      </div>
    </div>
  );
}
