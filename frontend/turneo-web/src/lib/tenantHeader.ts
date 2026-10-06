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
//
// Además de `X-Tenant-Host` viajan `X-Client-IP` + `X-Proxy-Secret` (ver
// clientIpHeaders). Solo se importa desde código de servidor (rutas
// `app/api/**`): el secreto nunca debe llegar a un componente cliente.
export function tenantHeader(request: NextRequest, tenantSlugOverride?: string | null): Record<string, string> {
  const clientIp = clientIpHeaders(request);
  if (tenantSlugOverride) {
    return { "X-Tenant-Host": `${tenantSlugOverride}.${TENANCY_BASE_DOMAIN}`, ...clientIp };
  }
  const host = request.headers.get("host");
  return host ? { "X-Tenant-Host": host, ...clientIp } : clientIp;
}

// El rate limiting del backend es por IP, pero la única IP que ve es la de
// salida de este proxy: sin esto todos los visitantes comparten un mismo
// balde. Se le pasa la IP real del visitante, y el backend la usa solo si
// `X-Proxy-Secret` coincide con su `Proxy:SharedSecret` (mismo valor que
// PROXY_SHARED_SECRET acá — variable solo de servidor, sin NEXT_PUBLIC).
// Sin secreto o sin IP no se manda nada y el backend se comporta como siempre.
//
// Exportada para las rutas proxy sin tenant (ruleta de captación, login de
// plataforma, webhook de pagos), que no pasan por `tenantHeader()`.
export function clientIpHeaders(request: NextRequest): Record<string, string> {
  const secret = process.env.PROXY_SHARED_SECRET;
  if (!secret) return {};

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim();
  return ip ? { "X-Client-IP": ip, "X-Proxy-Secret": secret } : {};
}
