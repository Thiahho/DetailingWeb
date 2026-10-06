// Entorno de los dos servidores que levanta playwright.landing.config.ts.
import { randomUUID } from "node:crypto";
import { demoConnectionString } from "./db.mjs";
import { API_URL, WEB_URL } from "./ports.mjs";

// Secreto del proxy solo para esta corrida: habilita X-Client-IP en la API
// (ver ClientIpResolver.cs) para que la siembra no choque con el rate limit
// por IP de los endpoints públicos. Se genera en el proceso principal de
// Playwright y los workers lo heredan por entorno; no se guarda en ningún lado.
process.env.LANDING_PROXY_SECRET ??= randomUUID();
export const PROXY_SECRET = process.env.LANDING_PROXY_SECRET;

/** Entorno de la API: Testing (registro abierto + notificaciones Noop) sobre la base demo. */
export function apiEnv() {
  return {
    ASPNETCORE_ENVIRONMENT: "Testing",
    ConnectionStrings__DefaultConnection: demoConnectionString(),
    Proxy__SharedSecret: PROXY_SECRET,
    Cors__AllowedOrigins__0: WEB_URL,
    // Nada de esto debería usarse en Testing, pero se apaga explícito por si
    // la máquina tiene alguna de estas variables definida a nivel usuario.
    OpenAI__Enabled: "false",
    Payments__Enabled: "false",
  };
}

/** Entorno del frontend: apunta a la API demo y deja sin credenciales el envío de mails. */
export function webEnv() {
  return {
    NEXT_PUBLIC_API_URL: API_URL,
    NEXT_PUBLIC_API_BASE_URL: API_URL,
    PROXY_SHARED_SECRET: PROXY_SECRET,
    // .env.local trae credenciales reales de Gmail para los mails de reserva:
    // una variable ya definida en el entorno (aunque vacía) le gana al archivo.
    GMAIL_USER: "",
    GMAIL_APP_PASSWORD: "",
    GMAIL_ADMIN_EMAIL: "",
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "false",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}
