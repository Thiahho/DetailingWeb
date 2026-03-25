"use client";

import { useState, useEffect } from "react";
import BookingForm from "../src/components/BookingForms";
import { gallery } from "../src/lib/data";
import WhatsAppFloat from "../src/components/WhatsAppFloat";

interface Service {
  id: number;
  title: string;
  slug: string;
  price: string;
  duration: string | null;
  imageUrl: string;
  description: string;
  details: string[];
}


interface ContentVideo {
  id: number;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
}
const WHATSAPP_NUMBER = "+54112692061";
//const PHONE_NUMBER = "+54112692061";
// const WHATSAPP_MESSAGE =
//   "Hola, necesito asesoramiento urgente. Mi motivo es : []. Breve descripción: ____";
const SITE_URL = "https://detailing-web-five.vercel.app";

export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  const [visiblePacks, setVisiblePacks] = useState(3);
  const [visibleGallery, setVisibleGallery] = useState(3);
  const [preselectedService, setPreselectedService] = useState("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [contentVideos, setContentVideos] = useState<ContentVideo[]>([]);
  const packsToShow = services.slice(0, visiblePacks);
  const galleryToShow = gallery.slice(0, visibleGallery);

  useEffect(() => {
    fetch("/api/services")
      .then((res) => res.json())
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch(() => {});

    fetch("/api/content-videos")
      .then((res) => res.json())
      .then((data) => setContentVideos(Array.isArray(data) ? data : []))
      .catch(() => setContentVideos([]));
  }, []);

  const reels =
    contentVideos.length > 0
      ? contentVideos
      : [
          { id: 1, title: "Video destacado 1", videoUrl: "/video/V1.mp4", thumbnailUrl: "" },
          { id: 2, title: "Video destacado 2", videoUrl: "/video/V2.mp4", thumbnailUrl: "" },
        ];

  const handlePresupuestar = (slug: string) => {
    setPreselectedService(slug);
    setTimeout(() => {
      const contactSection = document.getElementById("contacto");
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Detailing Cars",
    url: SITE_URL,
    description:
      "Servicios profesionales de detailing automotriz en Moreno, Zona Oeste. Turnos rápidos, protección cerámica, PPF y limpieza premium.",
    areaServed: "Moreno, Zona Oeste, Buenos Aires",
    telephone: WHATSAPP_NUMBER,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Moreno",
      addressRegion: "Buenos Aires",
      addressCountry: "AR",
    },
    sameAs: ["https://www.instagram.com/thiago_brizuela"],
  };

  return (
    <main className="min-h-screen bg-midnight text-slate-100">
       <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* SECCIÓN HERO - Sin el Header redundante */}
      <div className="hero-grid">
        <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-10 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <span className="badge">Auto detailing premium</span>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              Dejamos tu auto impecable, con protección real y turnos rápidos.
            </h1>
            <p className="text-base text-white/70 md:text-lg">
              Limpieza profunda, corrección de pintura, cerámico y PPF con
              resultados visibles.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                className="rounded-full bg-lux px-6 py-3 text-sm font-semibold text-black shadow-gold transition hover:scale-[1.02]"
                href="https://wa.me/5491112345678"
              >
                Reservar por WhatsApp
              </a>
              <a
                className="rounded-full border border-white/15 px-6 py-3 text-sm text-white/80 transition hover:border-electric/60 hover:text-white"
                href="#contacto"
              >
                Consulta online
              </a>
            </div>
          </div>

          <div className="glass-card space-y-6 border border-white/10 p-6 shadow-glow">
            <h3 className="text-2xl font-semibold">
              Brillo premium + confianza total
            </h3>
            <div className="space-y-3 text-sm text-white/70">
              <p>✓ Limpieza total y detallado con acabados premium.</p>
              <p>✓ Protección real con cerámico y PPF garantizado.</p>
            </div>
          </div>
        </section>
      </div>

      {/* SECCIÓN SERVICIOS */}
      <section
        id="servicios"
        className="mx-auto max-w-6xl space-y-10 px-6 py-16"
      >
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-3">
            <span className="badge">Packs claros</span>
            <h3 className="text-3xl font-semibold">
              Servicios y packs premium
            </h3>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {packsToShow.map((pack) => (
            <article
              key={pack.id}
              className="glass-card flex h-full flex-col gap-4 p-6"
            >
              <div className="overflow-hidden rounded-xl border border-white/10">
                <img
                  alt={pack.title}
                  className="h-40 w-full object-cover transition-transform duration-500 hover:scale-105"
                  src={pack.imageUrl}
                />
              </div>
              <h4 className="text-xl font-semibold">{pack.title}</h4>

              <ul className="space-y-2 text-sm text-white/60 mb-4">
                {pack.details?.map((detail, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-lux text-xs">✓</span> {detail}
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-4 border-t border-white/5 space-y-2">
                <span className="text-lg font-semibold text-lux block">
                  ${pack.price}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedService(pack)}
                    className="flex-1 text-center rounded-full border border-white/10 px-3 py-2 text-xs uppercase text-white/60 hover:text-white hover:border-white/30 transition-all"
                  >
                    Ver detalle
                  </button>
                  <button
                    onClick={() => handlePresupuestar(pack.slug)}
                    className="flex-1 rounded-full bg-lux/10 border border-lux/40 px-3 py-2 text-xs uppercase text-lux hover:bg-lux/20 transition-all"
                  >
                    Presupuestar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* BOTÓN VER MÁS */}
        {visiblePacks < services.length && (
          <div className="text-center pt-8">
            <button
              onClick={() => setVisiblePacks((prev) => prev + 3)}
              className="rounded-full border border-white/10 bg-white/5 px-8 py-3 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:border-white/20 hover:text-white"
            >
              Ver más servicios ({services.length - visiblePacks} restantes)
            </button>
          </div>
        )}
      </section>
      {/* SECCIÓN TRABAJOS REALIZADOS */}
      <section
        id="trabajos"
        className="mx-auto max-w-6xl space-y-10 px-6 py-16"
      >
        <div className="space-y-3">
          <span className="badge">Galería</span>
          <h3 className="text-3xl font-semibold">Nuestros Trabajos</h3>
          <p className="text-white/60">
            Resultados reales en vehículos de la zona.
          </p>
        </div>

        {/* Contenedor de la grilla */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {galleryToShow.map((galleryItem) => (
            <article
              key={galleryItem.title}
              className="glass-card group overflow-hidden border border-white/10 p-4"
            >
              <div className="relative aspect-video overflow-hidden rounded-xl">
                <img
                  src={galleryItem.image}
                  alt={galleryItem.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <div className="mt-4">
                <h4 className="text-lg font-medium text-white/90 group-hover:text-lux transition-colors">
                  {galleryItem.title}
                </h4>
                <p className="text-xs uppercase tracking-widest text-white/40 mt-1">
                  Detalle Premium
                </p>
              </div>
            </article>
          ))}
        </div>

        {visibleGallery < gallery.length && (
          <div className="text-center pt-8">
            <button
              onClick={() => setVisibleGallery((prev) => prev + 3)}
              className="rounded-full border border-white/10 bg-white/5 px-8 py-3 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:border-white/20 hover:text-white"
            >
              Ver más trabajos ({gallery.length - visibleGallery} restantes)
            </button>
          </div>
        )}
      </section>
      {/* SECCIÓN REELS */}
      <section className="mx-auto max-w-6xl space-y-10 px-6 py-16">
        <div>
          <span className="badge">Reels destacados</span>
          <h3 className="text-3xl font-semibold">Contenido destacado</h3>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {reels.map((video) => (
            <div key={video.id} className="glass-card overflow-hidden p-4">
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-white/60">
                Video destacado
              </p>
              <div className="flex justify-center bg-black/20 rounded-xl overflow-hidden aspect-[9/16] w-full">
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
              <p className="mt-3 text-sm text-white/80">{video.title}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECCIÓN CONTACTO */}
      <section
        id="contacto"
        className="mx-auto max-w-6xl gap-10 px-6 py-16 md:grid md:grid-cols-[1.1fr_0.9fr]"
      >
        <div className="space-y-6">
          <span className="badge">Contacto directo</span>
          <h3 className="text-3xl font-semibold">
            Reservá tu turno en minutos
          </h3>
          <p className="text-white/70">
            Completa el formulario y nos pondremos en contacto para confirmar tu
            turno. ¡Tu auto merece el mejor cuidado!
          </p>
          <p className="text-white/70">
            <strong>
              <a
                href="https://wa.me/5491112345678"
                className="underline hover:text-lux transition"
              >
                También podés reservar por WhatsApp
              </a>
            </strong>
          </p>
          <p className="text-white/70">
            Estamos ubicados en Moreno, Zona Oeste. Atendemos con turno previo
            para asegurar una entrega rápida y un servicio de calidad.
          </p>
          <p className="text-white/70">
            Instagram:{" "}
            <a
              href="https://www.instagram.com/thiago_brizuela"
              className="underline hover:text-lux transition"
            >
              @detailingcars
            </a>
          </p>
        </div>
        <BookingForm preselectedService={preselectedService} />
      </section>

      <footer className="border-t border-white/5 px-6 py-10 text-center text-xs text-white/50">
        Detailing premium Zona Oeste · Moreno · Turnos rápidos por WhatsApp
      </footer>
      <WhatsAppFloat whatsappNumber={WHATSAPP_NUMBER.replace(/\D/g, "")}></WhatsAppFloat>

      {/* MODAL DETALLE SERVICIO */}
      {selectedService && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setSelectedService(null)}
        >
          <div
            className="bg-[#0f1115] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedService.imageUrl && (
              <div className="h-52 overflow-hidden">
                <img
                  src={selectedService.imageUrl}
                  alt={selectedService.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-2xl font-semibold text-white">{selectedService.title}</h2>
                <button
                  onClick={() => setSelectedService(null)}
                  className="text-white/40 hover:text-white transition text-xl shrink-0"
                >
                  ✕
                </button>
              </div>

              {selectedService.description && (
                <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line">{selectedService.description}</p>
              )}

              <div className="flex flex-wrap gap-2">
                {selectedService.duration && (
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                    ⏱ {selectedService.duration}
                  </span>
                )}
                <span className="rounded-full border border-lux/50 px-3 py-1 text-xs text-lux">
                  ${selectedService.price} ARS
                </span>
              </div>

              {selectedService.details?.length > 0 && (
                <ul className="space-y-1 text-sm text-white/60">
                  {selectedService.details.map((d, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-lux mt-0.5">✓</span> {d}
                    </li>
                  ))}
                </ul>
              )}

              <button
                onClick={() => {
                  setSelectedService(null);
                  handlePresupuestar(selectedService.slug);
                }}
                className="w-full rounded-full bg-lux px-6 py-3 text-sm font-semibold text-black shadow-gold transition hover:scale-[1.02]"
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
