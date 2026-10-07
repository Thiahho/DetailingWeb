import { expect, type Page } from "@playwright/test";

/**
 * Elige un día en el calendario (react-day-picker) del formulario "Turno
 * puntual" de /admin/turnos. El alta ya no usa un <input type="date"> (ese
 * quedó solo para editar): se eligen uno o más días en el DayPicker, que
 * arranca en el mes actual, así que hay que avanzar de mes hasta que el día
 * buscado esté a la vista.
 *
 * `isoDate` es YYYY-MM-DD, el mismo formato que DayPicker pone en `data-day`.
 */
export async function pickSlotFormDate(page: Page, isoDate: string): Promise<void> {
  // Sin los días "outside": el día 1 del mes siguiente también existe, oculto,
  // en la grilla del mes anterior (relleno de la última semana). Contarlo
  // frenaba el avance un mes antes y el día nunca quedaba visible.
  const cell = page.locator(
    `[data-testid="slot-form-daypicker"] [data-day="${isoDate}"]:not([data-outside="true"])`
  );
  const nextMonth = page.getByRole("button", { name: "Go to the Next Month" });

  // Los offsets que usan los specs (+40, +55 días) caen como mucho 2 meses
  // adelante — 6 es margen de sobra, no un caso real.
  for (let i = 0; i < 6 && (await cell.count()) === 0; i++) {
    await nextMonth.click();
  }
  await expect(cell).toBeVisible();

  // El DayPicker es de selección múltiple: un segundo click sobre un día ya
  // elegido lo destilda.
  if ((await cell.getAttribute("data-selected")) !== "true") {
    await cell.getByRole("button").click();
  }
  await expect(cell).toHaveAttribute("data-selected", "true");
}
