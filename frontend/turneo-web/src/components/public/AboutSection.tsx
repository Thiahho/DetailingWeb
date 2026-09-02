import { Wallet, MapPin, Banknote, CreditCard, Landmark } from "lucide-react";
import { type SiteConfig } from "@/src/lib/siteConfig";

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

export default function AboutSection({ siteConfig, professionals }: AboutSectionProps) {
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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {professionals.map((pro) => {
              const skills = parseSkills(pro.skills);
              return (
                <div key={pro.id} className="glass-card flex flex-col gap-3 p-5">
                  <div className="flex items-center gap-3">
                    {pro.photoUrl ? (
                      <img
                        src={pro.photoUrl}
                        alt={`${pro.firstName} ${pro.lastName}`}
                        className="h-14 w-14 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                        style={{ backgroundColor: pro.calendarColor || "#D69AA6" }}
                      >
                        {pro.firstName?.[0]}
                        {pro.lastName?.[0]}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-charcoal">
                        {pro.firstName} {pro.lastName}
                      </p>
                      {pro.specialty && (
                        <p className="truncate text-xs text-charcoal/50">{pro.specialty}</p>
                      )}
                      {pro.yearsOfExperience != null && (
                        <p className="truncate text-xs font-medium text-champagne">
                          {pro.yearsOfExperience} {pro.yearsOfExperience === 1 ? "año" : "años"} de experiencia
                        </p>
                      )}
                    </div>
                  </div>

                  {pro.bio && (
                    <p className="text-sm leading-relaxed text-charcoal/70">{pro.bio}</p>
                  )}

                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-blush/10 px-2.5 py-1 text-xs text-blushdark"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
