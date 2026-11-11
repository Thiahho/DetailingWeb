import { availabilityLabel } from "@/src/lib/catalog/enums";
import type { CatalogAvailability } from "@/src/lib/catalog/types";

// Disponible = ready to deliver; A pedido = made or ordered after the purchase.
export default function AvailabilityBadge({ availability, className = "" }: { availability: CatalogAvailability; className?: string }) {
  const tone =
    availability === 0
      ? "border-emerald-600/20 bg-emerald-50 text-emerald-800"
      : "border-champagne/40 bg-champagne/10 text-[#7A5C2E]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone} ${className}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${availability === 0 ? "bg-emerald-600" : "bg-champagne"}`} />
      {availabilityLabel(availability)}
    </span>
  );
}
