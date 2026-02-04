import type { Metadata } from "next";
import Link from "next/link";
import { services } from "../../src/lib/service";

const siteUrl = "https://detailing-web-five.vercel.app";

export const metadata: Metadata = {
  title: "Servicios",
  description:
    "Conocé nuestros packs de detailing automotriz: limpieza profunda, corrección de pintura y protección cerámica en Moreno.",
  alternates: {
    canonical: `${siteUrl}/servicios`,
  },
  openGraph: {
    title: "Servicios",
    description:
      "Conocé nuestros packs de detailing automotriz: limpieza profunda, corrección de pintura y protección cerámica en Moreno.",
    url: `${siteUrl}/servicios`,
    siteName: "Detailing Cars",
    locale: "es_AR",
    images: [
      {
        url: "/img/og.jpg",
        width: 1200,
        height: 630,
        alt: "Servicios de detailing automotriz",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Servicios",
    description:
      "Conocé nuestros packs de detailing automotriz: limpieza profunda, corrección de pintura y protección cerámica en Moreno.",
    images: ["/img/og.jpg"],
  },
};

export default function ServiciosPage() {
  return (
    <main className="min-h-screen bg-midnight px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="space-y-3">
          <span className="badge">Packs premium</span>
          <h1 className="text-4xl font-semibold">Servicios de detailing</h1>
          <p className="text-white/70">
            Elegí el servicio ideal para tu auto. Turnos rápidos y resultados
            premium en Moreno.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {Object.entries(services).map(([slug, service]) => (
            <article
              key={slug}
              className="glass-card flex h-full flex-col gap-4 p-6"
            >
              <div className="overflow-hidden rounded-xl border border-white/10">
                <img
                  src={service.image}
                  alt={`Servicio ${service.title}`}
                  className="h-40 w-full object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">{service.title}</h2>
                <p className="text-sm text-white/70">{service.summary}</p>
              </div>
              <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/5">
                <span className="text-lg font-semibold text-lux">
                  {service.price}
                </span>
                <Link
                  href={`/servicios/${slug}`}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase text-white/60 hover:text-white hover:border-lux/50 transition-all"
                >
                  Ver detalle
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}