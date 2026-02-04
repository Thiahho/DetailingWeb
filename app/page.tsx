"use client";

import { useState } from "react";
import BookingForm from "../src/components/BookingForms";
import { packs, gallery } from "../src/lib/data"; // Importamos solo lo necesario
import WhatsAppFloat from "../src/components/WhatsAppFloat";

const WHATSAPP_NUMBER = "+54112692061";
const PHONE_NUMBER = "+54112692061";
const WHATSAPP_MESSAGE =
  "Hola, necesito asesoramiento urgente. Mi motivo es : []. Breve descripción: ____";

export default function Home() {
  const [visiblePacks, setVisiblePacks] = useState(3);
  const [visibleGallery, setVisibleGallery] = useState(3);
  const [preselectedService, setPreselectedService] = useState("");
  const packsToShow = packs.slice(0, visiblePacks);
  const galleryToShow = gallery.slice(0, visibleGallery);

  const reels = [
    "/video/V1.mp4",
    "/video/V2.mp4",
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

  return (
    <main className="min-h-screen bg-midnight text-slate-100">
      {/* SECCIÓN HERO - Sin el Header redundante */}
      <div className="hero-grid">
        <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-10 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <span className="badge">Auto detailing premium</span>
            <h2 className="text-4xl font-semibold leading-tight md:text-5xl">
              Dejamos tu auto impecable, con protección real y turnos rápidos.
            </h2>
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
              key={pack.title}
              className="glass-card flex h-full flex-col gap-4 p-6"
            >
              <div className="overflow-hidden rounded-xl border border-white/10">
                <img
                  alt={pack.title}
                  className="h-40 w-full object-cover transition-transform duration-500 hover:scale-105"
                  src={pack.image}
                />
              </div>
              <h4 className="text-xl font-semibold">{pack.title}</h4>

              {/* Opcional: Lista de detalles si quieres que se vean los beneficios */}
              <ul className="space-y-2 text-sm text-white/60 mb-4">
                {pack.details?.map((detail, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-lux text-xs">✓</span> {detail}
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/5">
                <span className="text-lg font-semibold text-lux">
                  {pack.price}
                </span>
                <button
                  onClick={() => handlePresupuestar(pack.slug)}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase text-white/60 hover:text-white hover:border-lux/50 transition-all"
                >
                  Presupuestar
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* BOTÓN VER MÁS */}
        {visiblePacks < packs.length && (
          <div className="text-center pt-8">
            <button
              onClick={() => setVisiblePacks((prev) => prev + 3)}
              className="rounded-full border border-white/10 bg-white/5 px-8 py-3 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:border-white/20 hover:text-white"
            >
              Ver más servicios ({packs.length - visiblePacks} restantes)
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
          {reels.map((src) => (
            <div key={src} className="glass-card overflow-hidden p-4">
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-white/60">
                Video destacado
              </p>
              <div className="flex justify-center bg-black/20 rounded-xl overflow-hidden aspect-[9/16] w-full">
                <video
                  src={src}
                  className="w-full h-full object-cover"
                  playsInline
                  preload="metadata"
                  loop
                  muted
                  autoPlay
                />
              </div>
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
    </main>
  );
}
