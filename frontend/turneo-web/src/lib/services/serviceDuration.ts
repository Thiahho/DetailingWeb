// How long a booking of a service blocks the agenda, in whole minutes. Mirrors
// the backend `Service.DurationMinutes` (nullable, 5–1440). Null means the
// booking lasts its start slot. `PUT /api/services/{id}` is a full replace: a
// payload without `durationMinutes` clears it, so every create/update payload
// goes through `withDurationMinutes`.
export const DURATION_MINUTES_MIN = 5;
export const DURATION_MINUTES_MAX = 1440;
export const DURATION_MINUTES_ERROR = `La duración del turno debe ser un número entero entre ${DURATION_MINUTES_MIN} y ${DURATION_MINUTES_MAX} minutos.`;

// Whole minutes in range, or null for an empty or invalid value.
export function parseDurationMinutes(value: unknown): number | null {
  let minutes: number;
  if (typeof value === "number") {
    minutes = value;
  } else if (typeof value === "string" && /^\s*\d+\s*$/.test(value)) {
    minutes = Number(value.trim());
  } else {
    return null;
  }
  return Number.isInteger(minutes) && minutes >= DURATION_MINUTES_MIN && minutes <= DURATION_MINUTES_MAX
    ? minutes
    : null;
}

// Error message for the form input; null when it is empty or valid.
export function validateDurationMinutesInput(input: string): string | null {
  if (input.trim() === "") return null;
  return parseDurationMinutes(input) === null ? DURATION_MINUTES_ERROR : null;
}

export function durationMinutesToInput(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

export function withDurationMinutes<T extends object>(
  payload: T,
  durationMinutes: unknown
): Omit<T, "durationMinutes"> & { durationMinutes: number | null } {
  return { ...payload, durationMinutes: parseDurationMinutes(durationMinutes) };
}
