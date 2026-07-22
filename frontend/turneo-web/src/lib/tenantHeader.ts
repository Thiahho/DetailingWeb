import { NextRequest } from "next/server";

// El backend corre en un host distinto (Render) al que el usuario realmente
// visita (subdominio del tenant en Vercel), así que no puede resolver el
// tenant mirando su propio Request.Host en requests públicas/anónimas.
// Este header le pasa el host real que vio esta ruta proxy.
export function tenantHeader(request: NextRequest): Record<string, string> {
  const host = request.headers.get("host");
  return host ? { "X-Tenant-Host": host } : {};
}
