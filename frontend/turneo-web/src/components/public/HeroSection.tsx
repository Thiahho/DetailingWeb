import { Check } from "lucide-react";
import { type SiteConfig } from "@/src/lib/siteConfig";

interface HeroSectionProps {
  siteConfig: SiteConfig | null;
  serviceTitles: string[];
  // Hasta tres imágenes reales del negocio (trabajos / local) para el collage.
  images: string[];
  nextSlotLabel?: string | null;
  waLink: string | null;
}

const DEFAULT_HIGHLIGHTS = ["Confirmación inmediata", "Recordatorio por WhatsApp", "Cancelás desde tu link"];

// Marco de cada foto del collage: posición + desfase de la flotación.
const COLLAGE = [
  { box: "left-0 top-8 h-[62%] w-[52%] md:top-10 md:h-[70%] md:w-[46%]", delay: "0s" },
  { box: "right-0 top-0 h-[48%] w-[44%] md:h-[56%] md:w-[48%]", delay: "-2.5s" },
  { box: "bottom-0 right-[6%] hidden h-[37%] w-[40%] md:block", delay: "-4.5s" },
];

export default function HeroSection({ siteConfig, serviceTitles, images, nextSlotLabel, waLink }: HeroSectionProps) {
  const highlights = siteConfig?.heroHighlights?.length ? siteConfig.heroHighlights : DEFAULT_HIGHLIGHTS;
  const marquee = serviceTitles.length > 0 ? `${serviceTitles.join(" · ")} · ` : "";
  const hasCollage = images.length > 0;

  return (
    <div className="overflow-hidden bg-ink text-cream">
      <section className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-10 pt-12 md:flex-row md:items-center md:gap-16 md:pb-16 md:pt-20">
        <div className="flex min-w-0 flex-col gap-6 md:flex-[1.15] md:gap-7">
          {(siteConfig?.heroBadge || siteConfig?.locationShort) && (
            <span className="flex animate-rise items-center gap-2.5 self-start rounded-full border border-cream/20 px-3.5 py-2 text-[11px] uppercase tracking-[0.16em] text-mist">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blush" />
              {siteConfig.heroBadge || `Reservas online · ${siteConfig.locationShort}`}
            </span>
          )}
          <h1 className="animate-rise text-[3.1rem] font-semibold leading-[0.98] tracking-[-0.035em] [animation-delay:.1s] md:text-7xl lg:text-[5.25rem]">
            {siteConfig?.heroTitle ? (
              siteConfig.heroTitle
            ) : (
              <>
                Tu momento, <span className="accent-serif text-blush">bien reservado.</span>
              </>
            )}
          </h1>
          <p className="max-w-lg animate-rise text-base leading-relaxed text-mist [animation-delay:.2s] md:text-lg">
            {siteConfig?.heroSubtitle ||
              "Elegí el servicio, la profesional y el horario en menos de un minuto. Sin llamadas y sin esperas."}
          </p>
          <div className="flex animate-rise flex-col gap-3 [animation-delay:.3s] sm:flex-row">
            <a
              href="#contacto"
              className="group flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-blush px-8 text-base font-semibold text-ink transition hover:-translate-y-0.5"
            >
              Reservar turno <span className="transition-transform group-hover:translate-x-1">→</span>
            </a>
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[54px] items-center justify-center rounded-full border border-cream/30 px-8 text-base font-medium text-cream transition hover:-translate-y-0.5 hover:border-cream/60"
              >
                Reservar por WhatsApp
              </a>
            ) : (
              <a
                href="#servicios"
                className="flex min-h-[54px] items-center justify-center rounded-full border border-cream/30 px-8 text-base font-medium text-cream transition hover:-translate-y-0.5 hover:border-cream/60"
              >
                Ver servicios
              </a>
            )}
          </div>
          <ul className="mt-2 flex animate-rise flex-col gap-2.5 border-t border-cream/15 pt-5 text-sm text-mist [animation-delay:.4s] sm:flex-row sm:flex-wrap sm:gap-x-8">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check size={16} strokeWidth={2.4} className="shrink-0 text-champagne" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {(hasCollage || nextSlotLabel) && (
          <div
            className={`relative animate-rise [animation-delay:.3s] md:flex-1 ${hasCollage ? "h-[300px] md:h-[540px]" : ""}`}
          >
            {images.slice(0, 3).map((src, i) => (
              <div
                key={src}
                className={`absolute animate-floaty overflow-hidden rounded-3xl bg-inksoft ${COLLAGE[i].box}`}
                style={{ animationDelay: COLLAGE[i].delay }}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
            {nextSlotLabel && (
              <a
                href="#contacto"
                className={`flex animate-floaty items-center gap-3.5 rounded-2xl bg-cream px-5 py-4 text-charcoal shadow-[0_20px_50px_rgba(0,0,0,0.35)] [animation-delay:-1.2s] ${
                  hasCollage ? "absolute bottom-2 right-0 md:bottom-9 md:left-[8%] md:right-auto" : "self-start"
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-rosewood" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-charcoal/70">Próximo horario libre</span>
                  <span className="text-base font-semibold">{nextSlotLabel}</span>
                </span>
              </a>
            )}
          </div>
        )}
      </section>

      {marquee && (
        <div aria-hidden="true" className="pb-8 md:pb-10">
          <div className="flex w-max animate-marquee whitespace-nowrap font-serif text-[2.6rem] italic text-cream/40 md:text-7xl">
            <span className="pr-6">{marquee.repeat(3)}</span>
            <span className="pr-6">{marquee.repeat(3)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
