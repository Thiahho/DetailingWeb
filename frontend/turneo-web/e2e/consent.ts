import type { Page } from "@playwright/test";

// Mismo formato que src/lib/consent.ts — mantenerlos sincronizados si cambia
// la forma de la cookie ahí.
const CONSENT_COOKIE = "turneo_consent";
const CONSENT_VERSION = 1;

/**
 * Preseedea la decisión de cookies antes de navegar, para que specs que no
 * están probando el banner en sí (booking, mis-turnos) no lo vean tapando el
 * footer/formularios. Por default simula "solo necesarias" (sin cachear
 * datos), para no introducir efectos de caché en tests que no los esperan —
 * pasar `{ preferences: true }` en los specs que sí quieren probar la caché.
 */
export async function seedConsent(
  page: Page,
  overrides: { preferences?: boolean; analytics?: boolean } = {}
): Promise<void> {
  const value = JSON.stringify({
    v: CONSENT_VERSION,
    ts: Date.now(),
    preferences: overrides.preferences ?? false,
    analytics: overrides.analytics ?? false,
  });
  await page.context().addCookies([
    {
      name: CONSENT_COOKIE,
      value: encodeURIComponent(value),
      url: "http://localhost:3000",
    },
  ]);
}
