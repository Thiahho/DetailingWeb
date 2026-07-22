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

// Lunes de la semana (ISO, lun=0) que contiene `date` — mismo criterio de
// inicio de semana que el localizer de date-fns/es usado en AgendaCalendar.
function mondayOf(date: Date): Date {
  const d = new Date(date);
  const dayIndex = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayIndex);
  d.setHours(0, 0, 0, 0);
  return d;
}

test.describe("Admin: Agenda semanal (multi-profesional)", () => {
  test("un admin crea dos turnos para un profesional, reserva uno desde la agenda semanal y lo reprograma arrastrándolo", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("Turneo_session_active", "true"));

    // Día lejos del resto de la suite (admin-timeslots usa +40, professional-agenda
    // y booking usan offsets chicos) para no compartir turnos con otros specs.
    const future = new Date();
    future.setDate(future.getDate() + 55);
    const dateValue = future.toISOString().slice(0, 10);

    // --- Crear dos turnos disponibles para el mismo profesional, bien separados
    // (2hs de duración fija por turno) para que no se solapen. ---
    await page.goto("/admin/turnos");

    const createSlot = async (hour: string) => {
      await page.getByTestId("slot-form-date").fill(dateValue);
      await page.getByTestId("slot-form-hour").fill(hour);
      await page.getByTestId("slot-form-minute").fill("00");
      await page.getByTestId("slot-form-professional").getByLabel(seed.professionalFullName).check();
      const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/timeslots") && r.request().method() === "POST"),
        page.getByTestId("slot-form-submit").click(),
      ]);
      const data = await resp.json();
      expect(data.success).toBe(true);
      return data.slot.id as number;
    };

    const slotAId = await createSlot("09");
    const slotBId = await createSlot("14");

    // Limpieza al final (aunque falle el test): sin esto, una corrida repetida
    // sobre el mismo offset de +55 días choca con "Ya existe un turno en este
    // horario para ese profesional" (SlotExistsAsync), porque la base de e2e
    // no se resetea sola entre corridas (deliberado, ver mantenimiento en memoria).
    try {
      // --- Ir a la agenda semanal y navegar hasta la semana del turno ---
      await page.goto("/admin/calendario");
      await page.getByTestId("calendario-view-week").click();
      await expect(page.getByTestId("agenda-calendar")).toBeVisible();

      // Filtrar por el propio profesional: la base de e2e acumula decenas de
      // profesionales entre corridas (no se resetea sola, ver mantenimiento en
      // memoria) y "Todos los profesionales" renderiza una fila por cada uno,
      // lo cual vuelve la vista lenta bajo carga paralela y hace flakear la
      // búsqueda del evento — el test solo necesita ver los turnos propios.
      await page.getByTestId("calendario-agenda-professional-filter").selectOption({ label: seed.professionalFullName });

      const weeksAhead = Math.round(
        (mondayOf(future).getTime() - mondayOf(new Date()).getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      const nextButton = page.getByTestId("agenda-toolbar-next");
      for (let i = 0; i < weeksAhead; i++) {
        await nextButton.click();
      }

      // --- Reservar el turno de las 09:00 desde la agenda ---
      const availableA = page.locator(`[data-testid="agenda-event-available"][data-slot-id="${slotAId}"]`);
      await expect(availableA).toBeVisible();
      await availableA.click();

      await expect(page.getByTestId("calendario-reserve-modal")).toBeVisible();
      // El modal abre en modo "Cliente registrado" por default — pasar a
      // "Cliente nuevo" para que aparezcan nombre/teléfono.
      await page.getByTestId("reserve-mode-new").click();
      await page.getByTestId("calendario-reserve-name").fill("Cliente Agenda E2E");
      await page.getByTestId("calendario-reserve-phone").fill("1123456789");
      await page.getByTestId("calendario-reserve-service").selectOption({ index: 1 });
      await page.getByTestId("calendario-reserve-subject").fill("Turno de agenda E2E");
      await page.getByTestId("calendario-reserve-submit").click();
      await expect(page.getByTestId("calendario-reserve-modal")).toBeHidden();

      const bookingA = page.locator(`[data-testid="agenda-event-booking"][data-slot-id="${slotAId}"]`);
      await expect(bookingA).toBeVisible();

      // --- Arrastrar el turno reservado (09:00) al turno libre (14:00) ---
      const availableB = page.locator(`[data-testid="agenda-event-available"][data-slot-id="${slotBId}"]`);
      await expect(availableB).toBeVisible();

      const sourceBox = await bookingA.boundingBox();
      const targetBox = await availableB.boundingBox();
      if (!sourceBox || !targetBox) throw new Error("No se pudo ubicar el turno de origen o destino en pantalla");

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 15 });
      const [rescheduleResp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/admin-reschedule")),
        page.mouse.up(),
      ]);
      expect(rescheduleResp.ok()).toBe(true);

      // El turno reservado ahora debe aparecer en el horario de destino (14:00),
      // y el de origen (09:00) debe quedar libre otra vez.
      await expect(page.locator(`[data-testid="agenda-event-booking"][data-slot-id="${slotBId}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="agenda-event-available"][data-slot-id="${slotAId}"]`)).toBeVisible();
    } finally {
      // El turno reprogramado terminó en slotB (reservado) y slotA quedó libre
      // (o, si el test falló antes de reprogramar, slotA sigue reservado) —
      // liberar ambos por las dudas antes de borrarlos.
      await page.request.put(`/api/timeslots/${slotAId}/release`).catch(() => {});
      await page.request.put(`/api/timeslots/${slotBId}/release`).catch(() => {});
      await page.request.delete(`/api/timeslots/${slotAId}`).catch(() => {});
      await page.request.delete(`/api/timeslots/${slotBId}`).catch(() => {});
    }
  });
});
