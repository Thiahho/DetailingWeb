import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { apiEnv, webEnv } from "./landing-capture/env.mjs";
import { API_URL, WEB_PORT, WEB_URL } from "./landing-capture/ports.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "../../backend/Turneo.Api");

// Config aparte del e2e (playwright.config.ts): no prueba nada, genera las
// capturas de producto de la landing en public/landing/. Levanta su propia API
// y su propio frontend, en puertos propios y contra una base demo aislada
// (bd_turnos_landing_demo, ver landing-capture/db.mjs). Se corre con
// `npm run landing:capture`, que antes reinicia esa base.
//
// LANDING_REUSE_SERVERS=1 reutiliza servidores ya levantados en esos puertos
// (solo para iterar sobre las capturas sin esperar el arranque cada vez).
const reuseServers = process.env.LANDING_REUSE_SERVERS === "1";

export default defineConfig({
  testDir: "./landing-capture",
  testMatch: "capture.spec.ts",
  outputDir: "./landing-capture/.output",
  fullyParallel: false,
  workers: 1,
  // La siembra corre en globalSetup (sin timeout propio); cada captura compila
  // su ruta en frío en modo dev, de ahí el margen amplio.
  timeout: 180_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: "list",
  globalSetup: "./landing-capture/global-setup.ts",
  use: {
    baseURL: WEB_URL,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    colorScheme: "light",
    trace: "off",
  },
  webServer: [
    {
      command: `dotnet run --no-launch-profile --urls ${API_URL}`,
      cwd: backendDir,
      url: `${API_URL}/api/services`,
      timeout: 180_000,
      reuseExistingServer: reuseServers,
      env: apiEnv(),
    },
    {
      command: `npx next dev --turbo -p ${WEB_PORT}`,
      cwd: __dirname,
      url: WEB_URL,
      timeout: 180_000,
      reuseExistingServer: reuseServers,
      env: webEnv(),
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

