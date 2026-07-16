import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ADMIN_STORAGE_STATE } from "./global-setup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const seed = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, ".e2e-seed.json"), "utf-8")
) as { serviceTitle: string; professionalFullName: string };

// Sesión de admin ya logueada (ver global-setup.ts) — evita quemar el rate
// limit "auth" (5 req/min) logueando de nuevo en cada spec.
test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("Admin: Clientes y avisos", () => {
  test("un admin crea un cliente, le programa un aviso, lo cancela y borra el cliente", async ({ page }) => {
    // storageState no persiste sessionStorage — sin esto, auth.ts trata la
    // página como "ventana nueva con cookie vieja" y fuerza logout al vuelo.
    await page.addInitScript(() => sessionStorage.setItem("tturnos_session_active", "true"));
    await page.goto("/admin/clientes");

    const customerName = `Cliente E2E ${Date.now()}`;
    const customerPhone = `549${Date.now()}`.slice(0, 13);

    // Crear cliente
    await page.getByTestId("customer-create-button").click();
    await page.getByTestId("customer-form-name").fill(customerName);
    await page.getByTestId("customer-form-phone").fill(customerPhone);
    await page.getByTestId("customer-form-submit").click();

    const listItem = page.locator(`[data-testid="customer-list-item"][data-customer-name="${customerName}"]`);
    await expect(listItem).toBeVisible();

    // Entrar al detalle
    await listItem.click();
    await expect(page.getByRole("heading", { name: customerName })).toBeVisible();

    // Editar: agregar notas + ficha extendida del CRM (cumpleaños, instagram, profesional favorito)
    await page.getByTestId("customer-edit-button").click();
    await page.getByTestId("customer-form-notes").fill("Nota de e2e");
    await page.getByTestId("customer-form-birthday").fill("1990-05-20");
    await page.getByTestId("customer-form-instagram").fill("@cliente.e2e");
    await page.getByTestId("customer-form-favorite-professional").selectOption({ label: seed.professionalFullName });
    await page.getByTestId("customer-form-submit").click();
    await expect(page.getByText("Nota de e2e")).toBeVisible();

    // Ficha extendida visible en el detalle
    const crmDetails = page.getByTestId("customer-crm-details");
    await expect(crmDetails).toContainText("20 May 1990");
    await expect(crmDetails).toContainText("@cliente.e2e");
    await expect(crmDetails).toContainText(seed.professionalFullName);

    // Programar un aviso (reserva un turno real + crea el ScheduledReminder)
    await page.getByTestId("reminder-create-button").click();
    await page.getByTestId("reminder-form-service").selectOption({ label: seed.serviceTitle });
    // El backend exige Subject no vacío (CreateBookingRequest), pero el campo
    // no tiene asterisco de obligatorio en la UI — completarlo para no
    // depender de ese detalle de UX. .last() (fecha más lejana) a propósito:
    // booking.spec.ts toma el primer turno disponible cronológicamente —
    // evita competir por el mismo slot.
    await page.getByTestId("reminder-form-detail").fill("Detalle de prueba e2e");
    await page.getByTestId("reminder-form-date").last().click();
    await page.getByTestId("reminder-form-slot").last().click();
    await page.getByTestId("reminder-form-submit").click();

    const reminderItem = page
      .locator(`[data-testid="reminder-list-item"][data-reminder-service="${seed.serviceTitle}"]`)
      .first();
    await expect(reminderItem).toBeVisible();
    await expect(reminderItem.getByText("Pendiente")).toBeVisible();

    // El turno reservado junto con el aviso aparece en el historial del cliente
    await expect(page.getByTestId("customer-history-item").first()).toContainText(seed.serviceTitle);

    // Cancelar el aviso (confirm() nativo del navegador)
    page.once("dialog", (dialog) => dialog.accept());
    await reminderItem.getByTestId("reminder-cancel-button").click();
    await expect(reminderItem.getByText("Cancelado")).toBeVisible();

    // Borrar el cliente (confirm() nativo del navegador)
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByTestId("customer-delete-button").click();
    await expect(
      page.locator(`[data-testid="customer-list-item"][data-customer-name="${customerName}"]`)
    ).toHaveCount(0);
  });
});
