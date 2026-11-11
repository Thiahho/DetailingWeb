import type { CatalogAvailability, CatalogMediaType } from "./types";

// Backend enum CatalogAvailability: Disponible = 0, APedido = 1.
export const AVAILABILITY_OPTIONS: { value: CatalogAvailability; label: string }[] = [
  { value: 0, label: "Disponible" },
  { value: 1, label: "A pedido" },
];

export function availabilityLabel(value: CatalogAvailability): string {
  return AVAILABILITY_OPTIONS.find((o) => o.value === value)?.label ?? "Desconocida";
}

// Parses a <select> value; anything outside the enum is rejected.
export function toAvailability(raw: string): CatalogAvailability | null {
  if (raw === "0") return 0;
  if (raw === "1") return 1;
  return null;
}

// Backend enum CatalogMediaType: Image = 0, Video = 1.
export const MEDIA_IMAGE: CatalogMediaType = 0;
export const MEDIA_VIDEO: CatalogMediaType = 1;

export function mediaTypeLabel(value: CatalogMediaType): string {
  return value === MEDIA_VIDEO ? "Video" : "Imagen";
}
