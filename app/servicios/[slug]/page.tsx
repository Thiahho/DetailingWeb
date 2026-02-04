import type { Metadata } from "next";
import { services } from "../../../src/lib/service";

const siteUrl = "https://detailing-web-five.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const service = services[params.slug] ?? services["daily-reset"];
  const description =
    service.description ??
    `${service.title} en Moreno, Zona Oeste. ${service.summary}`;
  const canonicalUrl = `${siteUrl}/servicios/${params.slug}`;

  return {
    title: service.title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: service.title,
      description,
      url: canonicalUrl,
      siteName: "Detailing Cars",
      locale: "es_AR",
      images: [
        {
          url: "/img/og.jpg",
          width: 1200,
          height: 630,
          alt: `Detalle del servicio ${service.title}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: service.title,
      description,
      images: ["/img/og.jpg"],
    },
  };
}

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