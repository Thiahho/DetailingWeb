import { test, expect, type Page } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./global-setup";

test.use({ storageState: ADMIN_STORAGE_STATE });

// Selección múltiple de los listados del panel (BulkActionBar). Se prueba el
// flujo completo sobre Servicios, que es la pantalla de referencia del patrón:
// el resto de los listados reusa el mismo hook y la misma barra.
test.describe("Admin: acciones masivas", () => {
  async function createService(page: Page, title: string, slug: string) {
    // Por el proxy de Next.js (no directo al backend) para que dispare el
    // revalidateTag del cache de servicios, igual que global-setup.
    const res = await page.request.post("/api/services", {
      data: {
        title,
        slug,
        price: "1000",
        duration: "30min",
        imageUrl: "",
        description: "Servicio para el e2e de acciones masivas",
        details: [],
        isActive: true,
        order: 0,
      },
    });
    expect(res.ok()).toBe(true);
  }

  test("un admin selecciona varios servicios, los desactiva y los elimina juntos", async ({ page }) => {
    // storageState no persiste sessionStorage — sin esto, auth.ts trata la
    // página como "ventana nueva con cookie vieja" y fuerza logout al vuelo.
    await page.addInitScript(() => sessionStorage.setItem("Turneo_session_active", "true"));

    const runId = Date.now().toString(36);
    const titles = [`Masivo A ${runId}`, `Masivo B ${runId}`];
    await createService(page, titles[0], `masivo-a-${runId}`);
    await createService(page, titles[1], `masivo-b-${runId}`);

    await page.goto("/admin/servicios");

    const cardFor = (title: string) => page.locator(`[data-testid="service-card"][data-service-title="${title}"]`);
    for (const title of titles) {
      await expect(cardFor(title)).toBeVisible();
      await cardFor(title).getByTestId("service-select").check();
    }
    await expect(page.getByTestId("service-bulk-count")).toContainText("2 de");

    // Están activos: solo se ofrece "Desactivar", no "Activar".
    await expect(page.getByTestId("service-bulk-activate")).toHaveCount(0);
    await page.getByTestId("service-bulk-deactivate").click();
    for (const title of titles) {
      await expect(cardFor(title).getByText("INACTIVO")).toBeVisible();
    }
    // Una acción que salió bien limpia la selección.
    await expect(page.getByTestId("service-bulk-delete")).toHaveCount(0);

    // Persistió en el servidor, no solo en pantalla.
    await page.reload();
    for (const title of titles) {
      await expect(cardFor(title).getByText("INACTIVO")).toBeVisible();
      await cardFor(title).getByTestId("service-select").check();
    }

    // Eliminar pide confirmación; cancelar no borra nada.
    await page.getByTestId("service-bulk-delete").click();
    await page.getByTestId("confirm-dialog-cancel").click();
    await expect(cardFor(titles[0])).toBeVisible();

    await page.getByTestId("service-bulk-delete").click();
    await page.getByTestId("confirm-dialog-confirm").click();
    for (const title of titles) {
      await expect(cardFor(title)).toHaveCount(0);
    }
  });

  test("un admin desactiva y elimina varios productos juntos (listado en tabla)", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("Turneo_session_active", "true"));

    const runId = Date.now().toString(36);
    const names = [`Producto masivo A ${runId}`, `Producto masivo B ${runId}`];
    for (const name of names) {
      const res = await page.request.post("/api/products", { data: { name, price: 1500, isActive: true, order: 0 } });
      expect(res.ok()).toBe(true);
    }

    await page.goto("/admin/productos");
    const rowFor = (name: string) => page.locator(`[data-testid="product-row"][data-product-name="${name}"]`);
    for (const name of names) {
      await expect(rowFor(name)).toBeVisible();
      await rowFor(name).getByTestId("product-select").check();
    }

    await page.getByTestId("product-bulk-deactivate").click();
    for (const name of names) {
      await expect(rowFor(name).getByText("INACTIVO")).toBeVisible();
    }

    // El precio no se pierde al reenviar el producto con otro estado.
    await page.reload();
    for (const name of names) {
      await expect(rowFor(name).getByText("INACTIVO")).toBeVisible();
      await expect(rowFor(name)).toContainText("1.500");
      await rowFor(name).getByTestId("product-select").check();
    }

    await page.getByTestId("product-bulk-delete").click();
    await page.getByTestId("confirm-dialog-confirm").click();
    for (const name of names) {
      await expect(rowFor(name)).toHaveCount(0);
    }
  });

  // Humo, sin modificar datos: en cada listado la barra aparece, "seleccionar
  // todos" marca los registros y ofrece las acciones, y se puede desmarcar.
  // Otros specs crean y borran registros en paralelo, así que no se comparan
  // cantidades exactas; un listado vacío (típico en Privacidad) se saltea.
  const listings = [
    { path: "/admin/insumos", prefix: "insumo", action: "delete" },
    { path: "/admin/profesionales", prefix: "professional", action: "delete" },
    { path: "/admin/galeria", prefix: "gallery", action: "delete" },
    { path: "/admin/contenido", prefix: "content", action: "delete" },
    { path: "/admin/clientes", prefix: "customer", action: "delete" },
    { path: "/admin/resenas", prefix: "review", action: "delete" },
    { path: "/admin/solicitudes-privacidad", prefix: "privacy", action: "confirm" },
  ];

  for (const { path, prefix, action } of listings) {
    test(`la selección múltiple funciona en ${path}`, async ({ page }) => {
      await page.addInitScript(() => sessionStorage.setItem("Turneo_session_active", "true"));
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const selectAll = page.getByTestId(`${prefix}-select-all`);
      test.skip((await selectAll.count()) === 0, "listado vacío: no hay nada para seleccionar");

      await selectAll.check();
      await expect(page.getByTestId(`${prefix}-bulk-count`)).toContainText(/\d+ de \d+/);
      await expect(page.locator(`[data-testid="${prefix}-select"]:checked`).first()).toBeVisible();
      await expect(page.getByTestId(`${prefix}-bulk-${action}`)).toBeVisible();

      await selectAll.uncheck();
      await expect(page.locator(`[data-testid="${prefix}-select"]:checked`)).toHaveCount(0);
      await expect(page.getByTestId(`${prefix}-bulk-${action}`)).toHaveCount(0);
    });
  }

  test("'seleccionar todos' marca y desmarca todo el listado", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("Turneo_session_active", "true"));
    await page.goto("/admin/servicios");

    const checkboxes = page.getByTestId("service-select");
    await expect(checkboxes.first()).toBeVisible();
    const total = await checkboxes.count();

    await page.getByTestId("service-select-all").check();
    await expect(page.getByTestId("service-bulk-count")).toContainText(`${total} de ${total}`);
    await expect(page.locator('[data-testid="service-select"]:checked')).toHaveCount(total);

    await page.getByTestId("service-select-all").uncheck();
    await expect(page.locator('[data-testid="service-select"]:checked')).toHaveCount(0);
    await expect(page.getByTestId("service-bulk-delete")).toHaveCount(0);
  });
});
