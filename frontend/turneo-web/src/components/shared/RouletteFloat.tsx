import Link from "next/link";
import { Gift } from "lucide-react";

// Botón flotante que lleva al cliente a /beneficios (la ruleta de
// fidelización). Apilado arriba de WhatsAppFloat (bottom-6, h-14) para que no
// se superpongan — ver WhatsAppFloat.tsx.
export default function RouletteFloat() {
  return (
    <Link
      href="/beneficios"
      aria-label="Girá la ruleta de beneficios"
      className="fixed bottom-24 right-6 z-50 flex items-center gap-2 rounded-full bg-blush px-4 py-3 text-sm font-semibold uppercase tracking-wide text-cream shadow-glow transition-transform hover:scale-110"
    >
      <Gift className="h-5 w-5" strokeWidth={2.25} />
      <span className="hidden sm:inline">¡Girá y ganá!</span>
    </Link>
  );
}
