import { CalendarCheck, Database, KeyRound, ShieldCheck } from "lucide-react";
import Reveal from "@/src/components/public/Reveal";
import SectionHeading from "@/src/components/landing/SectionHeading";
import { TRUST } from "@/src/components/landing/content";

// Mismo orden que TRUST.items en content.ts.
const ICONS = [CalendarCheck, Database, KeyRound, ShieldCheck];

// Franja de garantías: cuatro compromisos del sistema, en una sola fila con
// separadores (no cards), sobre fondo ink.
export default function TrustStrip() {
  return (
    <section id="garantias" className="scroll-mt-16 bg-ink text-cream">
      <div className="mx-auto max-w-6xl space-y-10 px-6 py-20 md:space-y-14 md:py-24">
        <Reveal>
          <SectionHeading eyebrow={TRUST.eyebrow} title={TRUST.title} tone="ink" />
        </Reveal>
        <Reveal stagger className="grid border-t border-cream/15 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.items.map(({ title, detail }, i) => {
            const Icon = ICONS[i];
            return (
              <div
                key={title}
                className="flex gap-4 border-b border-cream/15 py-6 sm:pr-8 lg:flex-col lg:border-b-0 lg:border-l lg:py-2 lg:pl-6 lg:pr-6 lg:first:border-l-0 lg:first:pl-0"
              >
                <Icon aria-hidden="true" size={24} strokeWidth={1.7} className="mt-0.5 shrink-0 text-champagne" />
                <div className="space-y-1.5">
                  <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="text-sm leading-relaxed text-mist">{detail}</p>
                </div>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
