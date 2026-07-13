import { test, expect } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./global-setup";

// Sesión de admin ya logueada (ver global-setup.ts) — evita quemar el rate
// limit "auth" (5 req/min) logueando de nuevo en cada spec.
test.use({ storageState: ADMIN_STORAGE_STATE });

// No se prueba el cambio de contraseña exitoso: mutaría las credenciales del
// admin compartido (seed.adminEmail/adminPassword), y admin-services.spec.ts
// loguea con esas mismas credenciales por UI en paralelo (3 workers) — una
// carrera real, no hipotética, dado que ya se pisó el cache un par de veces
// esta sesión por este mismo tipo de estado compartido. El camino de error
// (contraseña actual incorrecta) no muta nada y sigue probando el formulario
// y el endpoint real.
test.describe("Admin: Cuenta", () => {
  test("cambiar contraseña con la actual incorrecta muestra el error real del backend", async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("tturnos_session_active", "true"));
    await page.goto("/admin/cuenta");

    await page.getByTestId("cuenta-current-password").fill("contraseña-incorrecta-a-proposito");
    await page.getByTestId("cuenta-new-password").fill("NuevaPassword123");
    await page.getByTestId("cuenta-confirm-password").fill("NuevaPassword123");
    await page.getByTestId("cuenta-submit").click();

    await expect(page.getByTestId("cuenta-message")).toContainText("incorrecta");
  });
});
