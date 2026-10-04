import { Wallet, MapPin, Banknote, CreditCard, Landmark } from "lucide-react";
import { type SiteConfig } from "@/src/lib/siteConfig";
import TeamCarousel from "@/src/components/public/TeamCarousel";

interface Professional {
  id: number;
  firstName: string;
  lastName: string;
  photoUrl: string;
  calendarColor: string;
  specialty?: string;
  bio?: string | null;
  yearsOfExperience?: number | null;
  skills?: string | null;
  services?: { id: number; title: string }[];
}

export interface TeamSlot {
  id: number;
  label: string;
}

// El backend guarda Skills como JSON (mismo criterio que Schedule) — se parsea acá.
function parseSkills(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

interface AboutSectionProps {
  siteConfig: SiteConfig | null;
  professionals: Professional[];
  slotsByProfessional?: Record<number, TeamSlot[]>;
  onBook?: (professionalId: number, slotId?: number) => void;
}

// Formas de pago genéricas del rubro — no hay un campo propio en SiteConfig
// para esto todavía. Si en el futuro se necesita que el dueño las edite desde
// el panel, este es el punto a reemplazar por un fetch (ver "Empresa" /
// BusinessSettings para el mismo tipo de configuración editable).
const PAYMENT_METHODS = [
  { label: "Efectivo", icon: Banknote },
  { label: "Transferencia", icon: Landmark },
  { label: "Tarjeta de crédito/débito", icon: CreditCard },
  { label: "Mercado Pago", icon: Wallet },
];

export default function AboutSection({ siteConfig, professionals, slotsByProfessional, onBook }: AboutSectionProps) {
  const businessName = siteConfig?.businessName || "Nuestro equipo";

  return (
    <section id="nosotros" className="mx-auto max-w-6xl space-y-10 px-6 py-16">
      <div className="space-y-3">
        <span className="badge">Sobre nosotros</span>
        <h3 className="text-3xl font-semibold text-charcoal">Conocé {businessName}</h3>
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        {/* Historia */}
        <div className="glass-card space-y-3 p-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-blushdark">01 · Historia</span>
          <p className="text-sm leading-relaxed text-charcoal/70">
            {businessName} nació con una idea simple: que cada visita se sienta cuidada, de principio a
            fin. Con el tiempo eso se tradujo en un equipo propio, una agenda pensada para no hacerte
            esperar, y un espacio donde volver es lo más fácil de todo.
          </p>
        </div>

        {/* Formas de pago */}
        <div className="glass-card space-y-4 p-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-blushdark">
            02 · Formas de pago
          </span>
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_METHODS.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-xl border border-mauve/10 bg-white px-3 py-2.5 text-sm text-charcoal/70"
              >
                <Icon size={16} className="shrink-0 text-champagne" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Equipo */}
      {professionals.length > 0 && (
        <div className="space-y-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-blushdark">
            03 · Equipo
          </span>
          <TeamCarousel>
            {professionals.map((pro) => {
              const skills = parseSkills(pro.skills);
              const slots = slotsByProfessional?.[pro.id] ?? [];
              const fullName = `${pro.firstName} ${pro.lastName}`;
              return (
                <article
                  key={pro.id}
                  data-testid="team-professional-card"
                  className="glass-card flex h-full w-full flex-col overflow-hidden"
                >
                  <div className="relative h-52 w-full shrink-0">
                    {pro.photoUrl ? (
                      <img
                        src={pro.photoUrl}
                        alt={fullName}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <span
                        className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-white"
                        style={{ backgroundColor: pro.calendarColor || "#D69AA6" }}
                      >
                        {pro.firstName?.[0]}
                        {pro.lastName?.[0]}
                      </span>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
                    <div>
                      <h4 className="text-lg font-semibold text-charcoal">{fullName}</h4>
                      {pro.specialty && (
                        <p className="text-sm text-charcoal/60">{pro.specialty}</p>
                      )}
                      {pro.yearsOfExperience != null && (
                        <p className="text-xs font-medium text-champagne">
                          {pro.yearsOfExperience} {pro.yearsOfExperience === 1 ? "año" : "años"} de experiencia
                        </p>
                      )}
                    </div>

                    {pro.bio && (
                      <p className="line-clamp-3 text-sm leading-relaxed text-charcoal/70">{pro.bio}</p>
                    )}

                    {skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {skills.slice(0, 4).map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full bg-blush/10 px-2.5 py-1 text-xs text-blushdark"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    {pro.services && pro.services.length > 0 && (
                      <p className="line-clamp-2 text-xs text-charcoal/50">
                        <span className="font-medium text-charcoal/60">Servicios: </span>
                        {pro.services.map((s) => s.title).join(" · ")}
                      </p>
                    )}

                    <div className="mt-auto space-y-3 border-t border-mauve/10 pt-3">
                      <span className="text-xs font-semibold uppercase tracking-widest text-blushdark">
                        Próximos horarios
                      </span>
                      {slots.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {slots.slice(0, 4).map((slot) => (
                            <button
                              key={slot.id}
                              type="button"
                              data-testid="team-slot-chip"
                              onClick={() => onBook?.(pro.id, slot.id)}
                              className="rounded-full border border-mauve/15 bg-white px-2.5 py-1 text-[11px] text-charcoal/70 transition hover:border-blush hover:text-blushdark"
                            >
                              {slot.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-charcoal/50">Sin horarios cargados por el momento.</p>
                      )}
                      <button
                        type="button"
                        data-testid="team-book-button"
                        onClick={() => onBook?.(pro.id)}
                        className="w-full rounded-full bg-blush px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]"
                      >
                        {slots.length > 0 ? "Ver más horarios" : `Reservar con ${pro.firstName}`}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </TeamCarousel>
        </div>
      )}

      {/* Ubicación */}
      {siteConfig?.location && (
        <div className="glass-card flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-start gap-3">
            <MapPin size={20} className="mt-0.5 shrink-0 text-champagne" />
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-blushdark">
                04 · Ubicación
              </span>
              <p className="mt-1 text-sm text-charcoal/70">{siteConfig.location}</p>
            </div>
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteConfig.location)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-mauve/20 px-5 py-2.5 text-sm text-charcoal/80 transition hover:border-blush hover:text-charcoal"
          >
            Cómo llegar →
          </a>
        </div>
      )}
    </section>
  );
}
