import { NAV_LINKS, WHATSAPP } from "@/src/components/landing/content";

// Barra superior de la home comercial. SiteChrome.tsx oculta acá el Navbar del
// negocio (ese es del tenant), así que esta es la única navegación de la página.
// Planes ocultos al público a propósito: no hay link a planes.
export default function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-cream/10 bg-ink/90 text-cream backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <a
          href="#inicio"
          className="flex min-h-[44px] items-center text-2xl font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blush"
        >
          Turneo<span aria-hidden="true" className="text-blush">.</span>
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
        <a
          href={WHATSAPP.nav}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[44px] items-center rounded-full border border-cream/30 px-5 text-sm font-semibold text-cream transition hover:border-cream/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blush"
        >
          Hablemos
        </a>
      </div>
    </header>
  );
}
