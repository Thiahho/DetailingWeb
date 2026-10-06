import { test, expect } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./global-setup";

// Sesión de admin ya logueada (ver global-setup.ts) — evita quemar el rate
// limit "auth" (5 req/min) logueando de nuevo en cada spec.
test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("Admin: Configuración del negocio", () => {
  test("un admin actualiza el nombre del negocio y persiste", async ({ page }) => {
    // storageState no persiste sessionStorage — sin esto, auth.ts trata la
    // página como "ventana nueva con cookie vieja" y fuerza logout al vuelo.
    await page.addInitScript(() => sessionStorage.setItem("Turneo_session_active", "true"));
    await page.goto("/admin/configuracion");

    const businessName = `Studio E2E ${Date.now()}`;
    await page.getByTestId("config-business-name").fill(businessName);
    await page.getByTestId("config-submit").click();

    // Timeout ampliado: con toda la suite corriendo en paralelo contra el
    // mismo backend compartido, el PUT puede tardar más que el default de 5s.
    await expect(page.getByTestId("config-message")).toContainText("Configuración guardada", { timeout: 15_000 });

    // Recargar y confirmar que el valor persistió del lado del backend, no solo en el estado local.
    await page.reload();
    await expect(page.getByTestId("config-business-name")).toHaveValue(businessName);
  });

  test("las fotos del local se ven en Configuración y en Sobre nosotros", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("Turneo_session_active", "true"));

    // La subida real a Cloudinary no se prueba: se siembra la URL por el mismo
    // proxy que usa el formulario, conservando el resto de la config actual.
    const photoUrl = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
    const current = await (await page.request.get("/api/siteconfig")).json();
    const res = await page.request.put("/api/siteconfig", {
      data: { ...current, mapEmbedUrl: current.mapEmbedUrl ?? null, localPhotos: [photoUrl] },
    });
    expect(res.ok()).toBeTruthy();

    await page.goto("/admin/configuracion");
    await expect(page.getByTestId("config-local-photo")).toHaveCount(1, { timeout: 15_000 });

    await page.goto("/reservar");
    await expect(page.getByTestId("local-photos").locator("img")).toHaveAttribute("src", /sample\.jpg$/, {
      timeout: 15_000,
    });
  });

  test("un admin agrega una red y se ve en el contacto del sitio público", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("Turneo_session_active", "true"));

    const runId = Date.now();
    const linkName = `Red E2E ${runId}`;
    const linkUrl = `https://example.com/${runId}`;
    // Posición de la fila de esta corrida (-1 si no está): el tenant de e2e es
    // compartido y puede tener otras redes cargadas.
    const ownRowIndex = () =>
      page
        .getByTestId("social-link-url")
        .evaluateAll((inputs, url) => inputs.findIndex((input) => (input as HTMLInputElement).value === url), linkUrl);

    try {
      await page.goto("/admin/configuracion");
      await page.getByTestId("social-link-add").click();
      const newRow = page.getByTestId("social-link-row").last();
      await newRow.getByTestId("social-link-name").fill(linkName);
      await newRow.getByTestId("social-link-url").fill(linkUrl);
      await page.getByTestId("config-submit").click();
      await expect(page.getByTestId("config-message")).toContainText("Configuración guardada", { timeout: 15_000 });

      // Recargar y confirmar que persistió del lado del backend, no solo en el estado local.
      await page.reload();
      await expect.poll(ownRowIndex, { timeout: 15_000 }).toBeGreaterThanOrEqual(0);
      const savedRow = page.getByTestId("social-link-row").nth(await ownRowIndex());
      await expect(savedRow.getByTestId("social-link-name")).toHaveValue(linkName);

      await page.goto("/reservar");
      const publicLink = page.getByRole("link", { name: linkName });
      await expect(publicLink).toHaveAttribute("href", linkUrl, { timeout: 15_000 });
      await expect(publicLink).toHaveAttribute("target", "_blank");
      await expect(publicLink).toHaveAttribute("rel", "noopener noreferrer");

      // Quitarla desde el formulario y guardar.
      await page.goto("/admin/configuracion");
      await expect.poll(ownRowIndex, { timeout: 15_000 }).toBeGreaterThanOrEqual(0);
      await page.getByTestId("social-link-row").nth(await ownRowIndex()).getByTestId("social-link-remove").click();
      await page.getByTestId("config-submit").click();
      await expect(page.getByTestId("config-message")).toContainText("Configuración guardada", { timeout: 15_000 });
      await page.reload();
      await expect(page.getByTestId("config-business-name")).toBeVisible({ timeout: 15_000 });
      expect(await ownRowIndex()).toBe(-1);
    } finally {
      // Red de seguridad si algo falló antes de quitarla por la UI: se limpia por
      // el mismo proxy que usa el formulario, conservando el resto de la config,
      // para no dejar basura en el tenant compartido de e2e.
      const current = await (await page.request.get("/api/siteconfig")).json();
      const links: { url?: string }[] = Array.isArray(current.socialLinks) ? current.socialLinks : [];
      if (links.some((link) => link.url === linkUrl)) {
        await page.request.put("/api/siteconfig", {
          data: {
            ...current,
            mapEmbedUrl: current.mapEmbedUrl ?? null,
            socialLinks: links.filter((link) => link.url !== linkUrl),
          },
        });
      }
    }
  });
});
