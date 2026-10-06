import { test, expect } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./global-setup";

test.use({ storageState: ADMIN_STORAGE_STATE });

// El panel no lleva el Navbar del sitio público (SiteChrome lo oculta ahí para
// que no tape la navegación del panel), así que la vuelta al sitio tiene que
// estar explícita en la navegación propia del panel.
test.describe("Panel admin: volver al sitio web", () => {
  test.beforeEach(async ({ page }) => {
    // storageState no persiste sessionStorage — sin esto, auth.ts trata la
    // página como "ventana nueva con cookie vieja" y fuerza logout al vuelo.
    await page.addInitScript(() => sessionStorage.setItem("Turneo_session_active", "true"));
  });

  test("en escritorio, el sidebar tiene 'Ver sitio web' y lleva al sitio", async ({ page }) => {
    await page.goto("/admin/cuenta");

    const link = page.getByTestId("panel-site-link");
    await expect(link).toBeVisible();
    await expect(link).toHaveText("Ver sitio web");
    await Promise.all([page.waitForURL("**/reservar"), link.click()]);
  });

  test("en celular, la barra superior tiene 'Ver sitio' y lleva al sitio", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/cuenta");

    const link = page.getByTestId("panel-site-link-mobile");
    await expect(link).toBeVisible();
    // La barra del sitio público no se dibuja sobre el panel.
    await expect(page.getByRole("link", { name: "Trabajos" })).toHaveCount(0);
    await Promise.all([page.waitForURL("**/reservar"), link.click()]);
  });
});
