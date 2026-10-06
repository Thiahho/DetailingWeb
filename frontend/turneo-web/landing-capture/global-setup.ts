import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "@playwright/test";
import { ADMIN_EMAIL, DEMO_PASSWORD } from "./data";
import { API_URL, WEB_URL } from "./ports.mjs";
import { seedDemo } from "./seed";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ADMIN_STORAGE_STATE = path.resolve(__dirname, ".auth-admin.json");
export const SEED_FILE = path.resolve(__dirname, ".seed.json");

// Corre una vez antes de las capturas, con la API y el frontend ya arriba
// (ver playwright.landing.config.ts) y la base demo recién creada por
// reset-db.mjs + Database.Migrate(). Registra al admin del salón de muestra,
// guarda su sesión para capture.spec.ts y siembra los datos.
//
// LANDING_SKIP_SEED=1 saltea todo esto y reutiliza la sesión y los datos de la
// corrida anterior (solo para iterar sobre las capturas con servidores vivos).

async function waitForUrl(url: string, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // todavía no está arriba
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${url} no respondió tras ${timeoutMs}ms`);
}

export default async function globalSetup() {
  if (process.env.LANDING_SKIP_SEED === "1" && fs.existsSync(SEED_FILE) && fs.existsSync(ADMIN_STORAGE_STATE)) return;

  await waitForUrl(`${API_URL}/api/services`);
  // Precompila /admin/login: en modo dev la primera compilación puede superar
  // el timeout de navegación (mismo motivo que en e2e/global-setup.ts).
  await waitForUrl(`${WEB_URL}/admin/login`);

  // El registro anónimo solo existe en Testing (Auth:AllowOpenRegistration) y
  // crea el primer admin del tenant por defecto de la base demo.
  const registerRes = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: DEMO_PASSWORD, confirmPassword: DEMO_PASSWORD }),
  });
  if (!registerRes.ok) {
    throw new Error(
      `No se pudo registrar el admin demo: ${registerRes.status} ${await registerRes.text()}. ` +
        "¿La base demo ya tenía datos? Corré `npm run landing:capture`, que la reinicia."
    );
  }
  const { token } = (await registerRes.json()) as { token: string };

  // Login real por UI, una sola vez: deja la cookie de sesión en el dominio del
  // frontend para las capturas y para sembrar a través del proxy.
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${WEB_URL}/admin/login`, { timeout: 120_000 });
    await page.getByTestId("admin-login-email").fill(ADMIN_EMAIL);
    await page.getByTestId("admin-login-password").fill(DEMO_PASSWORD);
    await Promise.all([
      page.waitForURL("**/admin/turnos", { timeout: 120_000 }),
      page.getByTestId("admin-login-submit").click(),
    ]);
    await context.storageState({ path: ADMIN_STORAGE_STATE });

    const seed = await seedDemo(token, context.request);
    fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2));
  } finally {
    await browser.close();
  }
}
