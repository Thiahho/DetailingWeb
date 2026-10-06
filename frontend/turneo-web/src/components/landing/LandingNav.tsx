import Image from "next/image";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { BOOKING_CTA, NAV_LINKS, WHATSAPP } from "@/src/components/landing/content";

// Barra superior de la home comercial. SiteChrome.tsx oculta acá el Navbar del
// negocio (ese es del tenant), así que esta es la única navegación de la página.
// Planes ocultos al público a propósito: no hay link a planes.
export default function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-cream/10 bg-ink/90 text-cream backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <a
          href="#inicio"
          className="flex min-h-[44px] items-center gap-2.5 text-2xl font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blush"
        >
          {/* Isotipo de Turneo. El archivo es de 2000px: next/image lo sirve al
              tamaño real de la barra. Decorativo: el nombre ya está en el texto. */}
          <Image src="/img/logo.png" alt="" width={40} height={40} priority className="h-9 w-9 shrink-0 rounded-full" />
          <span>
            Turneo<span aria-hidden="true" className="text-blush">.</span>
          </span>
        </a>
        <nav aria-label="Secciones" className="hidden items-center gap-1 text-sm text-mist md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="flex min-h-[44px] items-center rounded-full px-4 transition-colors hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-blush"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          {/* Único botón relleno de la barra: rosa sobre fondo oscuro, con un
              halo que late despacio para que se vea de entrada. El halo se
              apaga con "reducir movimiento". */}
          <Link
            href={BOOKING_CTA.href}
            data-testid="nav-booking-cta"
            className="flex min-h-[44px] items-center gap-2 rounded-full bg-blush px-5 text-sm font-semibold text-ink transition hover:bg-cream motion-safe:animate-halo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream [@media(hover:hover)]:hover:scale-[1.04]"
          >
            <CalendarCheck size={17} strokeWidth={2.2} aria-hidden="true" />
            {BOOKING_CTA.label}
          </Link>
        <a
          href={WHATSAPP.nav}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden min-h-[44px] items-center rounded-full border border-cream/30 px-5 sm:flex text-sm font-semibold text-cream transition hover:border-cream/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blush"
        >
          Hablemos
        </a>
        </div>
      </div>
    </header>
  );
}
