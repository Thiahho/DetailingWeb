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
});
