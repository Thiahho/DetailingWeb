import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium, type APIRequestContext } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Corre una sola vez antes de toda la suite de e2e. El backend arranca en
// ASPNETCORE_ENVIRONMENT=Testing (ver playwright.config.ts) contra una base
// aislada (bd_turnos_e2e) con NoopNotificationProvider — nunca contra la
// base real ni con WhatsApp/Gmail reales.
//
// Siembra vía la API real de administración. Las entidades cuyo GET público
// pasa por una ruta proxy de Next.js con cache (services, professionals,
// gallery, content-videos — ver docs/auditoriabelleza_0507.md sección 9,
// "Cache de Next.js sin invalidar") se crean a través del proxy
// (FRONTEND_URL) y no del backend directo: pegarle al backend salteando el
// proxy nunca dispara el revalidateTag() que invalida ese cache, y los
// specs verían datos de corridas anteriores. Lo que no tiene cache en el
// proxy (bookings, businesssettings — este último ni siquiera tiene ruta
// proxy propia) se sigue creando directo contra el backend.

const API_URL = process.env.E2E_API_URL ?? "http://localhost:5048";
const FRONTEND_URL = process.env.E2E_FRONTEND_URL ?? "http://localhost:3000";
const SEED_FILE = path.resolve(__dirname, ".e2e-seed.json");
export const ADMIN_STORAGE_STATE = path.resolve(__dirname, ".auth-admin.json");

async function waitForUrl(url: string, timeoutMs = 60_000) {
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

async function postThroughProxy<T>(request: APIRequestContext, path: string, data: unknown): Promise<T> {
  const res = await request.post(`${FRONTEND_URL}${path}`, { data });
  if (!res.ok()) {
    throw new Error(`POST ${path} (proxy) falló: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

export default async function globalSetup() {
  await waitForUrl(`${API_URL}/api/services`);
  await waitForUrl(FRONTEND_URL);

  // Precompilar /admin/login antes de que Playwright navegue con un timeout
  // corto (30s por defecto). En modo dev, Next.js compila cada ruta on-demand
  // la primera vez que se pide — con el backend y el frontend arrancando en
  // frío al mismo tiempo, esa primera compilación puede superar el timeout de
  // navegación y tirar abajo todo el globalSetup (visto en la sesión 15/07:
  // waitForURL/page.goto fallando en runs consecutivos). No se puede
  // precompilar /admin/turnos de la misma forma: el middleware redirige
  // cualquier request sin cookie de sesión a /admin/login antes de renderizar
  // la página real, así que esa ruta solo se compila después del login.
  await waitForUrl(`${FRONTEND_URL}/admin/login`, 60_000);

  const runId = Date.now().toString(36);
  const adminEmail = `e2e-admin-${runId}@example.com`;
  const adminPassword = "E2ePassword123";

  const registerRes = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
      confirmPassword: adminPassword,
    }),
  });
  if (!registerRes.ok) {
    throw new Error(`No se pudo registrar admin de e2e: ${registerRes.status} ${await registerRes.text()}`);
  }
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${(await registerRes.json()).token}`,
  };

  // Loguear al admin UNA sola vez, con un browser real, y guardar la sesión
  // (storageState) para que el resto de los specs admin-* arranquen ya
  // logueados. Necesario porque /api/auth/login comparte la política de
  // rate limiting "auth" (5 req/min por IP) con /register — con varios
  // specs de admin corriendo en paralelo, cada uno logueando por su cuenta
  // agota el límite y el login falla con 429 (que el proxy de Next.js, sin
  // body JSON, reporta como "Error de conexión con el servidor", mismo
  // patrón que el hallazgo (h) de la auditoría). Solo admin-services.spec.ts
  // sigue logueando de cero por UI, para mantener cobertura real del login.
  // La misma sesión de browser (context.request) se reusa abajo para
  // sembrar vía el proxy con las cookies de admin ya puestas.
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const loginPage = await context.newPage();
  // Timeouts largos a propósito: /admin/login ya se precompiló arriba, pero
  // /admin/turnos (destino post-login) recién se compila acá, en frío.
  await loginPage.goto(`${FRONTEND_URL}/admin/login`, { timeout: 60_000 });
  await loginPage.getByTestId("admin-login-email").fill(adminEmail);
  await loginPage.getByTestId("admin-login-password").fill(adminPassword);
  await Promise.all([
    loginPage.waitForURL("**/admin/turnos", { timeout: 60_000 }),
    loginPage.getByTestId("admin-login-submit").click(),
  ]);
  await context.storageState({ path: ADMIN_STORAGE_STATE });

  const serviceTitle = `Servicio E2E ${runId}`;
  const serviceSlug = `servicio-e2e-${runId}`;
  await postThroughProxy(context.request, "/api/services", {
    title: serviceTitle,
    slug: serviceSlug,
    price: "10000",
    duration: "60min",
    imageUrl: "",
    description: "Servicio creado por la suite de e2e",
    details: [],
    isActive: true,
    order: 0,
  });

  const productName = `Producto E2E ${runId}`;
  await postThroughProxy(context.request, "/api/products", {
    name: productName,
    price: 2500,
    isActive: true,
    order: 0,
  });

  // businesssettings no tiene ruta proxy propia en el frontend (otro caso de
  // backend sin UI, ver auditoría) y su GET tampoco tiene cache — directo al backend.
  // Todos los días habilitados para no depender de qué día corre la suite.
  const settingsRes = await fetch(`${API_URL}/api/businesssettings`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: "09:00",
      slotDuration: 60,
      breakBetweenSlots: 0,
      maxDaysInAdvance: 10,
    }),
  });
  if (!settingsRes.ok) {
    throw new Error(`No se pudo generar turnos de e2e: ${settingsRes.status} ${await settingsRes.text()}`);
  }

  // Reservas sembradas para el portal "Mis turnos" (búsqueda anónima por
  // email, sin OTP — ver docs/auditoriabelleza_0507.md sección 9): una para
  // cancelar, otra para reprogramar. Se crean vía POST /api/bookings público
  // directo al backend (sin cache de por medio), igual que un cliente real.
  const misTurnosEmail = `mis-turnos-e2e-${runId}@example.com`;

  async function seedBooking(subject: string, customerName = "Cliente Mis Turnos E2E", email = misTurnosEmail): Promise<number> {
    const slotsRes = await fetch(`${API_URL}/api/timeslots/available`);
    const slots = (await slotsRes.json()) as { id: number }[];
    if (slots.length === 0) {
      throw new Error("No quedan turnos disponibles para sembrar reservas de e2e");
    }
    const bookingRes = await fetch(`${API_URL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeSlotId: slots[0].id,
        customerName,
        customerPhone: "+5491100000001",
        email,
        subject,
      }),
    });
    if (!bookingRes.ok) {
      throw new Error(`No se pudo sembrar reserva de mis-turnos: ${bookingRes.status} ${await bookingRes.text()}`);
    }
    return (await bookingRes.json()).booking.id as number;
  }

  const misTurnosCancelSubject = `Turno a cancelar E2E ${runId}`;
  const misTurnosRescheduleSubject = `Turno a reprogramar E2E ${runId}`;
  await seedBooking(misTurnosCancelSubject);
  await seedBooking(misTurnosRescheduleSubject);

  // Reserva dedicada para el e2e de Historial (admin) — cliente propio, para
  // no depender del estado final de las reservas de "Mis turnos" (esas las
  // cancela/reprograma otro spec en paralelo).
  const historialCustomerName = `Cliente Historial E2E ${runId}`;
  await seedBooking(
    `Turno para historial E2E ${runId}`,
    historialCustomerName,
    `historial-e2e-${runId}@example.com`
  );

  // Reserva dedicada para el e2e de Caja — cliente propio, para no depender
  // del estado de otros turnos mutados en paralelo por otros specs.
  const cajaCustomerName = `Cliente Caja E2E ${runId}`;
  const cajaBookingId = await seedBooking(
    `Turno para caja E2E ${runId}`,
    cajaCustomerName,
    `caja-e2e-${runId}@example.com`
  );

  // Profesional con acceso propio (login) para el e2e de "Mi Agenda".
  const professionalLastName = `E2E ${runId}`;
  const professional = await postThroughProxy<{ id: number }>(context.request, "/api/professionals", {
    firstName: "Profesional",
    lastName: professionalLastName,
    calendarColor: "#7c3aed",
    commission: 0,
    isActive: true,
    order: 0,
    serviceIds: [],
  });
  const professionalFullName = `Profesional ${professionalLastName}`;

  // professional-account no tiene cache — directo al backend está bien.
  const professionalEmail = `professional-e2e-${runId}@example.com`;
  const professionalPassword = "E2ePassword123";
  const accountRes = await fetch(`${API_URL}/api/auth/professional-account`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      professionalId: professional.id,
      email: professionalEmail,
      username: null,
      password: professionalPassword,
    }),
  });
  if (!accountRes.ok) {
    throw new Error(`No se pudo activar el acceso del profesional de e2e: ${accountRes.status} ${await accountRes.text()}`);
  }

  // Item de Galería y video de Contenido sembrados con imageUrl/videoUrl ya
  // seteados (no se prueba el upload real a Cloudinary por e2e — el input de
  // "pegar URL directamente" de CloudinaryUpload solo se renderiza cuando ya
  // hay un value, así que los specs de edición dependen de que exista de entrada).
  const galleryTitle = `Galería E2E ${runId}`;
  await postThroughProxy(context.request, "/api/gallery", {
    title: galleryTitle,
    tag: "e2e",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    isActive: true,
    order: 0,
  });

  const videoTitle = `Video E2E ${runId}`;
  await postThroughProxy(context.request, "/api/content-videos", {
    title: videoTitle,
    videoUrl: "https://res.cloudinary.com/demo/video/upload/dog.mp4",
    thumbnailUrl: "",
    isActive: true,
    order: 0,
  });

  await browser.close();

  fs.writeFileSync(
    SEED_FILE,
    JSON.stringify(
      {
        serviceTitle,
        serviceSlug,
        productName,
        adminEmail,
        adminPassword,
        misTurnosEmail,
        misTurnosCancelSubject,
        misTurnosRescheduleSubject,
        professionalEmail,
        professionalPassword,
        professionalFullName,
        professionalId: professional.id,
        galleryTitle,
        videoTitle,
        historialCustomerName,
        cajaBookingId,
      },
      null,
      2
    )
  );
}
