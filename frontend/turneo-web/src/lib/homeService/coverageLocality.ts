import type { LocalidadSuggestion } from "@/src/lib/geo/geo";

// Contract of `api/home-service/coverage-localities` (Admin only).
export interface CoverageLocality {
  id: number;
  name: string;
  province: string;
  georefId: string | null;
  surcharge: number | null;
  isActive: boolean;
}

export type CoverageLocalityRequest = Omit<CoverageLocality, "id">;

// Same upper bound as the backend `[Range(0, 9_999_999_999.99)]`.
export const MAX_SURCHARGE = 9_999_999_999.99;

export type SurchargeParse = { ok: true; value: number | null } | { ok: false; message: string };

const AMOUNT_RE = /^\d+(,\d{1,2})?$/;

/** Parses "1.500", "$ 12.345,50" or "" (no surcharge). Dots are thousands separators, the comma is the decimal one. */
export function parseSurcharge(input: string): SurchargeParse {
  const cleaned = input.replace(/[\s$]/g, "");
  if (!cleaned) return { ok: true, value: null };

  const digits = cleaned.replace(/\./g, "");
  if (!AMOUNT_RE.test(digits)) {
    return { ok: false, message: "El recargo debe ser un importe válido, mayor o igual a 0 y con hasta 2 decimales" };
  }

  const value = Number(digits.replace(",", "."));
  if (value > MAX_SURCHARGE) {
    return { ok: false, message: "El recargo es demasiado alto" };
  }
  return { ok: true, value };
}

/** Inverse of `parseSurcharge`: 1500.5 -> "1.500,50". */
export function formatSurcharge(value: number | null): string {
  if (value === null) return "";
  const [integer, decimals] = value.toFixed(2).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimals === "00" ? grouped : `${grouped},${decimals}`;
}

/**
 * Name and province come from the picked Georef suggestion. The geo proxy does
 * not return the Georef id, so it stays null and the backend deduplicates by
 * name and province.
 */
export function coverageLocalityFromSuggestion(
  suggestion: LocalidadSuggestion
): Pick<CoverageLocalityRequest, "name" | "province" | "georefId"> {
  return { name: suggestion.nombre.trim(), province: suggestion.provincia.trim(), georefId: null };
}

/** The PUT is a full replace: start from the stored locality so fields the screen does not edit (georefId) survive. */
export function toCoverageLocalityRequest(
  locality: CoverageLocality,
  patch: Partial<CoverageLocalityRequest> = {}
): CoverageLocalityRequest {
  const { name, province, georefId, surcharge, isActive } = locality;
  return { name, province, georefId, surcharge, isActive, ...patch };
}
