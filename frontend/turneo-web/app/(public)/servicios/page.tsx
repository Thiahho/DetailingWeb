"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Service {
  id: number;
  title: string;
  slug: string;
  price: string;
  duration: string | null;
  imageUrl: string;
  description: string;
}

export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((d) => setServices(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-cream px-6 py-16 text-charcoal">
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="space-y-3">
          <span className="badge">Servicios</span>
          <h1 className="text-4xl font-semibold text-charcoal">Servicios disponibles</h1>
          <p className="text-charcoal/70">
            Elegí el servicio ideal. Turnos rápidos y resultados garantizados.
          </p>
        </div>

        {loading && (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card h-72 animate-pulse bg-mauve/5 rounded-2xl" />
            ))}
          </div>
        )}

        {!loading && (
          <div className="grid gap-6 md:grid-cols-3">
            {services.map((service) => (
              <article key={service.id} className="glass-card flex h-full flex-col gap-4 p-6">
                <div className="overflow-hidden rounded-xl border border-mauve/10">
                  <img
                    src={service.imageUrl}
                    alt={service.title}
                    className="h-40 w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-charcoal">{service.title}</h2>
                  {service.description && (
                    <p className="text-sm text-charcoal/60 line-clamp-2">{service.description}</p>
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between pt-4 border-t border-mauve/10">
                  <span className="text-lg font-semibold text-blushdark">${service.price}</span>
                  <Link
                    href={`/servicios/${service.slug}`}
                    className="rounded-full border border-mauve/15 px-4 py-2 text-xs uppercase text-charcoal/60 hover:text-charcoal hover:border-mauve/30 transition-all"
                  >
                    Ver detalle
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
