import { NextResponse } from "next/server";
import { clientRateLimitKey } from "@/src/lib/clientIp";
import { createRateLimiter, type RateLimiter } from "@/src/lib/rateLimit";

/**
 * Per-IP limits of the /api/geo/* proxies (AccFenix audit finding B2).
 * - localidades / direcciones: 60 requests per minute per IP each. The booking UI debounces
 *   typing (250 ms), so one person filling an address stays well below it.
 * - ubicacion: 10 Maps links per minute per IP; each one can cost a Nominatim call (1 req/s policy).
 *
 * In-memory and per server instance (see src/lib/rateLimit.ts): on serverless each instance keeps
 * its own counters, which is enough to stop a single client from hammering the providers.
 */
const MINUTE = 60_000;
const limiters: Record<GeoEndpoint, RateLimiter> = {
  localidades: createRateLimiter({ limit: 60, windowMs: MINUTE }),
  direcciones: createRateLimiter({ limit: 60, windowMs: MINUTE }),
  ubicacion: createRateLimiter({ limit: 10, windowMs: MINUTE }),
};

export type GeoEndpoint = "localidades" | "direcciones" | "ubicacion";

export const RATE_LIMIT_MESSAGE = "Hiciste muchas búsquedas seguidas. Esperá unos segundos y volvé a intentar.";

/**
 * Returns a 429 response when the client IP exceeded the endpoint limit, or null to continue.
 * List endpoints keep `items: []` in the body so the client contract stays the same.
 */
export function geoRateLimit(req: Request, endpoint: GeoEndpoint): NextResponse | null {
  const { ok, retryAfterSeconds } = limiters[endpoint].check(clientRateLimitKey(req.headers));
  if (ok) return null;
  const body = { ...(endpoint === "ubicacion" ? {} : { items: [] }), error: "demasiadas-solicitudes", message: RATE_LIMIT_MESSAGE };
  return NextResponse.json(body, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
}
