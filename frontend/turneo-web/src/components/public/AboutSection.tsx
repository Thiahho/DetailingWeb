import { Wallet, MapPin, Banknote, CreditCard, Landmark } from "lucide-react";
import { type SiteConfig } from "@/src/lib/siteConfig";

interface Professional {
  id: number;
  firstName: string;
  lastName: string;
  photoUrl: string;
  calendarColor: string;
  specialty?: string;
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {professionals.map((pro) => (
              <div key={pro.id} className="glass-card flex items-center gap-3 p-4">
                {pro.photoUrl ? (
                  <img
                    src={pro.photoUrl}
                    alt={`${pro.firstName} ${pro.lastName}`}
                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
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
                </div>
              </div>
            ))}
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
