"use client";

import { useState, useEffect } from "react";
import { MapPin } from "lucide-react";
import BookingForm from "@/src/components/booking/BookingForms";
import WhatsAppFloat from "@/src/components/shared/WhatsAppFloat";
import RouletteFloat from "@/src/components/shared/RouletteFloat";
import ReviewsSection, { type NativeReview, type GoogleReview } from "@/src/components/public/ReviewsSection";
import GalleryCarousel from "@/src/components/public/GalleryCarousel";
import AboutSection from "@/src/components/public/AboutSection";
import FaqSection from "@/src/components/public/FaqSection";
import { type SiteConfig, getWhatsAppLink, extractMapEmbedSrc } from "@/src/lib/siteConfig";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";
import { getCached, setCached } from "@/src/lib/publicDataCache";

interface Service {
  id: number;
  title: string;
  slug: string;
  price: string;
  duration: string | null;
  imageUrl: string;
  description: string;
  details: string[];
  customFieldsSchema?: string;
}

interface GalleryItem {
  id: number;
  title: string;
  tag: string;
  imageUrl: string;
}

interface ContentVideo {
  id: number;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
}

interface Professional {
  id: number;
  firstName: string;
  lastName: string;
  photoUrl: string;
  calendarColor: string;
  specialty?: string;
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
  const [visiblePacks, setVisiblePacks] = useState(3);
  const [preselectedService, setPreselectedService] = useState("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  useModalHotkeys(!!selectedService, { onClose: () => setSelectedService(null) });
  const [contentVideos, setContentVideos] = useState<ContentVideo[]>([]);
  const [reviews, setReviews] = useState<NativeReview[]>([]);
  const [googleReviews, setGoogleReviews] = useState<GoogleReview[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);

  const packsToShow = services.slice(0, visiblePacks);

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

  const reels =
    contentVideos.length > 0
      ? contentVideos
      : [
          // { id: 1, title: "Video destacado 1", videoUrl: "/video/V1.mp4", thumbnailUrl: "" },
          // { id: 2, title: "Video destacado 2", videoUrl: "/video/V2.mp4", thumbnailUrl: "" },
        ];

  const handlePresupuestar = (slug: string) => {
    setPreselectedService(slug);
    setTimeout(() => {
      document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const jsonLd = siteConfig
    ? {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: siteConfig.businessName,
        url: siteConfig.siteUrl,
        description: siteConfig.metaDescription,
        areaServed: siteConfig.location,
        telephone: siteConfig.whatsAppNumber,
        sameAs: siteConfig.instagramUrl ? [siteConfig.instagramUrl] : [],
      }
    : null;

  const waLink = siteConfig?.whatsAppNumber
    ? getWhatsAppLink(siteConfig.whatsAppNumber)
    : "#";

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

      {/* HERO */}
      <div className="hero-grid">
        <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-10 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            {siteConfig?.heroBadge && (
              <span className="badge">{siteConfig.heroBadge}</span>
            )}
            {siteConfig?.heroTitle && (
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-charcoal md:text-5xl">
                {siteConfig.heroTitle}
              </h1>
            )}
            {siteConfig?.heroSubtitle && (
              <p className="text-base text-charcoal/70 md:text-lg">
                {siteConfig.heroSubtitle}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <a
                className="rounded-full bg-blush px-6 py-3 text-sm font-semibold text-white shadow-glow transition [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]"
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Reservar por WhatsApp
              </a>
              <a
                className="rounded-full border border-mauve/20 px-6 py-3 text-sm text-charcoal/80 transition hover:border-blush hover:text-charcoal"
                href="#contacto"
              >
                Consulta online
              </a>
            </div>
          </div>

          <div className="glass-card space-y-6 p-6">
            <h3 className="text-2xl font-semibold text-charcoal">
              {siteConfig?.businessName || "Nuestros servicios"}
            </h3>
            <div className="space-y-3 text-sm text-charcoal/70">
              {(siteConfig?.heroHighlights?.length
                ? siteConfig.heroHighlights
                : services.slice(0, 2).map((s) => s.title)
              ).map((highlight) => (
                <p key={highlight}>✓ {highlight}</p>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* SERVICIOS */}
      <section id="servicios" className="mx-auto max-w-6xl space-y-10 px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-3">
            <span className="badge">Servicios</span>
            <h3 className="text-3xl font-semibold text-charcoal">Servicios disponibles</h3>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {packsToShow.map((pack) => (
            <article key={pack.id} data-testid="reservar-service-card" className="glass-card flex h-full flex-col gap-4 p-6">
              <div className="overflow-hidden rounded-xl border border-mauve/10">
                <img
                  alt={pack.title}
                  className="h-40 w-full object-cover transition-transform duration-500 hover:scale-105"
                  src={pack.imageUrl}
                />
              </div>
              <h4 className="text-xl font-semibold text-charcoal">{pack.title}</h4>
              <ul className="space-y-2 text-sm text-charcoal/60 mb-4">
                {pack.details?.map((detail, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-champagne text-xs">✓</span> {detail}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-4 border-t border-mauve/10 space-y-2">
                <span className="text-lg font-semibold text-blushdark block">${pack.price}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedService(pack)}
                    className="flex-1 text-center rounded-full border border-mauve/15 px-3 py-2 text-xs uppercase text-charcoal/60 hover:text-charcoal hover:border-mauve/30 transition-all"
                  >
                    Ver detalle
                  </button>
                  <button
                    onClick={() => handlePresupuestar(pack.slug)}
                    className="flex-1 rounded-full bg-blush/10 border border-blush/40 px-3 py-2 text-xs uppercase text-blushdark hover:bg-blush/20 transition-all"
                  >
                    Presupuestar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {visiblePacks < services.length && (
          <div className="text-center pt-8">
            <button
              onClick={() => setVisiblePacks((p) => p + 3)}
              className="rounded-full border border-mauve/15 bg-white px-8 py-3 text-sm font-medium text-charcoal/70 transition-all hover:border-mauve/30 hover:text-charcoal"
            >
              Ver más servicios ({services.length - visiblePacks} restantes)
            </button>
          </div>
        )}
      </section>

      {/* GALERÍA */}
      {gallery.length > 0 && (
        <section id="trabajos" className="mx-auto max-w-6xl space-y-10 px-6 py-16">
          <div className="space-y-3">
            <span className="badge">Galería</span>
            <h3 className="text-3xl font-semibold text-charcoal">Nuestros Trabajos</h3>
          </div>

          <GalleryCarousel items={gallery} />
        </section>
      )}

      {/* SOBRE NOSOTROS */}
      <AboutSection siteConfig={siteConfig} professionals={professionals} />

      {/* REELS */}
      <section className="mx-auto max-w-6xl space-y-10 px-6 py-16">
        <div>
          <span className="badge">Contenido</span>
          <h3 className="text-3xl font-semibold text-charcoal">Contenido destacado</h3>
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {reels.map((video) => (
            <div key={video.id} className="glass-card overflow-hidden p-4">
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-charcoal/60">
                Video destacado
              </p>
              <div className="flex justify-center bg-porcelain rounded-xl overflow-hidden aspect-[9/16] w-full">
                <video
                  src={video.videoUrl}
                  className="w-full h-full object-cover"
                  playsInline
                  preload="metadata"
                  loop
                  muted
                  autoPlay
                  poster={video.thumbnailUrl || undefined}
                />
              </div>
              <p className="mt-3 text-sm text-charcoal/80">{video.title}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RESEÑAS */}
      <ReviewsSection nativeReviews={reviews} googleReviews={googleReviews} />

      {/* FAQ */}
      <FaqSection />

      {/* CONTACTO */}
      <section
        id="contacto"
        className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-16 md:grid-cols-[1.1fr_0.9fr]"
      >
        <div className="space-y-6">
          <span className="badge">Contacto directo</span>
          <h3 className="text-3xl font-semibold text-charcoal">Reservá tu turno en minutos</h3>
          <p className="text-charcoal/70">
            Completa el formulario y nos pondremos en contacto para confirmar tu turno.
          </p>
          {siteConfig?.whatsAppNumber && (
            <p className="text-charcoal/70">
              <strong>
                <a
                  href={getWhatsAppLink(siteConfig.whatsAppNumber)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-blushdark transition"
                >
                  También podés reservar por WhatsApp
                </a>
              </strong>
            </p>
          )}
          {siteConfig?.location && (
            <div className="glass-card overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush/15 text-blushdark">
                    <MapPin className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-blushdark">Ubicación</h4>
                    <p className="mt-1 text-sm text-charcoal/70">{siteConfig.location}</p>
                  </div>
                </div>
                {/* Botón propio AL LADO del mapa, no encima: el embed gratuito
                    de Google ("maps?q=...&output=embed") pinta su propio
                    "chrome" (link "Open in Maps", atajos de teclado, Street
                    View) en una capa de composición que en Chromium ignora el
                    z-index de hermanos — no hay forma confiable de taparlo con
                    CSS. En vez de pelear contra eso, el mapa queda interactivo
                    normal y este botón, con los colores del sitio, es la
                    forma clara de abrir la ubicación en la app de Maps. */}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteConfig.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-blush/15 px-4 py-2 text-xs font-semibold text-blushdark transition hover:bg-blush/25"
                >
                  <MapPin className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Abrir en Maps
                </a>
              </div>
              <div className="group relative mx-5 mb-5 overflow-hidden rounded-xl border border-mauve/10">
                <iframe
                  src={extractMapEmbedSrc(siteConfig.mapEmbedUrl, siteConfig.location)}
                  className="h-48 w-full"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Ubicación en el mapa"
                />
                {/* Hover puramente cosmético: el botón del header de arriba ya
                    cubre la interacción real. Esto es solo un tinte + pill al
                    pasar el mouse — pointer-events-none para no bloquear el
                    mapa interactivo de abajo. En Chromium el iframe puede
                    seguir pintando su propio "chrome" (link "Open in Maps",
                    etc.) por encima de este tinte en algunos casos — es un
                    bug de compositing de iframes que no se puede evitar del
                    todo con CSS, se acepta como costo de este efecto extra. */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-charcoal/0 transition-colors duration-300 group-hover:bg-charcoal/40">
                  <span className="flex translate-y-1 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-charcoal opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    <MapPin className="h-4 w-4 text-blushdark" strokeWidth={2.25} />
                    Abrir en Maps
                  </span>
                </div>
              </div>
            </div>
          )}
          {siteConfig?.instagramUrl && (
            <p className="text-charcoal/70">
              Instagram:{" "}
              <a
                href={siteConfig.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blushdark transition"
              >
                {siteConfig.instagramHandle || siteConfig.instagramUrl}
              </a>
            </p>
          )}
        </div>
        <BookingForm preselectedService={preselectedService} />
      </section>

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
                Presupuestar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
