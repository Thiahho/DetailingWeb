import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const seed = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, ".e2e-seed.json"), "utf-8")
) as { professionalEmail: string; professionalPassword: string };

test.describe("Profesional: login y agenda propia", () => {
  test("un profesional loguea, crea un turno en su agenda y lo elimina", async ({ page }) => {
    await page.goto("/profesional/login");
    await page.getByTestId("professional-login-email").fill(seed.professionalEmail);
    await page.getByTestId("professional-login-password").fill(seed.professionalPassword);
    await Promise.all([
      page.waitForURL("**/profesional/agenda"),
      page.getByTestId("professional-login-submit").click(),
    ]);

    // El panel del profesional también tiene que ofrecer la vuelta al sitio público.
    await expect(page.getByTestId("panel-site-link")).toHaveAttribute("href", "/reservar");

    // Fecha lejos de los turnos que siembran otros specs, para no pisarse.
    const future = new Date();
    future.setDate(future.getDate() + 25);
    const dateValue = future.toISOString().slice(0, 10);

    await page.getByTestId("agenda-form-date").fill(dateValue);
    await page.getByTestId("agenda-form-hour").fill("10");
    await page.getByTestId("agenda-form-minute").fill("00");
    await page.getByTestId("agenda-form-submit").click();

    const slot = page.locator('[data-testid="agenda-slot-item"]').filter({ hasText: "LIBRE" }).first();
    await expect(slot).toBeVisible();

    await slot.getByTestId("agenda-slot-delete").click();
    await page.getByTestId("confirm-dialog-confirm").click();
    await expect(page.getByText("Turno eliminado")).toBeVisible();
  });
});
