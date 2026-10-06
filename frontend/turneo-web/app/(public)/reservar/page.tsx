"use client";

import { useState, useEffect } from "react";
import {
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  MapPin,
  MessageCircle,
  Send,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import BookingWizard from "@/src/components/booking/BookingWizard";
import { type BookingPreselection } from "@/src/components/booking/useBookingFlow";
import WhatsAppFloat from "@/src/components/shared/WhatsAppFloat";
import RouletteFloat from "@/src/components/shared/RouletteFloat";
import ReviewsSection, { type NativeReview, type GoogleReview } from "@/src/components/public/ReviewsSection";
import AboutSection, { type TeamSlot } from "@/src/components/public/AboutSection";
import FaqSection from "@/src/components/public/FaqSection";
import HeroSection from "@/src/components/public/HeroSection";
import MobileBookBar from "@/src/components/public/MobileBookBar";
import Reveal from "@/src/components/public/Reveal";
import ServicesSection, { type PublicService } from "@/src/components/public/ServicesSection";
import WorkSection, { type GalleryItem } from "@/src/components/public/WorkSection";
import {
  type SiteConfig,
  formatSocialLinkValue,
  getWhatsAppLink,
  isSafeSocialUrl,
  parseSocialLinks,
} from "@/src/lib/siteConfig";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";
import { getCached, setCached } from "@/src/lib/publicDataCache";

type Service = PublicService;

interface ContentVideo {
  id: number;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  linkUrl?: string | null;
}

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

interface PublicSlot {
  id: number;
  label: string;
  professionalId?: number | null;
}

// Cuántos horarios muestra cada card de profesional
const SLOTS_PER_PROFESSIONAL = 6;

// Insignia de la red sobre la foto de perfil en "Contacto directo": verde de
// WhatsApp y degradé de Instagram, que es como se reconoce cada canal.
const WHATSAPP_BADGE = { backgroundColor: "#1FA855" };
const INSTAGRAM_BADGE = { backgroundImage: "linear-gradient(45deg, #F9CE34, #EE2A7B 55%, #6228D7)" };

// Ícono de una red cargada por el admin según el dominio del link; lo que no
// se reconoce (TikTok, Pinterest, un sitio propio...) usa el globo genérico.
const SOCIAL_ICONS: { hosts: string[]; icon: LucideIcon }[] = [
  { hosts: ["facebook.com", "fb.com", "fb.me"], icon: Facebook },
  { hosts: ["instagram.com"], icon: Instagram },
  { hosts: ["youtube.com", "youtu.be"], icon: Youtube },
  { hosts: ["linkedin.com"], icon: Linkedin },
  { hosts: ["twitter.com", "x.com"], icon: Twitter },
  { hosts: ["t.me", "telegram.me", "telegram.org"], icon: Send },
];

function socialIconFor(url: string): LucideIcon {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const match = SOCIAL_ICONS.find(({ hosts }) => hosts.some((h) => host === h || host.endsWith(`.${h}`)));
    return match?.icon ?? Globe;
  } catch {
    return Globe;
  }
}

interface PublicData {
  services: Service[];
  gallery: GalleryItem[];
  siteconfig: SiteConfig | null;
  contentVideos: ContentVideo[];
  reviews: NativeReview[];
  googleReviews: GoogleReview[];
  professionals: Professional[];
}

export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [preselectedService, setPreselectedService] = useState("");
  const [preselectedServiceKey, setPreselectedServiceKey] = useState(0);
  const [nextSlotLabel, setNextSlotLabel] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  useModalHotkeys(!!selectedService, { onClose: () => setSelectedService(null) });
  const [contentVideos, setContentVideos] = useState<ContentVideo[]>([]);
  const [reviews, setReviews] = useState<NativeReview[]>([]);
  const [googleReviews, setGoogleReviews] = useState<GoogleReview[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [slotsByProfessional, setSlotsByProfessional] = useState<Record<number, TeamSlot[]>>({});
  const [preselection, setPreselection] = useState<BookingPreselection | null>(null);


  useEffect(() => {
    const applyPublicData = (d: Partial<PublicData>) => {
      setServices(Array.isArray(d.services) ? d.services : []);
      setGallery(Array.isArray(d.gallery) ? d.gallery : []);
      setSiteConfig(d.siteconfig ?? null);
      setContentVideos(Array.isArray(d.contentVideos) ? d.contentVideos : []);
      setReviews(Array.isArray(d.reviews) ? d.reviews : []);
      setGoogleReviews(Array.isArray(d.googleReviews) ? d.googleReviews : []);
      setProfessionals(Array.isArray(d.professionals) ? d.professionals : []);
    };

    // Con consentimiento de "preferencias" (src/lib/publicDataCache.ts), pinta
    // primero con lo cacheado en localStorage (instantáneo) y revalida en
    // segundo plano contra la API — sin consentimiento, getCached siempre
    // devuelve null y el comportamiento es igual al de antes (solo fetch).
    const cached = getCached<PublicData>("public-data", 6 * 60 * 60_000);
    if (cached) applyPublicData(cached);

    fetch("/api/public-data")
      .then((r) => r.json())
      .then((d) => {
        applyPublicData(d);
        setCached("public-data", d);
      })
      .catch(() => {});
  }, []);

  // Próximos horarios por profesional para las cards de Equipo. Aparte de
  // public-data a propósito: los slots cambian seguido y no deben quedar en el
  // cache de 6h de localStorage. El endpoint ya viene ordenado por fecha.
  useEffect(() => {
    fetch("/api/timeslots/available", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PublicSlot[]) => {
        const list = Array.isArray(data) ? data : [];
        setNextSlotLabel(list[0]?.label ?? null);
        const grouped: Record<number, TeamSlot[]> = {};
        for (const s of Array.isArray(data) ? data : []) {
          if (!s.professionalId) continue;
          const list = (grouped[s.professionalId] ??= []);
          if (list.length < SLOTS_PER_PROFESSIONAL) list.push({ id: s.id, label: s.label });
        }
        setSlotsByProfessional(grouped);
      })
      .catch(() => {});
  }, []);

  const handleBookWithProfessional = (professionalId: number, slotId?: number) => {
    setPreselection({ professionalId, slotId: slotId ?? null, key: Date.now() });
    setTimeout(() => {
      document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handlePresupuestar = (slug: string) => {
    setPreselectedService(slug);
    setPreselectedServiceKey(Date.now());
    setTimeout(() => {
      document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // siteConfig llega crudo de /api/public-data (o de una copia vieja en
  // localStorage, sin el campo): se valida la forma y se deja solo https. Un
  // link igual al Instagram de los campos fijos no se repite.
  const socialLinks = parseSocialLinks(siteConfig?.socialLinks).filter(
    (link) => isSafeSocialUrl(link.url) && link.url.toLowerCase() !== siteConfig?.instagramUrl?.toLowerCase()
  );

  const jsonLd = siteConfig
    ? {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: siteConfig.businessName,
        url: siteConfig.siteUrl,
        description: siteConfig.metaDescription,
        areaServed: siteConfig.location,
        telephone: siteConfig.whatsAppNumber,
        sameAs: [...(siteConfig.instagramUrl ? [siteConfig.instagramUrl] : []), ...socialLinks.map((link) => link.url)],
      }
    : null;

  const waLink = siteConfig?.whatsAppNumber
    ? getWhatsAppLink(siteConfig.whatsAppNumber)
    : "#";

  // Fotos reales del negocio para el collage de portada: trabajos y, si hay, el local.
  const heroImages = Array.from(
    new Set([gallery[0]?.imageUrl, siteConfig?.localPhotos?.[0], gallery[1]?.imageUrl].filter((u): u is string => !!u))
  );

  // WhatsApp e Instagram muestran el logo del negocio como "foto de perfil",
  // con el ícono de la red como insignia. No se puede traer la foto real del
  // perfil: WhatsApp no la expone y la de Instagram exige su API con la cuenta
  // conectada. En la práctica el logo es la foto de perfil de casi todos los salones.
  const profilePhoto = siteConfig?.logoUrl || "/img/logo.png";

  const contactCards = [
    siteConfig?.whatsAppNumber && {
      label: "WhatsApp",
      value: siteConfig.whatsAppNumber,
      href: waLink,
      icon: MessageCircle,
      dark: false,
      avatar: profilePhoto,
      badgeStyle: WHATSAPP_BADGE,
    },
    siteConfig?.instagramUrl && {
      label: "Instagram",
      value: siteConfig.instagramHandle || "Ver perfil",
      href: siteConfig.instagramUrl,
      icon: Instagram,
      dark: false,
      avatar: profilePhoto,
      badgeStyle: INSTAGRAM_BADGE,
    },
    ...socialLinks.map((link) => ({
      label: link.name,
      value: formatSocialLinkValue(link.url),
      href: link.url,
      icon: socialIconFor(link.url),
      dark: false,
      avatar: null,
      badgeStyle: undefined,
    })),
    siteConfig?.location && {
      label: "Dónde estamos",
      value: siteConfig.location,
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteConfig.location)}`,
      icon: MapPin,
      dark: true,
      avatar: null,
      badgeStyle: undefined,
    },
  ].filter((card): card is Exclude<typeof card, false | "" | undefined | null> => Boolean(card));

  return (
    <main className="min-h-screen bg-cream text-charcoal">
      {jsonLd && (
        <script
          type="application/ld+json"
          // siteConfig es editable por el admin del tenant — JSON.stringify no
          // escapa "</script>", así que un valor con esa secuencia podría
          // cerrar el tag y ejecutar HTML/JS arbitrario en la página pública.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}

      <HeroSection
        siteConfig={siteConfig}
        serviceTitles={services.slice(0, 6).map((service) => service.title)}
        images={heroImages}
        nextSlotLabel={nextSlotLabel}
        waLink={siteConfig?.whatsAppNumber ? waLink : null}
      />

      {services.length > 0 && (
        <ServicesSection services={services} onBook={handlePresupuestar} onDetail={setSelectedService} />
      )}

      {/* GALERÍA + CONTENIDO (fotos de trabajos y reels en una sola sección) */}
      <WorkSection gallery={gallery} videos={contentVideos} profileUrl={siteConfig?.instagramUrl} />

      {/* SOBRE NOSOTROS */}
      <AboutSection
        siteConfig={siteConfig}
        professionals={professionals}
        slotsByProfessional={slotsByProfessional}
        onBook={handleBookWithProfessional}
      />

      {/* RESEÑAS */}
      <ReviewsSection nativeReviews={reviews} googleReviews={googleReviews} />

      {/* FAQ */}
      <FaqSection waLink={siteConfig?.whatsAppNumber ? waLink : null} />

      {/* RESERVAR — conserva el id "contacto" al que apuntan el Navbar y los CTA */}
      <section id="contacto" className="scroll-mt-20 bg-ink py-20 text-cream md:py-28">
        <div className="mx-auto max-w-6xl space-y-10 px-6 md:space-y-12">
          <Reveal className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-blush">Reservá tu turno</span>
            <h2 className="text-4xl font-semibold leading-[1.04] tracking-tight md:text-6xl">
              Cuatro pasos y <span className="accent-serif text-blush">listo.</span>
            </h2>
          </Reveal>
          <BookingWizard
            preselectedService={preselectedService}
            preselectedServiceKey={preselectedServiceKey}
            preselection={preselection}
          />
        </div>
      </section>

      {/* CONTACTO DIRECTO */}
      {contactCards.length > 0 && (
        <section className="mx-auto max-w-6xl space-y-10 px-6 pb-12 pt-20 md:pt-28">
          <Reveal className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-rosewood">Contacto directo</span>
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-charcoal md:text-[3.25rem]">
              Hablemos <span className="accent-serif">cuando quieras</span>
            </h2>
          </Reveal>
          <Reveal stagger className="grid gap-4 md:grid-cols-3 md:gap-5">
            {contactCards.map(({ label, value, href, icon: Icon, dark, avatar, badgeStyle }) => (
              <div key={`${label}|${href}`}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex min-h-[88px] items-center gap-4 rounded-3xl p-5 transition duration-500 ease-out md:min-h-[220px] md:flex-col md:items-start md:justify-between md:p-7 [@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:shadow-elevated ${
                    dark ? "bg-ink text-cream" : "bg-ivory text-charcoal"
                  }`}
                >
                  {avatar ? (
                    <span className="relative shrink-0" data-testid="contact-card-avatar">
                      <img
                        src={avatar}
                        alt=""
                        loading="lazy"
                        className="h-14 w-14 rounded-full border border-mauve/15 bg-white object-contain md:h-16 md:w-16"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-white ring-2 ring-ivory"
                        style={badgeStyle}
                      >
                        <Icon size={13} strokeWidth={2.4} />
                      </span>
                    </span>
                  ) : (
                    <Icon size={28} strokeWidth={1.8} className={`shrink-0 ${dark ? "text-blush" : "text-rosewood"}`} />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-1 md:flex-none">
                    {/* overflow-wrap:anywhere (y no break-words): un link largo sin espacios
                        también tiene que poder cortarse al medir el ancho mínimo de la card. */}
                    <span className={`text-sm [overflow-wrap:anywhere] ${dark ? "text-mist" : "text-charcoal/70"}`}>
                      {label}
                    </span>
                    <span className="text-lg font-semibold tracking-tight [overflow-wrap:anywhere] md:text-[1.35rem]">
                      {value}
                    </span>
                  </span>
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-1 md:hidden">
                    →
                  </span>
                </a>
              </div>
            ))}
          </Reveal>
        </section>
      )}

      <footer className="border-t border-mauve/10 px-6 py-10 text-center text-xs text-charcoal/50">
        <p>
          {siteConfig?.businessName || ""}
          {siteConfig?.locationShort ? ` · ${siteConfig.locationShort}` : ""}
        </p>
        <p className="mt-3 space-x-3">
          <a href="/terminos" className="text-charcoal/40 hover:text-charcoal/60 transition">
            Términos y Condiciones
          </a>
          <span aria-hidden="true">·</span>
          <a href="/privacidad" className="text-charcoal/40 hover:text-charcoal/60 transition">
            Política de Privacidad
          </a>
          <span aria-hidden="true">·</span>
          <a href="/derechos-de-autor" className="text-charcoal/40 hover:text-charcoal/60 transition">
            Derechos de Autor
          </a>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            data-testid="cookie-preferences-footer"
            onClick={() => window.dispatchEvent(new Event("consent-open"))}
            className="text-charcoal/40 hover:text-charcoal/60 transition underline-offset-2 hover:underline"
          >
            Preferencias de cookies
          </button>
        </p>
        {siteConfig && !siteConfig.hideBranding && (
          <a href="/" className="mt-2 inline-block text-charcoal/40 hover:text-charcoal/60 transition">
            Potenciado por Turneo
          </a>
        )}
      </footer>

      {siteConfig?.whatsAppNumber && (
        <WhatsAppFloat whatsappNumber={siteConfig.whatsAppNumber.replace(/\D/g, "")} />
      )}
      <RouletteFloat />
      <MobileBookBar targetId="contacto" />

      {/* MODAL DETALLE SERVICIO */}
      {selectedService && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setSelectedService(null)}
        >
          <div
            className="bg-ivory border border-mauve/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedService.imageUrl && (
              <div className="h-52 overflow-hidden">
                <img src={selectedService.imageUrl} alt={selectedService.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-2xl font-semibold text-charcoal">{selectedService.title}</h2>
                <button onClick={() => setSelectedService(null)} className="text-charcoal/40 hover:text-charcoal transition text-xl shrink-0">✕</button>
              </div>
              {selectedService.description && (
                <p className="text-charcoal/70 text-sm leading-relaxed whitespace-pre-line">{selectedService.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {selectedService.duration && (
                  <span className="rounded-full border border-mauve/15 px-3 py-1 text-xs text-charcoal/60">⏱ {selectedService.duration}</span>
                )}
                <span className="rounded-full border border-blush/40 px-3 py-1 text-xs text-blushdark">${selectedService.price}</span>
              </div>
              {selectedService.details?.length > 0 && (
                <ul className="space-y-1 text-sm text-charcoal/60">
                  {selectedService.details.map((d, i) => (
                    <li key={i} className="flex items-start gap-2"><span className="text-champagne mt-0.5">✓</span> {d}</li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => { setSelectedService(null); handlePresupuestar(selectedService.slug); }}
                className="w-full rounded-full bg-blush px-6 py-3 text-sm font-semibold text-white shadow-glow transition [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]"
              >
                Reservar este servicio
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
