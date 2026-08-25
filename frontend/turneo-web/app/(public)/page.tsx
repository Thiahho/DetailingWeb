import Link from "next/link";
import { buildWhatsAppUrl } from "@/src/lib/contact";
import CalculadoraCostoInaccion from "@/src/components/public/CalculadoraCostoInaccion";

// Home comercial de Turneo (el producto/SaaS) — a diferencia de /reservar
// no depende de ningún tenant ni hace fetch a la API, es contenido estático.
// SiteChrome.tsx oculta el Navbar del negocio acá a propósito.

const FUNCIONES = [
  {
    title: "Agenda multi-profesional",
    description: "Vista semana o día, arrastrar y soltar turnos, soporte táctil. Cada profesional con su propia disponibilidad.",
  },
  {
    title: "CRM de clientes",
    description: "Cumpleaños, Instagram, notas, fotos, profesional favorito e historial completo de cada cliente.",
  },
  {
    title: "Caja diaria",
    description: "Cobros, señas y cierre de caja del día, todo conectado a los turnos que se atendieron.",
  },
  {
    title: "Automatizaciones",
    description: "Recordatorios automáticos y reactivación de clientes inactivos, sin que nadie tenga que acordarse de mandarlos.",
  },
  {
    title: "Notificaciones",
    description: "WhatsApp y email para confirmar, recordar y avisar cambios de turno sin intervención manual.",
  },
  {
    title: "Estadísticas",
    description: "Ventas del mes, horas ocupadas y libres, ausencias próximas — por profesional y del negocio en conjunto.",
  },
  {
    title: "Portal de clientes",
    description: "Tus clientes ven y cancelan sus propios turnos, con acceso validado por código (OTP), sin contraseñas que recordar.",
  },
];

const VALIDACIONES = [
  {
    title: "Sin dobles turnos",
    description: "Cada franja horaria es única por profesional — el sistema no permite superponer dos reservas en el mismo horario.",
  },
  {
    title: "Pagos validados",
    description: "Señas y cobros integrados con MercadoPago, confirmados por webhook antes de dar el turno por pagado.",
  },
  {
    title: "Acceso de clientes por código",
    description: "Tus clientes entran a ver sus turnos con un código temporal enviado a su email, no con contraseñas que se puedan filtrar.",
  },
  {
    title: "Datos aislados por negocio",
    description: "Tu información nunca se mezcla con la de otro negocio en la plataforma — cada cuenta ve solo lo suyo.",
  },
];

// Tareas repetitivas que Turneo saca de encima al dueño, siempre en formato
// "ya no hacés X a mano" — nombra la fricción puntual, no un beneficio genérico.
const BENEFICIOS_DUENO = [
  "Ya no confirmás turnos uno por uno por WhatsApp: se confirman y recuerdan solos.",
  "Ya no perseguís clientes que faltan sin avisar: el recordatorio baja el ausentismo antes de que pase.",
  "Ya no anotás a mano quién pagó seña: la caja queda conectada a cada turno atendido.",
  "Ya no armás las estadísticas del mes con calculadora: las ves listas, por profesional y del negocio.",
  "Ya no te acordás vos de reactivar clientes que no vuelven: la automatización les escribe sola.",
];

const BENEFICIOS_CLIENTES = [
  "Reservan un turno a cualquier hora, sin llamar ni escribir esperando respuesta.",
  "Reciben un recordatorio antes del turno: no se olvidan ni llegan tarde.",
  "Ven y cancelan sus propios turnos con un código, sin crear cuenta ni recordar contraseña.",
  "Eligen profesional y horario libre en el momento, sin depender de que alguien les conteste.",
];

// PLANES y A_MEDIDA: datos de la sección de planes, comentada más abajo
// (no se quiere mostrar selección de planes al público). Se dejan acá listos
// para cuando se vuelva a habilitar esa sección.
// const PLANES = [
//   {
//     name: "Free",
//     tagline: "Para empezar",
//     items: [
//       "1 profesional",
//       "Hasta 35 turnos por mes",
//       "Notificaciones por WhatsApp",
//       "Agenda y página de reservas online",
//       "CRM e historial básico",
//     ],
//     note: "Podés quedarte en este plan el tiempo que quieras.",
//     cta: "Crear cuenta",
//   },
//   {
//     name: "Starter",
//     tagline: "Para profesionales independientes",
//     items: [
//       "1 profesional",
//       "Hasta 50 turnos por mes",
//       "CRM e historial completos",
//       "Subdominio propio, sin marca Turneo",
//       "Caja básica y gestión de señas",
//     ],
//     cta: "Elegir plan",
//   },
//   {
//     name: "Pro",
//     tagline: "El más elegido",
//     items: [
//       "Hasta 5 profesionales",
//       "Hasta 500 turnos por mes",
//       "WhatsApp y Mercado Pago",
//       "Caja completa: apertura, cierre y señas",
//       "Estadísticas por profesional",
//     ],
//     highlighted: true,
//     cta: "Elegir plan",
//   },
//   {
//     name: "Premium",
//     tagline: "Para equipos grandes",
//     items: [
//       "Hasta 15 profesionales",
//       "Hasta 2.000 turnos por mes",
//       "WhatsApp y Mercado Pago",
//       "Automatizaciones y recordatorios con IA",
//       "Estadísticas avanzadas",
//     ],
//     cta: "Elegir plan",
//   },
//   {
//     name: "Enterprise",
//     tagline: "A tu medida",
//     items: [
//       "Profesionales y turnos sin límite",
//       "WhatsApp, Mercado Pago y automatizaciones con IA",
//       "Infraestructura de mayor capacidad",
//       "Soporte prioritario",
//     ],
//     cta: "Hablar con nosotros",
//   },
// ];
//
// const A_MEDIDA = [
//   {
//     name: "Licencia",
//     tagline: "Tu propia instalación",
//     description: "Instancia exclusiva de Turneo: base de datos, infraestructura y dominio propios, sin marca Turneo. Pago único, con mantenimiento mensual opcional (hosting, backups, actualizaciones).",
//     cta: "Consultar",
//   },
//   {
//     name: "Custom",
//     tagline: "A medida",
//     description: "Multi-sucursal real, integraciones externas, funcionalidades fuera del producto estándar. Presupuesto a medida de tu proyecto.",
//     cta: "Hablar con nosotros",
//   },
// ];

export default function ComercialHome() {
  return (
    <main className="min-h-screen bg-cream text-charcoal">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-mauve/10 bg-cream/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <img src="/img/LogoPortada.png" alt="Turneo" className="h-10 w-auto object-contain" />
          <nav className="hidden items-center gap-6 text-sm text-charcoal/70 md:flex">
            <a href="#funciones" className="transition hover:text-charcoal">Funciones</a>
            {/* Planes ocultos al público a propósito — ver sección PLANES más abajo */}
            <a href="#contacto" className="transition hover:text-charcoal">Contacto</a>
          </nav>
          <Link
            href="/reservar"
            className="rounded-full bg-blush px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]"
          >
            Ver la web en vivo
          </Link>
        </div>
      </header>

      {/* HERO */}
      <div className="hero-grid">
        <section className="mx-auto max-w-4xl space-y-6 px-6 py-24 text-center">
          <span className="badge mx-auto">Sistema de turnos para salones y estudios de belleza</span>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-charcoal md:text-5xl">
            El sistema de turnos que administra tu negocio, no al revés
          </h1>
          <p className="mx-auto max-w-2xl text-base text-charcoal/70 md:text-lg">
            Agenda, clientes, caja y recordatorios en un solo panel. Tus clientes reservan solos,
            vos te enterás de todo sin perseguirlos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/reservar"
              className="rounded-full bg-blush px-6 py-3 text-sm font-semibold text-white shadow-glow transition [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]"
            >
              Ver la web en vivo
            </Link>
            <a
              href={buildWhatsAppUrl("Hola! Quiero sumar mi negocio a Turneo.")}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-mauve/20 px-6 py-3 text-sm text-charcoal/80 transition hover:border-blush hover:text-charcoal"
            >
              Quiero sumarme
            </a>
          </div>
        </section>
      </div>

      {/* BENEFICIOS — dueño vs. clientes, justo después del hero para
          enganchar con lo concreto antes de la lista de funciones. */}
      <section className="mx-auto max-w-6xl space-y-10 px-6 py-20">
        <div className="space-y-3 text-center">
          <span className="badge mx-auto">Lo que cambia</span>
          <h2 className="text-3xl font-semibold text-charcoal md:text-4xl">
            Menos tareas repetitivas para vos, mejor experiencia para tus clientes
          </h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card space-y-5 border-blush/30 p-7 md:p-8">
            <div className="space-y-1">
              <span className="badge">Para vos</span>
              <h3 className="text-xl font-semibold text-charcoal">Lo que dejás de hacer a mano</h3>
            </div>
            <ul className="space-y-3.5">
              {BENEFICIOS_DUENO.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm text-charcoal/70">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blush/15 text-xs text-blushdark">✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-card space-y-5 border-champagne/30 p-7 md:p-8">
            <div className="space-y-1">
              <span className="badge">Para tus clientes</span>
              <h3 className="text-xl font-semibold text-charcoal">Lo que ganan al reservar con vos</h3>
            </div>
            <ul className="space-y-3.5">
              {BENEFICIOS_CLIENTES.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm text-charcoal/70">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-champagne/20 text-xs text-champagne">✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CALCULADORA — costo de la no-acción, resultado inmediato sin pedir
          datos de contacto (a propósito: el foco es el número, no el gate). */}
      <CalculadoraCostoInaccion />

      {/* FUNCIONES */}
      <section id="funciones" className="mx-auto max-w-6xl space-y-10 px-6 py-20">
        <div className="space-y-3 text-center">
          <span className="badge mx-auto">Qué ofrece</span>
          <h2 className="text-3xl font-semibold text-charcoal">Todo lo que necesita tu negocio, ya construido</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCIONES.map((f) => (
            <article key={f.title} className="glass-card space-y-2 p-6">
              <h3 className="text-lg font-semibold text-charcoal">{f.title}</h3>
              <p className="text-sm text-charcoal/60">{f.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* VALIDACIONES / GARANTÍAS */}
      <section className="hero-grid">
        <div className="mx-auto max-w-6xl space-y-10 px-6 py-20">
          <div className="space-y-3 text-center">
            <span className="badge mx-auto">Garantías</span>
            <h2 className="text-3xl font-semibold text-charcoal">Construido para que funcione bien</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {VALIDACIONES.map((v) => (
              <article key={v.title} className="glass-card flex gap-4 p-6">
                <span className="mt-0.5 text-champagne">✓</span>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-charcoal">{v.title}</h3>
                  <p className="text-sm text-charcoal/60">{v.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PLANES — comentado a propósito: no se quiere mostrar selección de
          planes al público, solo qué ofrece el sistema (sección FUNCIONES
          más arriba) y el contacto por WhatsApp de abajo. Descomentar si en
          algún momento se vuelve a querer planes públicos. */}
      {/*
      <section id="planes" className="mx-auto max-w-6xl space-y-10 px-6 py-20">
        <div className="space-y-3 text-center">
          <span className="badge mx-auto">Planes</span>
          <h2 className="text-3xl font-semibold text-charcoal">Un plan para cada etapa de tu negocio</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PLANES.map((plan) => (
            <article
              key={plan.name}
              className={`glass-card flex h-full flex-col gap-4 p-6 ${plan.highlighted ? "border-blush/50 shadow-glow" : ""}`}
            >
              <div>
                <h3 className="text-xl font-semibold text-charcoal">{plan.name}</h3>
                <p className="text-xs uppercase tracking-widest text-charcoal/40">{plan.tagline}</p>
              </div>
              <ul className="flex-1 space-y-2 text-sm text-charcoal/60">
                {plan.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-champagne text-xs mt-1">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              {plan.note && <p className="text-xs text-charcoal/40">{plan.note}</p>}
              <a
                href={buildWhatsAppUrl(`Hola! Quiero más información sobre el plan ${plan.name} de Turneo.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto rounded-full border border-mauve/20 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-charcoal/70 transition hover:border-blush hover:text-charcoal"
              >
                {plan.cta}
              </a>
            </article>
          ))}
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {A_MEDIDA.map((plan) => (
            <article key={plan.name} className="glass-card flex flex-col gap-3 p-6">
              <div>
                <span className="badge">{plan.tagline}</span>
                <h3 className="mt-3 text-xl font-semibold text-charcoal">{plan.name}</h3>
              </div>
              <p className="flex-1 text-sm text-charcoal/60">{plan.description}</p>
              <a
                href={buildWhatsAppUrl(`Hola! Quiero más información sobre ${plan.name} de Turneo.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="self-start rounded-full border border-mauve/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-charcoal/70 transition hover:border-blush hover:text-charcoal"
              >
                {plan.cta}
              </a>
            </article>
          ))}
        </div>
      </section>
      */}

      {/* CONTACTO */}
      <section id="contacto" className="mx-auto max-w-3xl space-y-6 px-6 py-24 text-center">
        <span className="badge mx-auto">Sumate</span>
        <h2 className="text-3xl font-semibold text-charcoal">¿Le damos turnos a tu negocio?</h2>
        <p className="text-charcoal/70">
          Escribinos contándonos de tu negocio y coordinamos el alta de tu cuenta.
        </p>
        <a
          href={buildWhatsAppUrl("Hola! Quiero más información sobre Turneo.")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-full bg-blush px-8 py-3 text-sm font-semibold text-white shadow-glow transition [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]"
        >
          Escribinos por WhatsApp
        </a>
      </section>

      <footer className="border-t border-mauve/10 px-6 py-10 text-center text-xs text-charcoal/50">
        Turneo
      </footer>
    </main>
  );
}
