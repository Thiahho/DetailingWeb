import { test, expect } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./global-setup";

// Sesión de admin ya logueada (ver global-setup.ts) — evita quemar el rate
// limit "auth" (5 req/min) logueando de nuevo en cada spec.
test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("Admin: CRUD de Profesionales", () => {
  test("un admin crea, edita y borra un profesional", async ({ page }) => {
    // storageState no persiste sessionStorage — sin esto, auth.ts trata la
    // página como "ventana nueva con cookie vieja" y fuerza logout al vuelo.
    await page.addInitScript(() => sessionStorage.setItem("tturnos_session_active", "true"));
    await page.goto("/admin/profesionales");

    const firstName = "Ana";
    const lastName = `E2E${Date.now()}`;
    const fullName = `${firstName} ${lastName}`;

    await page.getByTestId("professional-create-button").click();
    await page.getByTestId("professional-form-firstname").fill(firstName);
    await page.getByTestId("professional-form-lastname").fill(lastName);
    await page.getByTestId("professional-form-submit").click();

    const card = page.locator('[data-testid="professional-card"]').filter({ hasText: fullName });
    await expect(card).toBeVisible();

    // Editar: cambiar apellido
    const updatedLastName = `${lastName}-Editado`;
    await card.getByTestId("professional-edit-button").click();
    await page.getByTestId("professional-form-lastname").fill(updatedLastName);
    await page.getByTestId("professional-form-submit").click();

    const updatedCard = page
      .locator('[data-testid="professional-card"]')
      .filter({ hasText: `${firstName} ${updatedLastName}` });
    await expect(updatedCard).toBeVisible();

    // Borrar
    await updatedCard.getByTestId("professional-delete-button").click();
    await updatedCard.getByTestId("professional-delete-confirm-button").click();
    await expect(
      page.locator('[data-testid="professional-card"]').filter({ hasText: `${firstName} ${updatedLastName}` })
    ).toHaveCount(0);
  });
});
