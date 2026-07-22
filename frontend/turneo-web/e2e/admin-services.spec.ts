import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const seed = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, ".e2e-seed.json"), "utf-8")
) as { adminEmail: string; adminPassword: string };

test.describe("Admin: login y CRUD de Servicios", () => {
  test("un admin loguea y crea, edita y borra un servicio", async ({ page }) => {
    // Login
    await page.goto("/admin/login");
    await page.getByTestId("admin-login-email").fill(seed.adminEmail);
    await page.getByTestId("admin-login-password").fill(seed.adminPassword);
    await Promise.all([
      page.waitForURL("**/admin/turnos"),
      page.getByTestId("admin-login-submit").click(),
    ]);

    // Ir a Servicios
    await page.goto("/admin/servicios");

    // Crear
    const title = `Servicio Admin E2E ${Date.now()}`;
    const slug = `servicio-admin-e2e-${Date.now()}`;
    await page.getByTestId("service-create-button").click();
    await page.getByTestId("service-form-title").fill(title);
    // El slug se autogenera del título; lo pisamos para que sea único.
    await page.getByTestId("service-form-slug").fill(slug);
    await page.getByTestId("service-form-price").fill("20000");
    await page.getByTestId("service-form-submit").click();

    const card = page.locator('[data-testid="service-card"]').filter({ hasText: title });
    await expect(card).toBeVisible();
    await expect(card.getByText("20000", { exact: false })).toBeVisible();

    // Editar
    await card.getByTestId("service-edit-button").click();
    await page.getByTestId("service-form-price").fill("30000");
    await page.getByTestId("service-form-submit").click();
    await expect(card.getByText("30000", { exact: false })).toBeVisible();

    // Borrar
    await card.getByTestId("service-delete-button").click();
    await card.getByTestId("service-delete-confirm-button").click();
    await expect(page.locator('[data-testid="service-card"]').filter({ hasText: title })).toHaveCount(0);
  });

  test("categoría, buffer y color se guardan y se reflejan en la card", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByTestId("admin-login-email").fill(seed.adminEmail);
    await page.getByTestId("admin-login-password").fill(seed.adminPassword);
    await Promise.all([
      page.waitForURL("**/admin/turnos"),
      page.getByTestId("admin-login-submit").click(),
    ]);

    await page.goto("/admin/servicios");

    const title = `Servicio Categoria E2E ${Date.now()}`;
    const slug = `servicio-categoria-e2e-${Date.now()}`;
    await page.getByTestId("service-create-button").click();
    await page.getByTestId("service-form-title").fill(title);
    await page.getByTestId("service-form-slug").fill(slug);
    await page.getByTestId("service-form-price").fill("15000");
    await page.getByTestId("service-form-category").fill("Peluquería");
    await page.getByTestId("service-form-buffer").fill("15");
    await page.getByTestId("service-form-color").fill("#00ff00");
    await page.getByTestId("service-form-submit").click();

    const card = page.locator('[data-testid="service-card"]').filter({ hasText: title });
    await expect(card).toBeVisible();
    await expect(card.getByText("Peluquería")).toBeVisible();

    // Reabrir edición y confirmar que persistieron
    await card.getByTestId("service-edit-button").click();
    await expect(page.getByTestId("service-form-category")).toHaveValue("Peluquería");
    await expect(page.getByTestId("service-form-buffer")).toHaveValue("15");
    await expect(page.getByTestId("service-form-color")).toHaveValue("#00ff00");
    await page.getByTestId("service-form-submit").click();

    // Limpieza
    await card.getByTestId("service-delete-button").click();
    await card.getByTestId("service-delete-confirm-button").click();
    await expect(page.locator('[data-testid="service-card"]').filter({ hasText: title })).toHaveCount(0);
  });
});
