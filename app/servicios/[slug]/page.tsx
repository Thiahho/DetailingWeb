import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

interface Service {
  id: number;
  title: string;
  slug: string;
  price: string;
  duration: string | null;
  imageUrl: string;
  description: string;
  details: string[];
}

async function getService(slug: string): Promise<Service | null> {
  try {
    const res = await fetch(`${API_URL}/api/services/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const service = await getService(params.slug);
  if (!service) return { title: "Servicio no encontrado" };

  return {
    title: service.title,
    description: service.description || `${service.title} en Moreno, Zona Oeste.`,
    alternates: { canonical: `${siteUrl}/servicios/${params.slug}` },
    openGraph: {
      title: service.title,
      description: service.description || `${service.title} en Moreno, Zona Oeste.`,
      url: `${siteUrl}/servicios/${params.slug}`,
      siteName: "Detailing Cars",
      locale: "es_AR",
      images: [{ url: "/img/og.jpg", width: 1200, height: 630, alt: `Detalle del servicio ${service.title}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: service.title,
      description: service.description || `${service.title} en Moreno, Zona Oeste.`,
      images: ["/img/og.jpg"],
    },
  };
}

export default async function ServiceDetail({ params }: { params: { slug: string } }) {
  const service = await getService(params.slug);
  if (!service) notFound();

  return (
    <main className="min-h-screen bg-midnight px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-10">
        <Link href="/servicios" className="text-xs uppercase tracking-[0.2em] text-white/60 hover:text-white transition">
          ← Volver a servicios
        </Link>

        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <span className="badge">Detalle del servicio</span>
            <h1 className="text-4xl font-semibold">{service.title}</h1>

            {service.description && (
              <p className="text-white/70 leading-relaxed">{service.description}</p>
            )}

            <div className="flex flex-wrap gap-3 text-sm">
              {service.duration && (
                <span className="rounded-full border border-white/10 px-4 py-2 text-white/70">
                  ⏱ {service.duration}
                </span>
              )}
              <span className="rounded-full border border-lux/50 px-4 py-2 text-lux">
                {service.price}
              </span>
            </div>

            {service.details?.length > 0 && (
              <ul className="glass-card space-y-2 p-6 text-sm text-white/70">
                {service.details.map((item, i) => (
                  <li key={i}>✔ {item}</li>
                ))}
              </ul>
            )}

            <Link
              href={`/#contacto`}
              className="inline-block rounded-full bg-lux px-8 py-3 text-sm font-semibold text-black shadow-gold transition hover:scale-[1.02]"
            >
              Presupuestar
            </Link>
          </div>

          {service.imageUrl && (
            <div className="glass-card overflow-hidden rounded-2xl border border-white/10">
              <img
                alt={service.title}
                className="h-full w-full object-cover"
                src={service.imageUrl}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
