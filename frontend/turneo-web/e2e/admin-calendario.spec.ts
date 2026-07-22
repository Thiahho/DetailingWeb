import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ADMIN_STORAGE_STATE } from "./global-setup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const seed = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, ".e2e-seed.json"), "utf-8")
) as { serviceTitle: string };

// Sesión de admin ya logueada (ver global-setup.ts) — evita quemar el rate
// limit "auth" (5 req/min) logueando de nuevo en cada spec.
test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("Admin: Calendario", () => {
  test("un admin reserva un turno libre desde el calendario y luego lo libera", async ({ page }) => {
    // storageState no persiste sessionStorage — sin esto, auth.ts trata la
    // página como "ventana nueva con cookie vieja" y fuerza logout al vuelo.
    await page.addInitScript(() => sessionStorage.setItem("Turneo_session_active", "true"));
    await page.goto("/admin/calendario");
    // El grid del calendario se pinta recién después de que resuelvan los 3
    // fetch en paralelo (timeslots/services/professionals) — sin esperar
    // esto, .count() no reintenta como expect().toBeVisible() y mide 0
    // siempre, contando la pantalla de "Cargando calendario...".
    await expect(page.getByTestId("calendario-day-cell").first()).toBeVisible();

    // global-setup siembra turnos para los próximos 10 días (BusinessSettings
    // con maxDaysInAdvance: 10) — pero no todos los días tienen slots libres:
    // "hoy" puede estar totalmente fuera del horario comercial (09-17) si la
    // suite corre de noche, y otros specs en paralelo van consumiendo turnos.
    // Se prueba día por día hasta encontrar uno con al menos un turno libre.
    const daysWithAvailable = page.locator('[data-testid="calendario-day-cell"][data-has-available="true"]');
    const dayCount = await daysWithAvailable.count();
    expect(dayCount).toBeGreaterThan(0);

    const freeSlot = page.locator('[data-testid="calendario-slot-row"][data-available="true"]').first();
    let found = false;
    for (let i = 0; i < dayCount; i++) {
      await daysWithAvailable.nth(i).click();
      if (await freeSlot.count() > 0) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
    await expect(freeSlot).toBeVisible();
    await freeSlot.getByTestId("calendario-slot-reserve-button").click();

    const customerName = `Cliente Calendario E2E ${Date.now()}`;
    const modal = page.getByTestId("calendario-reserve-modal");
    await expect(modal).toBeVisible();
    // El modal abre por default en modo "Cliente registrado" — hay que pasar
    // a "Cliente nuevo" para que aparezcan los campos de nombre/teléfono.
    await page.getByTestId("reserve-mode-new").click();
    await page.getByTestId("calendario-reserve-name").fill(customerName);
    await page.getByTestId("calendario-reserve-phone").fill("+5491100000002");
    await page.getByTestId("calendario-reserve-service").selectOption({ label: seed.serviceTitle });
    await page.getByTestId("calendario-reserve-subject").fill("Lavado completo E2E");
    await page.getByTestId("calendario-reserve-submit").click();
    await expect(modal).not.toBeVisible();

    const bookedSlot = page.locator(`[data-testid="calendario-slot-row"][data-customer-name="${customerName}"]`);
    await expect(bookedSlot).toBeVisible();
    await expect(bookedSlot.getByText("RESERVADO")).toBeVisible();

    // Ver detalle
    await bookedSlot.getByTestId("calendario-slot-detail-button").click();
    const detailModal = page.getByTestId("calendario-detail-modal");
    await expect(detailModal).toBeVisible();
    await expect(detailModal.getByText(customerName)).toBeVisible();

    // Liberar el turno (confirm() nativo)
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("calendario-liberar-button").click();
    await expect(detailModal).not.toBeVisible();
    await expect(page.getByText(customerName)).not.toBeVisible();
  });
});
