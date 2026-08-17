import { NextRequest } from "next/server";

// El backend corre en un host distinto (Render) al que el usuario realmente
// visita (subdominio del tenant en Vercel), así que no puede resolver el
// tenant mirando su propio Request.Host en requests públicas/anónimas.
// Este header le pasa el host real que vio esta ruta proxy.
//
// También reenvía la IP real del cliente: sin esto, el rate limiter por IP
// del backend (Program.cs, políticas "auth"/"public-booking"/etc.) ve
// siempre la IP saliente de la función serverless de Vercel, no la del
// visitante — agrupa a todos los usuarios reales en el mismo balde de rate
// limit en vez de limitar por IP individual. Vercel antepone la IP real del
// cliente en x-forwarded-for (o la expone sola en x-real-ip); el backend ya
// confía en X-Forwarded-For vía ForwardedHeadersOptions.
export function tenantHeader(request: NextRequest): Record<string, string> {
  const host = request.headers.get("host");
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;

  return {
    ...(host ? { "X-Tenant-Host": host } : {}),
    ...(clientIp ? { "X-Forwarded-For": clientIp } : {}),
  };
}
