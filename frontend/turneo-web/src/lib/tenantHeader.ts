import { NextRequest } from "next/server";

const TENANCY_BASE_DOMAIN = process.env.NEXT_PUBLIC_TENANCY_BASE_DOMAIN || "turneo.app";

// El backend corre en un host distinto (Render) al que el usuario realmente
// visita (subdominio del tenant en Vercel), así que no puede resolver el
// tenant mirando su propio Request.Host en requests públicas/anónimas.
// Este header le pasa el host real que vio esta ruta proxy.
//
// `tenantSlugOverride`: para el flujo de Smart Tag (docs/NFC.md), donde la
// página pública vive en el dominio compartido `turneo.app/s/{token}` — no en
// el subdominio propio del tenant — así que el Host real no sirve para
// resolver tenant. El slug ya fue resuelto por token (GET /api/smart/{token})
// y se pasa explícito acá en vez de confiar en el host.
export function tenantHeader(request: NextRequest, tenantSlugOverride?: string | null): Record<string, string> {
  if (tenantSlugOverride) {
    return { "X-Tenant-Host": `${tenantSlugOverride}.${TENANCY_BASE_DOMAIN}` };
  }
  const host = request.headers.get("host");
  return host ? { "X-Tenant-Host": host } : {};
}
