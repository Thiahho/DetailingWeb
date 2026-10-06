import Link from "next/link";
import Reveal from "@/src/components/public/Reveal";
import SectionHeading from "@/src/components/landing/SectionHeading";
import SitePhonePreview from "@/src/components/landing/previews/SitePhonePreview";
import { OWN_SITE } from "@/src/components/landing/content";

// "Tu salón con su propia web": cada salón tiene su página pública (/reservar
// en su dominio). El enlace secundario muestra esa página funcionando.
export default function OwnSiteSection() {
  return (
    <section id="tu-web" className="scroll-mt-16 overflow-hidden bg-ink text-cream">
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-6 py-20 md:py-28 lg:flex-row lg:items-center lg:gap-16">
        <Reveal className="space-y-6 lg:flex-[1.15]">
          <SectionHeading eyebrow={OWN_SITE.eyebrow} title={OWN_SITE.title} tone="ink" />
          <p className="max-w-lg text-[17px] leading-relaxed text-mist">{OWN_SITE.lead}</p>
          <dl className="grid max-w-xl grid-cols-1 border-t border-cream/15 sm:grid-cols-2 sm:gap-x-10">
            {OWN_SITE.items.map(({ title, detail }) => (
              <div key={title} className="border-b border-cream/15 py-4">
                <dt className="text-base font-semibold text-cream">{title}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-mist">{detail}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/reservar"
            className="group inline-flex min-h-[48px] items-center gap-2 rounded-full border border-cream/30 px-6 text-sm font-semibold text-cream transition hover:-translate-y-0.5 hover:border-cream/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blush"
          >
            {OWN_SITE.demoLabel}
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </Reveal>
        <Reveal className="lg:flex-1">
          <SitePhonePreview />
        </Reveal>
      </div>
    </section>
  );
}
