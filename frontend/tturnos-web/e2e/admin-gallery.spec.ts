import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ADMIN_STORAGE_STATE } from "./global-setup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const seed = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, ".e2e-seed.json"), "utf-8")
) as { galleryTitle: string };

// Sesión de admin ya logueada (ver global-setup.ts) — evita quemar el rate
// limit "auth" (5 req/min) logueando de nuevo en cada spec.
test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("Admin: Galería", () => {
  test("un admin edita y borra un item de la galería", async ({ page }) => {
    // storageState no persiste sessionStorage — sin esto, auth.ts trata la
    // página como "ventana nueva con cookie vieja" y fuerza logout al vuelo.
    await page.addInitScript(() => sessionStorage.setItem("tturnos_session_active", "true"));
    await page.goto("/admin/galeria");

    const card = page.locator(`[data-testid="gallery-card"][data-item-title="${seed.galleryTitle}"]`);
    await expect(card).toBeVisible();

    const updatedTitle = `${seed.galleryTitle} editado`;
    await card.getByTestId("gallery-edit-button").click();
    await page.getByTestId("gallery-form-title").fill(updatedTitle);
    await page.getByTestId("gallery-form-submit").click();

    const updatedCard = page.locator(`[data-testid="gallery-card"][data-item-title="${updatedTitle}"]`);
    await expect(updatedCard).toBeVisible();

    await updatedCard.getByTestId("gallery-delete-button").click();
    await updatedCard.getByTestId("gallery-delete-confirm-button").click();
    await expect(
      page.locator(`[data-testid="gallery-card"][data-item-title="${updatedTitle}"]`)
    ).toHaveCount(0);
  });
});
