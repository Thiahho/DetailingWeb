import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Clock, Sparkles } from "lucide-react";

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
      siteName: "Gestor de Turnos",
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
    <main className="min-h-screen bg-cream pb-28 text-charcoal md:pb-16">
      {/* Hero: imagen a sangre con título superpuesto */}
      <section className="relative isolate h-[46vh] min-h-[320px] w-full overflow-hidden bg-porcelain md:h-[56vh]">
        {service.imageUrl && (
          <img
            alt={service.title}
            className="absolute inset-0 -z-10 h-full w-full object-cover"
            src={service.imageUrl}
          />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal/85 via-charcoal/35 to-charcoal/10" />

        <div className="mx-auto flex h-full max-w-5xl flex-col justify-between px-6 py-6 md:py-10">
          <Link
            href="/servicios"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white backdrop-blur transition hover:bg-white/25"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Servicios
          </Link>

          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-champagne/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-charcoal">
              <Sparkles className="h-3 w-3" /> Servicio
            </span>
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-white md:text-5xl">
              {service.title}
            </h1>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-8 px-6 md:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-8 pt-8">
          {service.description && (
            <p className="text-lg leading-relaxed text-charcoal/80">{service.description}</p>
          )}

          {service.details?.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-mauve">
                Qué incluye
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {service.details.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-2xl bg-ivory p-4 shadow-soft transition [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-elevated"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blush/20 text-blushdark">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                    <span className="text-sm font-medium leading-snug text-charcoal/85">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Tarjeta de precio / CTA: sticky en desktop, barra fija en mobile */}
        <aside className="hidden md:block md:-mt-16">
          <div className="sticky top-24 space-y-5 rounded-3xl bg-ivory p-7 shadow-elevated">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-warmgray">Precio</p>
              <p className="mt-1 text-4xl font-semibold text-blushdark">{service.price}</p>
            </div>
            {service.duration && (
              <div className="flex items-center gap-2 text-sm text-charcoal/70">
                <Clock className="h-4 w-4 text-mauve" /> {service.duration}
              </div>
            )}
            <Link
              href="/reservar"
              className="block rounded-full bg-blush px-8 py-3.5 text-center text-sm font-semibold text-white shadow-glow transition [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]"
            >
              Reservar turno
            </Link>
            <Link
              href="/#contacto"
              className="block text-center text-xs uppercase tracking-[0.18em] text-charcoal/60 transition hover:text-charcoal"
            >
              Tengo una consulta
            </Link>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t border-mauve/10 bg-ivory/95 px-6 py-3 backdrop-blur md:hidden">
        <div>
          <p className="text-lg font-semibold leading-none text-blushdark">{service.price}</p>
          {service.duration && (
            <p className="mt-1 flex items-center gap-1 text-xs text-charcoal/60">
              <Clock className="h-3 w-3" /> {service.duration}
            </p>
          )}
        </div>
        <Link
          href="/reservar"
          className="rounded-full bg-blush px-7 py-3 text-sm font-semibold text-white shadow-glow"
        >
          Reservar turno
        </Link>
      </div>
    </main>
  );
}
