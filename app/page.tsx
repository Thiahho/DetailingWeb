"use client";

import { useState } from "react";
import BookingForm from "../src/components/BookingForms";
import { packs } from "../src/lib/data"; // Solo importamos lo necesario

export default function Home() {
  const [visiblePacks, setVisiblePacks] = useState(3);
  const [preselectedService, setPreselectedService] = useState("");
  const packsToShow = packs.slice(0, visiblePacks);

  const reels = [
    "https://www.youtube.com/shorts/mj2ssaWQoSM",
    "https://youtube.com/shorts/iBBjQgkdPVU",
  ];

  const getEmbedUrl = (link: string) => {
    const videoId = link.split("/").pop()?.split("?v=").pop();
    return `https://www.youtube.com/embed/${videoId}`;
  };

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
      {/* ELIMINADO: El <header> y el menú mobile ya no van aquí. 
          Ahora están en src/components/Navbar.tsx y se renderizan desde layout.tsx 
      */}

      <div className="hero-grid">
        <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-10 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <span className="badge">Auto detailing premium</span>
            <h2 className="text-4xl font-semibold leading-tight md:text-5xl">
              Dejamos tu auto impecable, con protección real y turnos rápidos.
            </h2>
            <p className="text-base text-white/70 md:text-lg">
              Limpieza profunda, corrección de pintura, cerámico y PPF con
              resultados visibles. Atención personalizada para autos daily y
              entusiastas.
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
            <div>
              <p className="text-sm text-white/60">Resultado en 5 segundos</p>
              <h3 className="text-2xl font-semibold">
                Brillo premium + confianza total
              </h3>
            </div>
            <div className="space-y-3 text-sm text-white/70">
              <p>✓ Limpieza total y detallado con acabados premium.</p>
              <p>✓ Protección real con cerámico y PPF garantizado.</p>
              <p>✓ Atención rápida y turnos coordinados por WhatsApp.</p>
            </div>
          </div>
        </section>
      </div>

      <div className="section-divider h-px w-full bg-white/5"></div>

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
                  className="h-40 w-full object-cover"
                  src={pack.image}
                />
              </div>
              <h4 className="text-xl font-semibold">{pack.title}</h4>
              <ul className="space-y-2 text-sm text-white/70">
                {pack.details.map((detail) => (
                  <li key={detail}>• {detail}</li>
                ))}
              </ul>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-lg font-semibold text-lux">
                  {pack.price}
                </span>
                <button
                  onClick={() => handlePresupuestar(pack.slug)}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase text-white/60 hover:text-white hover:border-lux/50 transition"
                >
                  Presupuestar
                </button>
              </div>
            </article>
          ))}
        </div>

        {visiblePacks < packs.length && (
          <div className="text-center">
            <button
              onClick={() => setVisiblePacks((prev) => prev + 3)}
              className="rounded-full border border-white/10 px-6 py-3 text-sm text-white/60 hover:text-white hover:border-lux/50 transition"
            >
              Ver más servicios ({packs.length - visiblePacks} más)
            </button>
          </div>
        )}
      </section>

      {/* SECCIÓN TRABAJOS (Aquí puedes mapear tu galería si la tienes) */}
      <section id="trabajos" className="mx-auto max-w-6xl px-6 py-16">
        <span className="badge">Nuestros Trabajos</span>
        <h3 className="text-3xl font-semibold mb-8">Galería de resultados</h3>
        {/* Aquí iría tu componente de galería */}
      </section>

      {/* SECCIÓN REELS */}
      <section className="mx-auto max-w-6xl space-y-10 px-6 py-16">
        <div>
          <span className="badge">Reels destacados</span>
          <h3 className="text-3xl font-semibold">Contenido destacado</h3>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {reels.map((link) => (
            <div key={link} className="glass-card overflow-hidden p-4">
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-white/60">
                Video destacado
              </p>
              <div className="flex justify-center bg-black/20 rounded-xl overflow-hidden aspect-[9/16] w-full">
                <iframe
                  src={getEmbedUrl(link)}
                  title="YouTube Video"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
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
        <div className="space-y-6 mb-6 md:mb-0">
          <div>
            <span className="badge">Contacto directo</span>
            <h3 className="text-3xl font-semibold">
              Reservá tu turno en minutos
            </h3>
          </div>
          <div className="glass-card space-y-4 p-6">
            <div className="text-sm text-white/70">
              <p>
                WhatsApp:{" "}
                <a
                  href="https://wa.me/5491112345678"
                  className="text-white hover:text-lux"
                >
                  +54 9 11 1234 5678
                </a>
              </p>
              <p>
                Instagram:{" "}
                <a
                  href="https://www.instagram.com/lk_detailingg/"
                  className="text-white hover:text-lux"
                >
                  @lk_detailing
                </a>
              </p>
            </div>
          </div>
        </div>
        <BookingForm preselectedService={preselectedService} />
      </section>

      <footer className="border-t border-white/5 px-6 py-10 text-center text-xs text-white/50">
        Detailing premium Zona Oeste · Moreno · Turnos rápidos por WhatsApp
      </footer>

      {/* BOTONES FLOTANTES */}
      <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 gap-3">
        <a
          className="rounded-full bg-lux px-5 py-3 text-xs font-semibold uppercase text-black shadow-gold"
          href="https://wa.me/5491112345678"
        >
          WhatsApp
        </a>
        <a
          className="rounded-full border border-white/20 bg-black/60 px-5 py-3 text-xs uppercase text-white/70"
          href="#contacto"
        >
          Reservar
        </a>
      </div>
    </main>
  );
}
