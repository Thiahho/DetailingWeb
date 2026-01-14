"use client";

import { useState } from "react";
import BookingForm from "../src/components/BookingForms";
import { packs, gallery, testimonials, faqs } from "../src/lib/data";
import { LogIn, Menu, X } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const [visiblePacks, setVisiblePacks] = useState(3);
  const [preselectedService, setPreselectedService] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <main className="min-h-screen bg-midnight text-slate-100">
      <div className="hero-grid">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-3 transition hover:opacity-80"
            >
              <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                <img
                  src="/img/logowhite.webp"
                  alt="LK Detailing Logo"
                  className="h-full w-full object-contain p-1.5"
                />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-white/60">
                  Detailing premium
                </p>
                <h1 className="text-lg font-semibold">Zona Oeste | Moreno</h1>
              </div>
            </Link>
          </div>

          {/* Botón hamburguesa - solo mobile */}
          <button
            className="flex items-center justify-center p-2 text-white/70 transition hover:text-white md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menú"
          >
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>

          {/* Nav desktop */}
          <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <a className="transition hover:text-white" href="#servicios">
              Servicios
            </a>
            <a className="transition hover:text-white" href="#trabajos">
              Trabajos
            </a>
            <a className="transition hover:text-white" href="#faq">
              FAQ
            </a>
            <a
              className="rounded-full border border-white/10 px-4 py-2 transition hover:border-lux/60"
              href="#contacto"
            >
              Contacto
            </a>
            <a
              className="flex items-center gap-2 transition hover:text-white"
              href="/admin/login"
              title="Iniciar sesión"
            >
              <LogIn size={20} strokeWidth={1.5} />
              <span className="sr-only">Iniciar sesión</span>
            </a>
          </nav>
        </header>

        {/* Menú mobile desplegable */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-midnight/95 backdrop-blur-sm md:hidden">
            <div className="flex items-center justify-between px-6 py-6">
              <Link
                href="/"
                className="flex items-center gap-3"
                onClick={closeMobileMenu}
              >
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                  <img
                    src="/img/logowhite.webp"
                    alt="LK Detailing Logo"
                    className="h-full w-full object-contain p-1.5"
                  />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-white/60">
                    Detailing premium
                  </p>
                  <h1 className="text-lg font-semibold">Zona Oeste | Moreno</h1>
                </div>
              </Link>
              <button
                className="p-2 text-white/70 transition hover:text-white"
                onClick={closeMobileMenu}
                aria-label="Cerrar menú"
              >
                <X size={28} />
              </button>
            </div>

            <nav className="flex flex-col items-center gap-6 px-6 pt-10 text-lg">
              <a
                className="w-full text-center py-3 text-white/70 transition hover:text-white border-b border-white/10"
                href="#servicios"
                onClick={closeMobileMenu}
              >
                Servicios
              </a>
              <a
                className="w-full text-center py-3 text-white/70 transition hover:text-white border-b border-white/10"
                href="#trabajos"
                onClick={closeMobileMenu}
              >
                Trabajos
              </a>
              <a
                className="w-full text-center py-3 text-white/70 transition hover:text-white border-b border-white/10"
                href="#faq"
                onClick={closeMobileMenu}
              >
                FAQ
              </a>
              <a
                className="w-full text-center py-3 rounded-full border border-lux/60 text-lux transition hover:bg-lux/10"
                href="#contacto"
                onClick={closeMobileMenu}
              >
                Contacto
              </a>
              <a
                className="flex items-center gap-2 py-3 text-white/70 transition hover:text-white"
                href="/admin/login"
                onClick={closeMobileMenu}
              >
                <LogIn size={20} strokeWidth={1.5} />
                <span>Iniciar sesión</span>
              </a>
            </nav>
          </div>
        )}

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

      {/* SEO SCHEMA */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AutoRepair",
            name: "Detailing premium Zona Oeste",
            address: { "@type": "PostalAddress", addressLocality: "Moreno" },
          }),
        }}
      />
    </main>
  );
}
