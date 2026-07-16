import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ADMIN_STORAGE_STATE } from "./global-setup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const seed = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, ".e2e-seed.json"), "utf-8")
) as { cajaBookingId: number };

// Sesión de admin ya logueada (ver global-setup.ts).
test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("Admin: Caja", () => {
  test("un admin abre caja, cobra un turno, registra una devolución y cierra con diferencia", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("tturnos_session_active", "true"));
    await page.goto("/admin/caja");

    // Solo puede haber una caja abierta por tenant a la vez — si quedó una
    // abierta de una corrida anterior interrumpida, la cerramos primero para
    // empezar el test desde un estado conocido (no es el caso normal, pero
    // hace el test resistente a una corrida previa que no llegó a cerrar).
    if (await page.getByTestId("caja-action-close").isVisible().catch(() => false)) {
      await page.getByTestId("caja-action-close").click();
      await page.getByTestId("caja-close-counted").fill("0");
      await page.getByTestId("caja-close-submit").click();
      await page.getByText("Listo").click();
    }

    // Abrir caja
    await expect(page.getByTestId("caja-open-balance-input")).toBeVisible();
    await page.getByTestId("caja-open-balance-input").fill("1000");
    await page.getByTestId("caja-open-submit").click();
    await expect(page.getByTestId("caja-expected-cash")).toHaveText("$1.000");

    // Cobrar el turno sembrado, en efectivo
    await page.getByTestId("caja-action-charge").click();
    await page.getByTestId("caja-movement-booking-id").fill(String(seed.cajaBookingId));
    await page.getByTestId("caja-movement-amount").fill("5000");
    await page.getByTestId("caja-movement-submit").click();
    await expect(page.getByTestId("caja-expected-cash")).toHaveText("$6.000");
    await expect(page.getByTestId("caja-movement-row").filter({ hasText: "Cobro" })).toBeVisible();

    // Devolución parcial
    await page.getByTestId("caja-action-refund").click();
    await page.getByTestId("caja-movement-amount").fill("1000");
    await page.getByTestId("caja-movement-submit").click();
    await expect(page.getByTestId("caja-expected-cash")).toHaveText("$5.000");
    await expect(page.getByTestId("caja-movement-row").filter({ hasText: "Devolución" })).toBeVisible();

    // Cerrar caja declarando un conteo distinto al esperado
    await page.getByTestId("caja-action-close").click();
    await page.getByTestId("caja-close-counted").fill("4800");
    await page.getByTestId("caja-close-submit").click();
    await expect(page.getByTestId("caja-close-difference")).toHaveText("-$200");
    await page.getByText("Listo").click();

    // La caja quedó cerrada: vuelve a mostrar el formulario de apertura
    await expect(page.getByTestId("caja-open-balance-input")).toBeVisible();
  });
});
