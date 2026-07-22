import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ADMIN_STORAGE_STATE } from "./global-setup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const seed = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, ".e2e-seed.json"), "utf-8")
) as { videoTitle: string };

// Sesión de admin ya logueada (ver global-setup.ts) — evita quemar el rate
// limit "auth" (5 req/min) logueando de nuevo en cada spec.
test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("Admin: Contenido (videos)", () => {
  test("un admin edita y borra un video de contenido", async ({ page }) => {
    // storageState no persiste sessionStorage — sin esto, auth.ts trata la
    // página como "ventana nueva con cookie vieja" y fuerza logout al vuelo.
    await page.addInitScript(() => sessionStorage.setItem("Turneo_session_active", "true"));
    await page.goto("/admin/contenido");

    const card = page.locator(`[data-testid="video-card"][data-video-title="${seed.videoTitle}"]`);
    await expect(card).toBeVisible();

    const updatedTitle = `${seed.videoTitle} editado`;
    await card.getByTestId("video-edit-button").click();
    await page.getByTestId("video-form-title").fill(updatedTitle);
    await page.getByTestId("video-form-submit").click();

    const updatedCard = page.locator(`[data-testid="video-card"][data-video-title="${updatedTitle}"]`);
    await expect(updatedCard).toBeVisible();

    // Sin diálogo de confirmación nativo acá (a diferencia de otros CRUD admin).
    await updatedCard.getByTestId("video-delete-button").click();
    await expect(
      page.locator(`[data-testid="video-card"][data-video-title="${updatedTitle}"]`)
    ).toHaveCount(0);
  });
});
