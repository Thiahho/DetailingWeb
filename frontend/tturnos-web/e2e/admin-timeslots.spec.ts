import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ADMIN_STORAGE_STATE } from "./global-setup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const seed = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, ".e2e-seed.json"), "utf-8")
) as { professionalFullName: string };

// Sesión de admin ya logueada (ver global-setup.ts) — evita quemar el rate
// limit "auth" (5 req/min) logueando de nuevo en cada spec.
test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("Admin: gestión de Turnos", () => {
  test("un admin crea un turno para un profesional y lo elimina", async ({ page }) => {
    // storageState no persiste sessionStorage — sin esto, auth.ts trata la
    // página como "ventana nueva con cookie vieja" y fuerza logout al vuelo.
    await page.addInitScript(() => sessionStorage.setItem("tturnos_session_active", "true"));
    await page.goto("/admin/turnos");

    // Fecha lejos de la que usan otros specs (booking/professional-agenda), para no pisarse.
    const future = new Date();
    future.setDate(future.getDate() + 40);
    const dateValue = future.toISOString().slice(0, 10);

    await page.getByTestId("slot-form-date").fill(dateValue);
    await page.getByTestId("slot-form-hour").fill("11");
    await page.getByTestId("slot-form-minute").fill("00");
    await page.getByTestId("slot-form-professional").selectOption({ label: seed.professionalFullName });
    await page.getByTestId("slot-form-submit").click();

    // La lista pagina de a 6 y acumula turnos de corridas anteriores — filtrar
    // por profesional para no depender de en qué página cae el turno nuevo.
    await page
      .getByTestId("slot-list-professional-filter")
      .selectOption({ label: seed.professionalFullName });

    const slot = page
      .locator(`[data-testid="slot-item"][data-slot-professional="${seed.professionalFullName}"]`)
      .first();
    await expect(slot).toBeVisible();
    await expect(slot.getByText("HABILITADO")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await slot.getByTestId("slot-delete-button").click();
    await expect(page.getByText("Turno Eliminado")).toBeVisible();
  });
});
