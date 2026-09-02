import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { seedConsent } from "./consent";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const seed = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, ".e2e-seed.json"), "utf-8")
) as {
  misTurnosEmail: string;
  misTurnosCancelSubject: string;
  misTurnosRescheduleSubject: string;
};

// "Mis turnos" hoy es búsqueda anónima por email (sin OTP — ver
// docs/auditoriabelleza_0507.md sección 9, el mecanismo OTP del backend no
// tiene ninguna página que lo dispare). Este test cubre el flujo real que
// usa un cliente hoy: ver, cancelar y reprogramar sus turnos por email.
test.describe("Portal Mis Turnos (búsqueda por email)", () => {
  test("un cliente ve sus turnos, cancela uno y reprograma otro", async ({ page }) => {
    // Preseedear la decisión de cookies para que el banner (ver
    // cookie-consent.spec.ts) no tape las tarjetas de turnos.
    await seedConsent(page);
    await page.goto("/mis-turnos");
    await page.getByTestId("mis-turnos-email-input").fill(seed.misTurnosEmail);
    await page.getByTestId("mis-turnos-submit").click();

    const cancelCard = page
      .locator('[data-testid="mis-turnos-booking-card"]')
      .filter({ hasText: seed.misTurnosCancelSubject });
    const rescheduleCard = page
      .locator('[data-testid="mis-turnos-booking-card"]')
      .filter({ hasText: seed.misTurnosRescheduleSubject });

    await expect(cancelCard).toBeVisible();
    await expect(rescheduleCard).toBeVisible();

    // Cancelar: la página usa confirm() nativo del navegador.
    page.once("dialog", (dialog) => dialog.accept());
    await cancelCard.getByTestId("mis-turnos-cancel-button").click();
    await expect(cancelCard.getByText("Cancelado")).toBeVisible();
    await expect(cancelCard.getByTestId("mis-turnos-cancel-button")).toBeDisabled();

    // Reprogramar
    await rescheduleCard.getByTestId("mis-turnos-reschedule-button").click();
    const slotOptions = page.getByTestId("mis-turnos-reschedule-slot");
    await expect(slotOptions.first()).toBeVisible();
    await slotOptions.first().click();
    await page.getByTestId("mis-turnos-reschedule-confirm").click();

    // El modal se cierra solo si la reprogramación fue exitosa.
    await expect(page.getByTestId("mis-turnos-reschedule-confirm")).not.toBeVisible();
  });
});
