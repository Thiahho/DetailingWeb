// Sección de PLANES de la home comercial — DESHABILITADA a propósito: no se
// quiere mostrar selección de planes ni precios al público, solo qué resuelve
// el sistema y el contacto por WhatsApp. Este archivo no se importa desde
// ningún lado; conserva tal cual los datos y el markup que estaban comentados
// en app/(public)/page.tsx antes del rediseño de la landing, para cuando se
// vuelva a habilitar (ahí habrá que adaptar el markup al lenguaje visual nuevo
// y revisar que cada ítem siga siendo cierto: hoy Mercado Pago y los avisos
// automáticos por WhatsApp NO están disponibles).

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

// --- Markup original de la sección (JSX) ---
//       <section id="planes" className="mx-auto max-w-6xl space-y-10 px-6 py-20">
//         <div className="space-y-3 text-center">
//           <span className="badge mx-auto">Planes</span>
//           <h2 className="text-3xl font-semibold text-charcoal">Un plan para cada etapa de tu negocio</h2>
//         </div>
//         <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
//           {PLANES.map((plan) => (
//             <article
//               key={plan.name}
//               className={`glass-card flex h-full flex-col gap-4 p-6 ${plan.highlighted ? "border-blush/50 shadow-glow" : ""}`}
//             >
//               <div>
//                 <h3 className="text-xl font-semibold text-charcoal">{plan.name}</h3>
//                 <p className="text-xs uppercase tracking-widest text-charcoal/40">{plan.tagline}</p>
//               </div>
//               <ul className="flex-1 space-y-2 text-sm text-charcoal/60">
//                 {plan.items.map((item) => (
//                   <li key={item} className="flex items-start gap-2">
//                     <span className="text-champagne text-xs mt-1">✓</span>
//                     {item}
//                   </li>
//                 ))}
//               </ul>
//               {plan.note && <p className="text-xs text-charcoal/40">{plan.note}</p>}
//               <a
//                 href={buildWhatsAppUrl(`Hola! Quiero más información sobre el plan ${plan.name} de Turneo.`)}
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 className="mt-auto rounded-full border border-mauve/20 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-charcoal/70 transition hover:border-blush hover:text-charcoal"
//               >
//                 {plan.cta}
//               </a>
//             </article>
//           ))}
//         </div>
// 
//         <div className="grid gap-6 sm:grid-cols-2">
//           {A_MEDIDA.map((plan) => (
//             <article key={plan.name} className="glass-card flex flex-col gap-3 p-6">
//               <div>
//                 <span className="badge">{plan.tagline}</span>
//                 <h3 className="mt-3 text-xl font-semibold text-charcoal">{plan.name}</h3>
//               </div>
//               <p className="flex-1 text-sm text-charcoal/60">{plan.description}</p>
//               <a
//                 href={buildWhatsAppUrl(`Hola! Quiero más información sobre ${plan.name} de Turneo.`)}
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 className="self-start rounded-full border border-mauve/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-charcoal/70 transition hover:border-blush hover:text-charcoal"
//               >
//                 {plan.cta}
//               </a>
//             </article>
//           ))}
//         </div>
//       </section>

export {};
