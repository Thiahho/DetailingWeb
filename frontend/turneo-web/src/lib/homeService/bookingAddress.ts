// Client side of the at-home booking address. The backend re-checks every
// rule (coverage, lengths, surcharge); these helpers only give early feedback
// and build the `homeAddress` payload of `POST /api/bookings`.

/** Row of the public `GET /api/home-service/coverage-localities/active`. */
export interface ActiveCoverageLocality {
  id: number;
  name: string;
  province: string;
  surcharge: number | null;
}

export interface HomeAddressForm {
  coverageLocalityId: number | null;
  street: string;
  details: string;
  notes: string;
}

export interface HomeAddressPayload {
  street: string;
  details?: string;
  notes?: string;
  coverageLocalityId: number;
}

export const EMPTY_HOME_ADDRESS: HomeAddressForm = { coverageLocalityId: null, street: "", details: "", notes: "" };

// Same limits and messages as the backend `HomeServiceBookingPolicy`.
export const STREET_MAX_LENGTH = 200;
export const DETAILS_MAX_LENGTH = 100;
export const NOTES_MAX_LENGTH = 500;
const MISSING_STREET = "Ingresá la dirección (calle y número) para el servicio a domicilio";
const MISSING_LOCALITY = "Elegí la localidad del servicio a domicilio";
const TOO_LONG = "La dirección supera el largo permitido";

export function parseActiveCoverageLocalities(data: unknown): ActiveCoverageLocality[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const { id, name, province, surcharge } = row as Record<string, unknown>;
    if (typeof id !== "number" || typeof name !== "string" || !name.trim()) return [];
    return [
      {
        id,
        name,
        province: typeof province === "string" ? province : "",
        surcharge: typeof surcharge === "number" ? surcharge : null,
      },
    ];
  });
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Coverage locality for a place resolved from a Maps link. The locality name
 * wins over the partido; the province must match when the place has one, and a
 * name shared by several provinces is not guessed without it.
 */
export function matchCoverageLocality(
  place: { localidad: string; partido: string; provincia: string },
  localities: ActiveCoverageLocality[]
): ActiveCoverageLocality | null {
  const province = fold(place.provincia);
  for (const name of [place.localidad, place.partido].map(fold).filter(Boolean)) {
    const sameName = localities.filter((l) => fold(l.name) === name);
    const candidates = province ? sameName.filter((l) => fold(l.province) === province) : sameName;
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) return province ? candidates[0] : null;
  }
  return null;
}

// `never` members keep the narrowing working with `strict: false`.
export type HomeAddressResult =
  | { ok: true; value: HomeAddressPayload; message?: never }
  | { ok: false; message: string; value?: never };

export function buildHomeAddressPayload(form: HomeAddressForm): HomeAddressResult {
  const street = form.street.trim();
  const details = form.details.trim();
  const notes = form.notes.trim();
  if (form.coverageLocalityId === null) return { ok: false, message: MISSING_LOCALITY };
  if (!street) return { ok: false, message: MISSING_STREET };
  if (street.length > STREET_MAX_LENGTH || details.length > DETAILS_MAX_LENGTH || notes.length > NOTES_MAX_LENGTH) {
    return { ok: false, message: TOO_LONG };
  }
  return {
    ok: true,
    value: {
      street,
      ...(details ? { details } : {}),
      ...(notes ? { notes } : {}),
      coverageLocalityId: form.coverageLocalityId,
    },
  };
}

export const isHomeAddressComplete = (form: HomeAddressForm) => buildHomeAddressPayload(form).ok;

/** Mirrors the backend `PaymentAmountResolver`: dots are thousands separators, the comma is the decimal one. */
export function parseServicePrice(price: string | null | undefined): number | null {
  if (!price) return null;
  const normalized = price.replace(/[\s$]/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return value > 0 ? value : null;
}

/** Display-only: the server decides the charged amount. */
export function homeServicePriceBreakdown({
  servicePrice,
  promotionPrice,
  surcharge,
}: {
  servicePrice: string | null | undefined;
  promotionPrice: number | null;
  surcharge: number | null;
}): { base: number | null; surcharge: number; total: number | null } {
  const base = promotionPrice && promotionPrice > 0 ? promotionPrice : parseServicePrice(servicePrice);
  const extra = surcharge ?? 0;
  return { base, surcharge: extra, total: base === null ? null : base + extra };
}

export function coverageWhatsAppMessage({
  serviceTitle,
  street,
  locality,
}: {
  serviceTitle: string;
  street: string;
  locality: string;
}): string {
  const where = [street.trim(), locality.trim()].filter(Boolean).join(", ");
  return `Hola, quiero consultar si pueden hacer el servicio "${serviceTitle}" a domicilio${
    where ? ` en ${where}` : ""
  }. Mi zona no figura en la lista de cobertura.`;
}
