import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { seedConsent } from "./consent";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const seed = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, ".e2e-seed.json"), "utf-8")
) as { serviceTitle: string; serviceSlug: string };

test.describe("Flujo público de reserva", () => {
  test("un cliente ve servicios, reserva un turno y lo cancela", async ({ page }) => {
    // Preseedear la decisión de cookies para que el banner (ver
    // cookie-consent.spec.ts) no tape el formulario/footer en este flujo.
    await seedConsent(page);
    await page.goto("/reservar");

    // La reserva es un asistente de cuatro pasos (BookingWizard).
    // 1 · Servicio: el sembrado en global-setup
    await page
      .locator('[data-testid="booking-service-option"]')
      .filter({ hasText: seed.serviceTitle })
      .click();
    await page.getByTestId("booking-next").click();

    // 2 · Profesional: se deja "sin preferencia"
    await page.getByTestId("booking-next").click();

    // 3 · Día y hora: el primer turno disponible
    const slotOptions = page.getByTestId("booking-slot-option");
    await expect(slotOptions.first()).toBeVisible();
    await slotOptions.first().click();
    await page.getByTestId("booking-next").click();

    // 4 · Datos del cliente
    await page.getByTestId("booking-name-input").fill("Cliente E2E");
    await page.getByTestId("booking-whatsapp-input").fill("+5491100000000");
    const email = `e2e-${Date.now()}@example.com`;
    await page.getByTestId("booking-email-input").fill(email);

    // Aceptar Términos y Condiciones (checkbox obligatorio, deshabilita el submit si no está tildado)
    await page.getByTestId("booking-accept-terms").check();

    // Enviar y capturar el bookingId de la respuesta real de la API
    const [bookingResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/api/bookings") && res.request().method() === "POST"
      ),
      page.getByTestId("booking-submit").click(),
    ]);
    expect(bookingResponse.ok()).toBeTruthy();
    const bookingData = await bookingResponse.json();
    const bookingId = bookingData.booking?.id;
    expect(bookingId).toBeTruthy();

    // Confirmación visible en pantalla
    await expect(page.getByTestId("booking-confirmed")).toBeVisible();

    // Cancelar el turno recién creado
    await page.goto(`/cancelar?bookingId=${bookingId}`);
    await page.getByTestId("cancel-confirm-button").click();
    await expect(page.getByTestId("cancel-success")).toBeVisible();
  });
});
