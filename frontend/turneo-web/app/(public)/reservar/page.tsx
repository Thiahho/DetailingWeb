"use client";

import { useState, useEffect } from "react";
import BookingForm from "@/src/components/booking/BookingForms";
import WhatsAppFloat from "@/src/components/shared/WhatsAppFloat";
import RouletteFloat from "@/src/components/shared/RouletteFloat";
import ReviewsSection, { type NativeReview, type GoogleReview } from "@/src/components/public/ReviewsSection";
import { type SiteConfig, getWhatsAppLink, extractMapEmbedSrc } from "@/src/lib/siteConfig";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

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

export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [visiblePacks, setVisiblePacks] = useState(3);
  const [visibleGallery, setVisibleGallery] = useState(3);
  const [preselectedService, setPreselectedService] = useState("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  useModalHotkeys(!!selectedService, { onClose: () => setSelectedService(null) });
  const [contentVideos, setContentVideos] = useState<ContentVideo[]>([]);
  const [reviews, setReviews] = useState<NativeReview[]>([]);
  const [googleReviews, setGoogleReviews] = useState<GoogleReview[]>([]);

  const packsToShow = services.slice(0, visiblePacks);
  const galleryToShow = gallery.slice(0, visibleGallery);

  useEffect(() => {
    fetch("/api/public-data")
      .then((r) => r.json())
      .then((d) => {
        setServices(Array.isArray(d.services) ? d.services : []);
        setGallery(Array.isArray(d.gallery) ? d.gallery : []);
        setSiteConfig(d.siteconfig ?? null);
        setContentVideos(Array.isArray(d.contentVideos) ? d.contentVideos : []);
        setReviews(Array.isArray(d.reviews) ? d.reviews : []);
        setGoogleReviews(Array.isArray(d.googleReviews) ? d.googleReviews : []);
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
            <article key={pack.id} className="glass-card flex h-full flex-col gap-4 p-6">
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

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {galleryToShow.map((item) => (
              <article key={item.id} className="glass-card group overflow-hidden p-4">
                <div className="relative aspect-video overflow-hidden rounded-xl">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="mt-4">
                  <h4 className="text-lg font-medium text-charcoal/90 group-hover:text-blushdark transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-xs uppercase tracking-widest text-charcoal/40 mt-1">
                    {item.tag}
                  </p>
                </div>
              </article>
            ))}
          </div>

          {visibleGallery < gallery.length && (
            <div className="text-center pt-8">
              <button
                onClick={() => setVisibleGallery((p) => p + 3)}
                className="rounded-full border border-mauve/15 bg-white px-8 py-3 text-sm font-medium text-charcoal/70 transition-all hover:border-mauve/30 hover:text-charcoal"
              >
                Ver más trabajos ({gallery.length - visibleGallery} restantes)
              </button>
            </div>
          )}
        </section>
      )}

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
            <div className="space-y-3">
              <p className="text-charcoal/70">
                Ubicación: {siteConfig.location}
              </p>
              <div className="overflow-hidden rounded-2xl border border-mauve/15 shadow-soft">
                <iframe
                  src={extractMapEmbedSrc(siteConfig.mapEmbedUrl, siteConfig.location)}
                  className="h-56 w-full"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Ubicación en el mapa"
                />
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteConfig.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-charcoal/70 underline hover:text-blushdark transition"
              >
                Cómo llegar →
              </a>
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
