// Contract of `api/home-service/travel-buffer` (Admin only): `{ minutes }`.
export interface TravelBuffer {
  minutes: number;
}

// Same bounds as the backend (BusinessSettings.MaxHomeServiceTravelBufferMinutes).
export const MAX_TRAVEL_BUFFER_MINUTES = 240;

export type TravelBufferParse = { ok: true; value: number } | { ok: false; message: string };

const MINUTES_RE = /^\d{1,4}$/;

/** Whole minutes from 0 to 240; anything else (empty, decimals, signs) is rejected. */
export function parseTravelBufferMinutes(input: string): TravelBufferParse {
  const cleaned = input.trim();
  const value = MINUTES_RE.test(cleaned) ? Number(cleaned) : NaN;
  if (!Number.isInteger(value) || value > MAX_TRAVEL_BUFFER_MINUTES) {
    return { ok: false, message: `El tiempo de traslado debe ser un número entero de 0 a ${MAX_TRAVEL_BUFFER_MINUTES} minutos` };
  }
  return { ok: true, value };
}

/** True only for a valid value that differs from the saved one (enables the save button). */
export function isTravelBufferChanged(input: string, saved: number): boolean {
  const parsed = parseTravelBufferMinutes(input);
  return parsed.ok && parsed.value !== saved;
}
