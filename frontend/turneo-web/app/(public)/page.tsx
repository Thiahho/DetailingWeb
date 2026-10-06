import type { Metadata } from "next";
import { type ReactNode } from "react";
import CalculadoraCostoInaccion from "@/src/components/public/CalculadoraCostoInaccion";
import ClosingCta from "@/src/components/landing/ClosingCta";
import LandingFaq from "@/src/components/landing/LandingFaq";
import LandingHero from "@/src/components/landing/LandingHero";
import LandingNav from "@/src/components/landing/LandingNav";
import MobileCtaBar from "@/src/components/landing/MobileCtaBar";
import OwnSiteSection from "@/src/components/landing/OwnSiteSection";
import PainsSection from "@/src/components/landing/PainsSection";
import ProblemBlock from "@/src/components/landing/ProblemBlock";
import RetentionSection from "@/src/components/landing/RetentionSection";
import TrustStrip from "@/src/components/landing/TrustStrip";
import BookingPreview from "@/src/components/landing/previews/BookingPreview";
import CajaPreview from "@/src/components/landing/previews/CajaPreview";
import ReminderPreview from "@/src/components/landing/previews/ReminderPreview";
import StockPreview from "@/src/components/landing/previews/StockPreview";
import TeamPreview from "@/src/components/landing/previews/TeamPreview";
import { PROBLEMAS, WHATSAPP, type ProblemId } from "@/src/components/landing/content";

// Home comercial de Turneo (el producto/SaaS) — a diferencia de /reservar
// no depende de ningún tenant ni hace fetch a la API, es contenido estático.
// SiteChrome.tsx oculta el Navbar del negocio acá a propósito.
//
// El copy vive en src/components/landing/content.ts (ahí están también las
// reglas de qué se puede afirmar). Los "previews" son UI ilustrativa hecha en
// JSX + Tailwind con datos ficticios: no hay capturas ni imágenes.
//
// Planes: ocultos al público a propósito (no se muestra selección de planes ni
// precios; el contacto es por WhatsApp). Los datos y el markup de esa sección
// quedaron guardados, sin usar, en src/components/landing/plans.ts.

const TITLE = "Turneo — Sistema de turnos para salones de belleza";
const DESCRIPTION =
  "Agenda por profesional, reservas online las 24 hs, recordatorios automáticos, caja diaria y control de insumos para peluquerías, uñas, pestañas y estética.";

// Sin `images`: el Open Graph de la página reemplaza al del layout, y no hay
// una imagen social propia de la home para referenciar.
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Turneo",
    locale: "es_AR",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const PREVIEWS: Record<ProblemId, ReactNode> = {
  ausencias: <ReminderPreview />,
  reservas: <BookingPreview />,
  caja: <CajaPreview />,
  insumos: <StockPreview />,
  equipo: <TeamPreview />,
};

export default function ComercialHome() {
  return (
    <>
      <LandingNav />
      <main className="bg-cream text-charcoal">
        <LandingHero />
        <PainsSection />

        {/* Un bloque por problema: alternan ink/cream y el lado del preview. */}
        {PROBLEMAS.map((problem, i) => (
          <ProblemBlock
            key={problem.id}
            content={problem}
            tone={i % 2 === 0 ? "ink" : "cream"}
            flip={i % 2 === 1}
            preview={PREVIEWS[problem.id]}
          />
        ))}

        <CalculadoraCostoInaccion />
        <OwnSiteSection />
        <RetentionSection />
        <TrustStrip />
        <LandingFaq />
        <ClosingCta />
      </main>

      <footer className="bg-ink px-6 pb-10 text-center text-xs text-mist">
        <div className="mx-auto max-w-6xl border-t border-cream/15 pt-8">
          <p className="text-sm font-semibold text-cream">Turneo</p>
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-1 gap-y-0">
            <a href="/terminos" className="flex min-h-[44px] items-center px-2 transition hover:text-cream">
              Términos y Condiciones
            </a>
            <a href="/privacidad" className="flex min-h-[44px] items-center px-2 transition hover:text-cream">
              Política de Privacidad
            </a>
          </p>
        </div>
      </footer>

      <MobileCtaBar href={WHATSAPP.hero} label="Quiero sumar mi salón" hideWhenVisible={["hero-cta", "contacto"]} />
    </>
  );
}
