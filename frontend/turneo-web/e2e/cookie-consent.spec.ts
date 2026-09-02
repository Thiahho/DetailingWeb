import { test, expect } from "@playwright/test";

// No usa seedConsent (e2e/consent.ts) a propósito: este spec prueba el
// propio flujo de decisión, así que necesita arrancar sin cookie.
test.describe("Banner de consentimiento de cookies", () => {
  test("aparece en la primera visita; 'solo necesarias' no deja datos cacheados", async ({ page }) => {
    await page.goto("/reservar");
    await expect(page.getByTestId("cookie-banner")).toBeVisible();

    await page.getByTestId("cookie-only-necessary").click();
    await expect(page.getByTestId("cookie-banner")).not.toBeVisible();
    await page.waitForLoadState("networkidle");

    const cacheKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith("turneo:cache:"))
    );
    expect(cacheKeys).toHaveLength(0);

    const cookies = await page.context().cookies();
    const consentCookie = cookies.find((c) => c.name === "turneo_consent");
    expect(consentCookie).toBeTruthy();
    expect(decodeURIComponent(consentCookie!.value)).toContain('"preferences":false');
  });

  test("'aceptar todas' cachea el catálogo y una visita posterior pinta antes de que responda la API", async ({
    page,
  }) => {
    await page.goto("/reservar");
    await page.getByTestId("cookie-accept-all").click();
    await expect(page.getByTestId("cookie-banner")).not.toBeVisible();

    // El fetch que pobló la página recién montó antes de que el visitante
    // aceptara, así que todavía no hay nada cacheado (setCached exige
    // consentimiento vigente en el momento en que resuelve el fetch).
    // Recargar con la cookie ya puesta es lo que efectivamente cachea.
    await page.reload();
    await page.waitForResponse((res) => res.url().includes("/api/public-data"));

    const cacheKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith("turneo:cache:"))
    );
    expect(cacheKeys.length).toBeGreaterThan(0);

    // Ahora sí: demorar la respuesta real de la API y confirmar que el
    // catálogo se pinta desde la caché local ANTES de que la red responda.
    await page.route("**/api/public-data", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });
    await page.reload();
    await expect(page.getByTestId("reservar-service-card").first()).toBeVisible({ timeout: 1500 });
  });

  test("revocar 'preferencias' desde el footer borra la caché local", async ({ page }) => {
    await page.goto("/reservar");
    await page.getByTestId("cookie-accept-all").click();
    await page.reload();
    await page.waitForResponse((res) => res.url().includes("/api/public-data"));

    let cacheKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith("turneo:cache:"))
    );
    expect(cacheKeys.length).toBeGreaterThan(0);
    // La decisión sobrevive al reload: la barra no vuelve a aparecer sola.
    await expect(page.getByTestId("cookie-banner")).not.toBeVisible();

    await page.getByTestId("cookie-preferences-footer").click();
    await expect(page.getByTestId("cookie-banner")).toBeVisible();
    await page.getByTestId("cookie-toggle-preferences").uncheck();
    await page.getByTestId("cookie-save").click();
    await expect(page.getByTestId("cookie-banner")).not.toBeVisible();

    cacheKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith("turneo:cache:"))
    );
    expect(cacheKeys).toHaveLength(0);
  });
});
