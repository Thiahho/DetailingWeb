"use client";

import { useState } from "react";
import BookingForm from "../src/components/BookingForms";
import { packs } from "../src/lib/data"; // Importamos solo lo necesario

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
        <h3 className="text-3xl font-semibold">Servicios y packs premium</h3>
        <div className="grid gap-6 md:grid-cols-3">
          {packsToShow.map((pack) => (
            <article
              key={pack.title}
              className="glass-card flex h-full flex-col gap-4 p-6"
            >
              <img
                alt={pack.title}
                className="h-40 w-full object-cover rounded-xl"
                src={pack.image}
              />
              <h4 className="text-xl font-semibold">{pack.title}</h4>
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
        </div>
        <BookingForm preselectedService={preselectedService} />
      </section>

      <footer className="border-t border-white/5 px-6 py-10 text-center text-xs text-white/50">
        Detailing premium Zona Oeste · Moreno · Turnos rápidos por WhatsApp
      </footer>
    </main>
  );
}
