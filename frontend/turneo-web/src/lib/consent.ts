// Consentimiento de cookies del sitio público. Cookie legible por el
// cliente (no HttpOnly a propósito: el JS de esta misma página necesita
// leerla para decidir si activa la caché de src/lib/publicDataCache.ts).
// No es un token de sesión, solo la decisión del visitante.
export const CONSENT_COOKIE = "turneo_consent";
// Subir este número invalida cualquier cookie vieja (aunque el texto de la
// barra no haya cambiado) y vuelve a preguntar — usar si se agrega una
// categoría nueva o cambia lo que implica aceptar.
export const CONSENT_VERSION = 1;
const MAX_AGE_DAYS = 180;

export type ConsentCategory = "preferences" | "analytics";

export interface Consent {
  v: number;
  ts: number;
  preferences: boolean;
  analytics: boolean;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAgeDays: number): void {
  if (typeof document === "undefined") return;
  const maxAge = maxAgeDays * 24 * 60 * 60;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

// Lee la decisión guardada. Devuelve null si nunca decidió o si la versión
// quedó vieja (fuerza a volver a preguntar).
export function readConsent(): Consent | null {
  const raw = getCookie(CONSENT_COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Consent>;
    if (parsed.v !== CONSENT_VERSION) return null;
    return {
      v: CONSENT_VERSION,
      ts: typeof parsed.ts === "number" ? parsed.ts : Date.now(),
      preferences: !!parsed.preferences,
      analytics: !!parsed.analytics,
    };
  } catch {
    return null;
  }
}

// Guarda la decisión y avisa al resto de la app (mismo patrón que el evento
// "auth-change" de src/lib/auth.ts) para que useConsent() en otras pestañas
// del componente/hooks reaccione sin recargar.
export function writeConsent(preferences: boolean, analytics: boolean): Consent {
  const consent: Consent = { v: CONSENT_VERSION, ts: Date.now(), preferences, analytics };
  setCookie(CONSENT_COOKIE, JSON.stringify(consent), MAX_AGE_DAYS);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("consent-change", { detail: consent }));
  }
  return consent;
}

export function hasConsent(category: ConsentCategory): boolean {
  const consent = readConsent();
  return !!consent?.[category];
}

export function clearConsent(): void {
  deleteCookie(CONSENT_COOKIE);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("consent-change", { detail: null }));
  }
}
