import { test, expect, type Locator, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ADMIN_STORAGE_STATE, SEED_FILE } from "./global-setup";
import { WEB_URL } from "./ports.mjs";
import type { SeedResult } from "./seed";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../public/landing");

// Capturas de producto para la landing. Cada test deja uno o más PNG en
// public/landing/ con nombre estable. Los datos salen de la siembra de
// global-setup.ts (salón de muestra "Estudio Aurora").

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const AGENDA = { width: 1440, height: 1180 };

// La sesión del admin se reutiliza (ver global-setup.ts): loguear en cada test
// agotaría el rate limit de /api/auth/login (5 por minuto).
const readSeed = () => JSON.parse(fs.readFileSync(SEED_FILE, "utf-8")) as SeedResult;

async function prepare(page: Page) {
  // Sin esta marca, el frontend trata la pestaña como "ventana nueva" y cierra
  // la sesión heredada del storageState (ver src/lib/auth.ts).
  await page.addInitScript(() => sessionStorage.setItem("Turneo_session_active", "true"));
  // Decisión de cookies ya tomada: el banner no tapa la pantalla (mismo formato que e2e/consent.ts).
  await page.context().addCookies([{
    name: "turneo_consent",
    value: encodeURIComponent(JSON.stringify({ v: 1, ts: Date.now(), preferences: false, analytics: false })),
    url: WEB_URL,
  }]);
}

// Deja la pantalla quieta antes de capturar: sin indicador de Next.js en modo
// dev, sin barras de scroll, sin cursor de texto y sin animaciones a medio camino.
async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.addStyleTag({
    content: `
      nextjs-portal, #__next-build-watcher, [data-nextjs-toast] { display: none !important; }
      ::-webkit-scrollbar { display: none !important; }
      * { caret-color: transparent !important; scrollbar-width: none !important; }
      *, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }
    `,
  });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByText(/^Cargando/)).toHaveCount(0);
  await page.waitForTimeout(400);
}

async function open(page: Page, url: string) {
  await page.goto(url, { timeout: 120_000 });
  await settle(page);
}

const file = (name: string) => path.join(OUT_DIR, `${name}.png`);

/** Captura lo que se ve en el viewport, opcionalmente recortado hasta `height`. */
async function shot(page: Page, name: string, height?: number) {
  const viewport = page.viewportSize()!;
  await page.screenshot({
    path: file(name),
    clip: { x: 0, y: 0, width: viewport.width, height: Math.min(height ?? viewport.height, viewport.height) },
  });
}

/** Captura un elemento con un margen alrededor (el fondo de la página), sin salirse del viewport. */
async function shotAround(page: Page, name: string, target: Locator, margin = 24) {
  const viewport = page.viewportSize()!;
  const box = (await target.boundingBox())!;
  const x = Math.max(0, box.x - margin);
  const y = Math.max(0, box.y - margin);
  await page.screenshot({
    path: file(name),
    clip: {
      x, y,
      width: Math.min(viewport.width - x, box.width + margin * 2),
      height: Math.min(viewport.height - y, box.height + margin * 2),
    },
  });
}

/** Scrollea para dejar `target` a un tercio de la pantalla (sin animación). */
async function centerOn(page: Page, target: Locator) {
  await target.evaluate((el) => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, top - window.innerHeight / 3), behavior: "instant" as ScrollBehavior });
  });
  await page.waitForTimeout(300);
}

test.beforeAll(() => fs.mkdirSync(OUT_DIR, { recursive: true }));

test.describe("panel del salón", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE, viewport: DESKTOP, deviceScaleFactor: 2 });
  test.beforeEach(async ({ page }) => prepare(page));

  test("agenda: semana de una profesional y día de todo el equipo", async ({ page }) => {
    const seed = readSeed();
    // Más alto que el resto: con la grilla en tamaño "L" entra la jornada
    // completa (7 a 22 h) sin scroll interno.
    await page.setViewportSize(AGENDA);
    await open(page, "/admin/calendario");

    await page.getByTestId("calendario-view-week").click();
    const calendar = page.getByTestId("agenda-calendar");
    await expect(calendar).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("agenda-density-spacious").click();
    // Con todo el equipo la semana son 28 columnas y obliga a scrollear de costado:
    // la vista semanal se muestra de a una profesional.
    await page.getByTestId("calendario-agenda-professional-filter").selectOption(String(seed.heroProfessionalId));
    await expect(page.getByTestId("agenda-event-booking").first()).toBeVisible();
    await settle(page);
    await shot(page, "agenda-semana");
    await shotAround(page, "agenda-semana-detalle", calendar, 0);

    await page.getByTestId("calendario-agenda-professional-filter").selectOption("all");
    await page.getByTestId("calendario-view-day").click();
    await expect(page.getByTestId("agenda-event-booking").first()).toBeVisible();
    await settle(page);
    await shot(page, "agenda-dia");
    await shotAround(page, "agenda-dia-detalle", calendar, 0);
  });

  test("turnos: historial de reservas", async ({ page }) => {
    await open(page, "/admin/historial");
    await shot(page, "turnos");
  });

  test("clientes y ficha de cliente", async ({ page }) => {
    const seed = readSeed();
    await open(page, "/admin/clientes");
    await expect(page.getByTestId("customer-list-item").first()).toBeVisible();
    await shot(page, "clientes");

    await page.getByTestId("customer-search").fill(seed.featuredCustomer.name);
    await page.getByTestId("customer-list-item").filter({ hasText: seed.featuredCustomer.name }).first().click();
    await expect(page.getByTestId("customer-history-item").first()).toBeVisible();
    await settle(page);
    await shot(page, "cliente-detalle");
  });

  test("caja del día", async ({ page }) => {
    await open(page, "/admin/caja");
    await expect(page.getByTestId("caja-movement-row").first()).toBeVisible();
    await shot(page, "caja");
  });

  test("estadísticas", async ({ page }) => {
    await open(page, "/admin/estadisticas");
    await expect(page.getByTestId("estadisticas-stat-card").first()).toBeVisible();
    await shot(page, "estadisticas");
  });

  test("insumos con alerta de stock bajo", async ({ page }) => {
    await open(page, "/admin/insumos");
    await expect(page.getByText("POCO STOCK").first()).toBeVisible();
    await shot(page, "insumos");
  });

  test("automatizaciones", async ({ page }) => {
    await open(page, "/admin/automatizaciones");
    await expect(page.getByTestId("automation-rule-card").first()).toBeVisible();
    await shot(page, "automatizaciones");
  });

  test("equipo y permisos", async ({ page }) => {
    await open(page, "/admin/profesionales");
    await expect(page.getByText("Valentina Rossi").first()).toBeVisible();
    await shot(page, "equipo", 720);

    await open(page, "/admin/permisos");
    await page.getByTestId("staff-row").filter({ hasText: "recepcion" }).getByTestId("staff-edit-permissions").click();
    await expect(page.getByTestId("staff-permissions-modal")).toBeVisible();
    await settle(page);
    await shotAround(page, "permisos", page.getByTestId("staff-permissions-modal"), 40);
  });

  test("ruleta de beneficios y reseñas", async ({ page }) => {
    await open(page, "/admin/ruleta");
    await expect(page.getByText("Hidratación de regalo")).toBeVisible();
    await shot(page, "ruleta", 660);

    await page.getByRole("button", { name: "Giros y canje" }).click();
    await settle(page);
    await shot(page, "ruleta-giros");

    await open(page, "/admin/resenas");
    await shot(page, "resenas");
  });
});

test.describe("panel de la profesional", () => {
  test.use({ viewport: DESKTOP, deviceScaleFactor: 2 });

  test("mi agenda", async ({ page }) => {
    const seed = readSeed();
    await prepare(page);
    await page.goto("/profesional/login", { timeout: 120_000 });
    await page.getByTestId("professional-login-email").fill(seed.professional.email);
    await page.getByTestId("professional-login-password").fill(seed.professional.password);
    await Promise.all([
      page.waitForURL("**/profesional/agenda", { timeout: 120_000 }),
      page.getByTestId("professional-login-submit").click(),
    ]);
    await expect(page.getByTestId("agenda-slot-item").first()).toBeVisible({ timeout: 60_000 });
    await settle(page);
    await shot(page, "panel-profesional");

    await open(page, "/profesional/tablero");
    await shot(page, "panel-profesional-tablero", 360);
  });
});

test.describe("sitio público del salón (escritorio)", () => {
  test.use({ viewport: DESKTOP, deviceScaleFactor: 2 });

  test("sitio de reservas", async ({ page }) => {
    await prepare(page);
    await open(page, "/reservar");
    await shot(page, "sitio-reservar");
  });
});

test.describe("sitio público del salón (celular)", () => {
  test.use({ viewport: MOBILE, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  test.beforeEach(async ({ page }) => prepare(page));

  test("sitio de reservas y reserva en curso", async ({ page }) => {
    const seed = readSeed();
    await open(page, "/reservar");
    await shot(page, "sitio-reservar-mobile");

    // Reserva a mitad de camino: servicio elegido, profesional elegida, eligiendo horario.
    // Nunca se envía el formulario (no se crea ninguna reserva ni sale ningún aviso).
    const service = page.getByTestId("booking-service-option").filter({ hasText: seed.bookingServiceTitle }).first();
    await service.scrollIntoViewIfNeeded();
    await service.click();
    await settle(page);
    await centerOn(page, service);
    await shot(page, "reserva-mobile-servicio");

    await page.getByTestId("booking-next").click();
    await page.getByText(seed.bookingProfessionalName).first().click();
    await page.getByTestId("booking-next").click();
    const slot = page.getByTestId("booking-slot-option").nth(1);
    await expect(slot).toBeVisible();
    await slot.click();
    await settle(page);
    await centerOn(page, slot);
    await shot(page, "reserva-mobile");
  });

  test("mis turnos", async ({ page }) => {
    const seed = readSeed();
    await open(page, "/mis-turnos");
    await page.getByTestId("mis-turnos-email-input").fill(seed.misTurnosEmail);
    await page.getByTestId("mis-turnos-submit").click();
    await expect(page.getByTestId("mis-turnos-booking-card").first()).toBeVisible();
    await settle(page);
    await shot(page, "mis-turnos-mobile");
  });

  test("ruleta de beneficios del cliente", async ({ page }) => {
    await open(page, "/beneficios");
    await shot(page, "ruleta-mobile");
  });
});
