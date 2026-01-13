type Service = {
  title: string;
  price: string;
  time: string;
  summary: string;
  image: string;
  highlights: string[];
  includes: string[];
};

const services: Record<string, Service> = {
  "daily-reset": {
    title: "Pack Daily Reset",
    price: "Desde $45.000",
    time: "4-6 hs",
    summary: "Limpieza profunda para el auto de uso diario, con foco en interior y detalles visibles.",
    image:
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
    highlights: [
      "Resultados visibles en el mismo día",
      "Ideal para autos daily y camionetas",
      "Entrega rápida coordinada por WhatsApp"
    ],
    includes: [
      "Lavado premium exterior",
      "Limpieza profunda de interior",
      "Renovación de plásticos y detalles",
      "Sellado rápido para brillo inmediato"
    ]
  },
  "brillo-total": {
    title: "Pack Brillo Total",
    price: "Desde $85.000",
    time: "1-2 días",
    summary: "Corrección de pintura ligera + sellado cerámico para lograr brillo espejo y protección.",
    image:
      "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80",
    highlights: [
      "Brillo profundo con corrección 1 paso",
      "Sellador cerámico 6 meses",
      "Incluye detailing interior completo"
    ],
    includes: [
      "Corrección de pintura 1 paso",
      "Descontaminado y pulido",
      "Sellador cerámico 6 meses",
      "Detailing interior completo"
    ]
  },
  "proteccion-pro": {
    title: "Pack Protección Pro",
    price: "Desde $180.000",
    time: "2-4 días",
    summary: "Protección premium con coating cerámico + PPF parcial para autos nuevos o alta gama.",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    highlights: [
      "Coating cerámico 3-5 años",
      "PPF parcial frontal",
      "Garantía escrita y plan de mantenimiento"
    ],
    includes: [
      "Preparación de superficie",
      "Aplicación cerámica premium",
      "PPF frontal parcial",
      "Checklist y plan de mantenimiento"
    ]
  }
};

export default function ServiceDetail({ params }: { params: { slug: string } }) {
  const service = services[params.slug] ?? services["daily-reset"];

  return (
    <main className="min-h-screen bg-midnight px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-10">
        <a className="text-xs uppercase tracking-[0.2em] text-white/60" href="/">
          ← Volver al inicio
        </a>

        <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <span className="badge">Detalle del servicio</span>
            <h1 className="text-4xl font-semibold">{service.title}</h1>
            <p className="text-white/70">{service.summary}</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="rounded-full border border-white/10 px-4 py-2 text-white/70">
                {service.time}
              </span>
              <span className="rounded-full border border-lux/50 px-4 py-2 text-lux">
                {service.price}
              </span>
            </div>

            <div className="glass-card space-y-3 p-6 text-sm text-white/70">
              {service.highlights.map((item) => (
                <p key={item}>✔ {item}</p>
              ))}
            </div>
          </div>

          <div className="glass-card overflow-hidden border border-white/10">
            <img alt={`Imagen ${service.title}`} className="h-full w-full object-cover" src={service.image} />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold">¿Qué incluye?</h2>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              {service.includes.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold">Reservá tu turno</h2>
            <p className="mt-3 text-sm text-white/70">
              Coordiná por WhatsApp o dejá tu consulta para confirmar disponibilidad en Moreno.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                className="rounded-full bg-lux px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-black shadow-gold"
                href="https://wa.me/5491112345678"
              >
                WhatsApp
              </a>
              <a
                className="rounded-full border border-white/15 px-6 py-3 text-xs uppercase tracking-[0.2em] text-white/70"
                href="/#contacto"
              >
                Consulta online
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}