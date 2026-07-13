import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ADMIN_STORAGE_STATE } from "./global-setup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const seed = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, ".e2e-seed.json"), "utf-8")
) as { historialCustomerName: string };

// Sesión de admin ya logueada (ver global-setup.ts) — evita quemar el rate
// limit "auth" (5 req/min) logueando de nuevo en cada spec.
test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("Admin: Historial de reservas", () => {
  test("un admin busca una reserva, ve el detalle y la confirma", async ({ page }) => {
    // storageState no persiste sessionStorage — sin esto, auth.ts trata la
    // página como "ventana nueva con cookie vieja" y fuerza logout al vuelo.
    await page.addInitScript(() => sessionStorage.setItem("tturnos_session_active", "true"));
    await page.goto("/admin/historial");

    await page.getByTestId("historial-search").fill(seed.historialCustomerName);

    const row = page.locator(`[data-testid="historial-row"][data-customer-name="${seed.historialCustomerName}"]`);
    await expect(row).toBeVisible();
    await expect(row.getByText("Pendiente")).toBeVisible();

    // Ver detalle
    await row.click();
    const modal = page.getByTestId("historial-detail-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByText(seed.historialCustomerName)).toBeVisible();

    // Cerrar clickeando afuera del modal (el backdrop, no tiene tecla Escape)
    await page.mouse.click(5, 5);
    await expect(modal).not.toBeVisible();

    // Confirmar desde la fila
    await row.getByTestId("historial-confirm-button").click();
    await expect(row.getByText("Confirmado")).toBeVisible();
  });
});
