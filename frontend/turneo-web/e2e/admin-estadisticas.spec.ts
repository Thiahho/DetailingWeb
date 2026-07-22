import { test, expect } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./global-setup";

// Sesión de admin ya logueada (ver global-setup.ts) — evita quemar el rate
// limit "auth" (5 req/min) logueando de nuevo en cada spec.
test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("Admin: Estadísticas", () => {
  test("el dashboard carga los KPIs y las secciones sin errores", async ({ page }) => {
    // storageState no persiste sessionStorage — sin esto, auth.ts trata la
    // página como "ventana nueva con cookie vieja" y fuerza logout al vuelo.
    await page.addInitScript(() => sessionStorage.setItem("Turneo_session_active", "true"));
    await page.goto("/admin/estadisticas");

    await expect(page.getByTestId("estadisticas-page")).toBeVisible();
    await expect(page.getByText("Cargando estadísticas...")).not.toBeVisible();
    await expect(page.getByText("Error al cargar estadísticas")).not.toBeVisible();

    // KPIs principales: la suite corre con datos reales sembrados/mutados en
    // paralelo por otros specs, así que no se asume un valor puntual — solo
    // que las tarjetas están, con un valor numérico no vacío.
    const bookingsCard = page.locator('[data-testid="estadisticas-stat-card"][data-label="Reservas este mes"]');
    await expect(bookingsCard).toBeVisible();
    await expect(bookingsCard.getByTestId("estadisticas-stat-value")).not.toHaveText("");

    const totalCard = page.locator('[data-testid="estadisticas-stat-card"][data-label="Total histórico"]');
    const totalValue = await totalCard.getByTestId("estadisticas-stat-value").textContent();
    expect(Number(totalValue)).toBeGreaterThan(0);

    const occupancyCard = page.locator('[data-testid="estadisticas-stat-card"][data-label="Tasa de ocupación"]');
    await expect(occupancyCard.getByTestId("estadisticas-stat-value")).toContainText("%");

    await expect(page.getByText("Reservas por mes")).toBeVisible();
    await expect(page.getByText("Servicios más solicitados")).toBeVisible();
    await expect(page.getByText("Próximas reservas (7 días)")).toBeVisible();
  });
});
