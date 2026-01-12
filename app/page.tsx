"use client";

import { useMemo, useState } from "react";

const packs = [
  {
    title: "Pack Daily Reset",
    price: "Desde $45.000",
    time: "4-6 hs",
    slug: "daily-reset",
    image:
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80",
    details: [
      "Lavado premium + sellado rápido",
      "Interior profundo + tapizados",
      "Motor y detalles con brillo"
    ]
  },
  {
    title: "Pack Brillo Total",
    price: "Desde $85.000",
    time: "1-2 días",
    slug: "brillo-total",
    image:
      "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80",
    details: [
      "Corrección de pintura 1 paso",
      "Sellador cerámico 6 meses",
      "Detailing interior completo"
    ]
  },
  {
    title: "Pack Protección Pro",
    price: "Desde $180.000",
    time: "2-4 días",
    slug: "proteccion-pro",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    details: [
      "Coating cerámico 3-5 años",
      "PPF parcial frontal",
      "Garantía y plan de mantenimiento"
    ]
  },
  {
    title: "Pack SUV Interior Plus",
    price: "Desde $60.000",
    time: "6-8 hs",
    slug: "suv-interior-plus",
    image:
      "https://images.unsplash.com/photo-1519648023493-d82b5f8d7b8a?auto=format&fit=crop&w=900&q=80",
    details: [
      "Interior intensivo + tapizados",
      "Limpieza de baúl y paneles",
      "Sanitizado premium"
    ]
  },
  {
    title: "Pack Corrección 2 pasos",
    price: "Desde $120.000",
    time: "2-3 días",
    slug: "correccion-2-pasos",
    image:
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80",
    details: [
      "Corrección de pintura avanzada",
      "Sellado cerámico 12 meses",
      "Acabado espejo"
    ]
  },
  {
    title: "Pack Flota Express",
    price: "Desde $35.000",
    time: "3-5 hs",
    slug: "flota-express",
    image:
      "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80",
    details: [
      "Lavado premium exterior",
      "Interior express",
      "Turnos recurrentes"
    ]
  }
];

const gallery = [
  {
    title: "Audi A3 · Corrección de pintura",
    image:
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80"
  },
  {
    title: "Hilux · Interior intensivo",
    image:
      "https://images.unsplash.com/photo-1493238792000-8113da705763?auto=format&fit=crop&w=900&q=80"
  },
  {
    title: "BMW 320i · Cerámico full",
    image:
      "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=900&q=80"
  },
  {
    title: "Amarok · Limpieza premium",
    image:
      "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=900&q=80"
  },
  {
    title: "Onix · Renovación total",
    image:
      "https://images.unsplash.com/photo-1485291571150-772bcfc10da5?auto=format&fit=crop&w=900&q=80"
  },
  {
    title: "Corolla · Detallado express",
    image:
      "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=900&q=80"
  }
];

const testimonials = [
  {
    name: "Luciano, Hurlingham",
    quote: "Quedó como nuevo. Súper prolijos y cumplieron en tiempo."
  },
  {
    name: "Sofia, Moreno",
    quote: "Me explicaron todo el proceso y el cerámico quedó increíble."
  },
  {
    name: "Marcos, Ituzaingó",
    quote: "Turno rápido por WhatsApp, trabajo premium y sin sorpresas."
  }
];

const faqs = [
  {
    question: "¿Cuánto tarda el servicio?",
    answer:
      "Depende del pack. Los servicios diarios tardan 4 a 6 horas y los de corrección o protección requieren 1 a 4 días."
  },
  {
    question: "¿Trabajan con vehículos nuevos?",
    answer:
      "Sí, es ideal aplicar cerámico o PPF con pintura nueva para proteger y mantener el brillo." 
  },
  {
    question: "¿Dónde están ubicados?",
    answer:
      "Estamos en Moreno, Zona Oeste. Atendemos con turno previo para asegurar entrega rápida." 
  }
];

export default function Home() {
  const [visiblePacks, setVisiblePacks] = useState(3);
  const packsToShow = useMemo(() => packs.slice(0, visiblePacks), [visiblePacks]);

  return (
    <main className="min-h-screen bg-midnight text-slate-100">
      <div className="hero-grid">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full border border-white/10 bg-white/10"></div>
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-white/60">Detailing premium</p>
              <h1 className="text-lg font-semibold">Zona Oeste | Moreno</h1>
            </div>
          </div>
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
            <a className="rounded-full border border-white/10 px-4 py-2 transition hover:border-lux/60" href="#contacto">
              Contacto
            </a>
          </nav>
        </header>

        <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-10 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <span className="badge">Auto detailing premium</span>
            <h2 className="text-4xl font-semibold leading-tight md:text-5xl">
              Dejamos tu auto impecable, con protección real y turnos rápidos.
            </h2>
            <p className="text-base text-white/70 md:text-lg">
              Limpieza profunda, corrección de pintura, cerámico y PPF con resultados visibles. Atención
              personalizada para autos daily, entusiastas y vehículos nuevos.
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
            <div className="grid gap-4 md:grid-cols-3">
              {[
                "Protección cerámica / PPF",
                "Antes y después reales",
                "Turno rápido en Moreno"
              ].map((item) => (
                <div key={item} className="glass-card px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/60">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card space-y-6 border border-white/10 p-6 shadow-glow">
            <div>
              <p className="text-sm text-white/60">Resultado en 5 segundos</p>
              <h3 className="text-2xl font-semibold">Brillo premium + confianza total</h3>
            </div>
            <div className="space-y-3 text-sm text-white/70">
              <p>✔ Limpieza total y detallado con acabados premium.</p>
              <p>✔ Protección real con cerámico y PPF garantizado.</p>
              <p>✔ Atención rápida y turnos coordinados por WhatsApp.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Hoy en taller</p>
              <p className="mt-2 text-lg font-semibold">3 turnos disponibles esta semana</p>
            </div>
          </div>
        </section>
      </div>

      <div className="section-divider h-px w-full"></div>

      <section id="servicios" className="mx-auto max-w-6xl space-y-10 px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-3">
            <span className="badge">Packs claros</span>
            <h3 className="text-3xl font-semibold">Servicios y packs premium</h3>
            <p className="text-white/70">Precios desde y tiempos estimados para decidir rápido.</p>
          </div>
          <a
            className="rounded-full border border-electric/50 px-5 py-2 text-sm text-electric transition hover:bg-electric/10"
            href="#contacto"
          >
            Pedir presupuesto
          </a>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {packsToShow.map((pack) => (
            <article key={pack.title} className="glass-card flex h-full flex-col gap-4 p-6">
              <div className="overflow-hidden rounded-xl border border-white/10">
                <img
                  alt={`Servicio ${pack.title}`}
                  className="h-40 w-full object-cover"
                  src={pack.image}
                />
              </div>
              <div>
                <h4 className="text-xl font-semibold">{pack.title}</h4>
                <p className="text-sm text-white/60">{pack.time}</p>
              </div>
              <ul className="space-y-2 text-sm text-white/70">
                {pack.details.map((detail) => (
                  <li key={detail}>• {detail}</li>
                ))}
              </ul>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-lg font-semibold text-lux">{pack.price}</span>
                <a
                  className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/60 transition hover:border-lux/50 hover:text-white"
                  href={`https://wa.me/5491112345678?text=${encodeURIComponent(
                    `Hola! Quiero presupuestar el ${pack.title}.`
                  )}`}
                >
                  Presupuestar
                </a>
              </div>
            </article>
          ))}
        </div>
        {visiblePacks < packs.length && (
          <div className="flex justify-center">
            <button
              className="rounded-full border border-white/15 px-6 py-3 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:border-electric/60 hover:text-white"
              onClick={() => setVisiblePacks((prev) => Math.min(prev + 3, packs.length))}
              type="button"
            >
              Cargar más servicios
            </button>
          </div>
        )}
      </section>

      <section id="trabajos" className="mx-auto max-w-6xl space-y-10 px-6 py-16">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <span className="badge">Trabajos reales</span>
            <h3 className="text-3xl font-semibold">Antes y después destacados</h3>
          </div>
          <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em] text-white/50">
            <span className="rounded-full border border-white/10 px-3 py-1">Daily</span>
            <span className="rounded-full border border-white/10 px-3 py-1">Cerámico</span>
            <span className="rounded-full border border-white/10 px-3 py-1">Interior</span>
            <span className="rounded-full border border-white/10 px-3 py-1">PPF</span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {gallery.map((item) => (
            <div key={item.title} className="glass-card group overflow-hidden">
              <img
                alt={`Trabajo ${item.title}`}
                className="h-40 w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                src={item.image}
              />
              <div className="p-4">
                <p className="text-sm text-white/70">{item.title}</p>
                <button className="mt-3 text-xs uppercase tracking-[0.2em] text-electric">Ver proceso</button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {["https://www.instagram.com/reel/placeholder1/", "https://www.instagram.com/reel/placeholder2/"].map(
            (link) => (
              <div key={link} className="glass-card p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-white/60">Reel destacado</p>
                <p className="mt-2 text-white/70">Embed IG: {link}</p>
                <div className="mt-4 h-40 rounded-xl border border-white/10 bg-black/40"></div>
              </div>
            )
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 px-6 py-16">
        <div>
          <span className="badge">Confianza real</span>
          <h3 className="text-3xl font-semibold">Clientes que vuelven</h3>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((item) => (
            <div key={item.name} className="glass-card p-6">
              <p className="text-sm text-white/70">“{item.quote}”</p>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/50">{item.name}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-6xl space-y-8 px-6 py-16">
        <div>
          <span className="badge">FAQ</span>
          <h3 className="text-3xl font-semibold">Resolvemos tus dudas rápido</h3>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {faqs.map((item) => (
            <div key={item.question} className="glass-card p-6">
              <h4 className="text-lg font-semibold">{item.question}</h4>
              <p className="mt-3 text-sm text-white/70">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="contacto" className="mx-auto max-w-6xl gap-10 px-6 py-16 md:grid md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div>
            <span className="badge">Contacto directo</span>
            <h3 className="text-3xl font-semibold">Reservá tu turno en minutos</h3>
            <p className="mt-3 text-white/70">
              Moreno, Zona Oeste. Atención con turno previo para garantizar entrega y calidad premium.
            </p>
          </div>
          <div className="glass-card space-y-4 p-6">
            <div className="text-sm text-white/70">
              <p>WhatsApp: +54 9 11 1234 5678</p>
              <p>Horario: Lun a Sáb · 9 a 19 hs</p>
              <p>Instagram: @detailing.zonaoeste</p>
            </div>
            <div className="h-40 rounded-xl border border-white/10 bg-black/40"></div>
          </div>
        </div>

        <form className="glass-card space-y-4 p-6">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/50">Nombre</label>
            <input className="form-input mt-2" placeholder="Tu nombre" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/50">Vehículo</label>
            <input className="form-input mt-2" placeholder="Modelo y año" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/50">Consulta</label>
            <textarea className="form-input mt-2 min-h-[140px]" placeholder="¿Qué servicio buscás?" />
          </div>
          <button
            className="w-full rounded-full bg-electric px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01]"
            type="submit"
          >
            Enviar consulta
          </button>
        </form>
      </section>

      <footer className="border-t border-white/5 px-6 py-10 text-center text-xs text-white/50">
        Detailing premium Zona Oeste · Moreno · Turnos rápidos por WhatsApp
      </footer>

      <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 gap-3">
        <a
          className="rounded-full bg-lux px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-black shadow-gold"
          href="https://wa.me/5491112345678"
        >
          WhatsApp
        </a>
        <a
          className="rounded-full border border-white/20 bg-black/60 px-5 py-3 text-xs uppercase tracking-[0.2em] text-white/70"
          href="#contacto"
        >
          Reservar
        </a>
      </div>

      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AutoRepair",
            name: "Detailing premium Zona Oeste",
            areaServed: "Moreno, Zona Oeste",
            telephone: "+54 9 11 1234 5678",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Moreno",
              addressRegion: "Buenos Aires",
              addressCountry: "AR"
            },
            url: "https://detailing-zonaoeste.example",
            priceRange: "$$$"
          })
        }}
      />
    </main>
  );
}
