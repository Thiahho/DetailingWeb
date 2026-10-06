import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "../../backend/Turneo.Api");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Todos los specs comparten un único backend .NET en modo dev (Kestrel +
  // un solo pool de conexiones a Postgres) — con 6 workers en paralelo el
  // backend se vuelve lento bajo carga real y aparecen flakes de timing
  // (elementos que tardan en aparecer porque el fetch todavía no volvió).
  // 3 workers da un buen balance entre velocidad y estabilidad.
  workers: 3,
  timeout: 45_000,
  // Default de expect() es 5s — muy ajustado cuando el backend compartido
  // está respondiendo más lento por la carga de otros workers en paralelo.
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: "html",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  // reuseExistingServer siempre en false a propósito: si el usuario ya tiene
  // el backend/frontend real corriendo en estos puertos, NO queremos que
  // Playwright se "cuelgue" de esa instancia (base real + WhatsApp/Gmail
  // reales) — mejor que falle por puerto ocupado a que corra contra dev real.
  webServer: [
    {
      command: "dotnet run --no-launch-profile --urls http://localhost:5048",
      cwd: backendDir,
      url: "http://localhost:5048/api/services",
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ASPNETCORE_ENVIRONMENT: "Testing",
        // Toda la suite le pega al backend desde la misma IP (el proxy de
        // Next.js local): con el límite real de "public-read" (60/min) los
        // GET públicos empiezan a devolver 429 a mitad de la corrida.
        RateLimiting__PublicReadPermitLimit: "2000",
      },
    },
    {
      command: "npm run dev",
      cwd: __dirname,
      url: "http://localhost:3000",
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
