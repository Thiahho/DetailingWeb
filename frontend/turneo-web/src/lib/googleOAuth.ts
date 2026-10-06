import { createHmac, timingSafeEqual } from "crypto";

// Helpers server-side del login con Google de profesionales (rutas en
// app/api/auth/google/*). Flujo por redirección con UNA sola URL de callback
// registrada en Google: los negocios viven en subdominios y Google no acepta
// comodines, así que el callback central reenvía al host del negocio, que es
// quien termina el login (y donde tiene que quedar la cookie de sesión).

const TENANCY_BASE_DOMAIN = (process.env.NEXT_PUBLIC_TENANCY_BASE_DOMAIN || "turneo.app").toLowerCase();

export const NONCE_COOKIE = "g_oauth_nonce";
const STATE_TTL_MS = 10 * 60 * 1000;

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  stateSecret: string;
}

// Null si falta alguna variable: las rutas responden con error en vez de
// arrancar un flujo que no puede terminar.
export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const stateSecret = process.env.AUTH_STATE_SECRET;
  if (!clientId || !clientSecret || !redirectUri || !stateSecret) return null;
  return { clientId, clientSecret, redirectUri, stateSecret };
}

export interface OAuthState {
  host: string;
  nonce: string;
  exp: number;
}

const sign = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

// state = payload.firma — viaja por Google ida y vuelta, así que se firma para
// que nadie pueda cambiar el host al que el callback va a reenviar el `code`.
export function createState(host: string, nonce: string, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ host, nonce, exp: Date.now() + STATE_TTL_MS } satisfies OAuthState)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyState(state: string | null, secret: string): OAuthState | null {
  if (!state) return null;
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as OAuthState;
    if (typeof parsed.host !== "string" || typeof parsed.nonce !== "string" || typeof parsed.exp !== "number") return null;
    return parsed.exp > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

const isLocalHost = (host: string) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);

// Hosts a los que el callback central puede reenviar el `code`: él mismo, el
// dominio base y sus subdominios (un negocio = un subdominio), o localhost en desarrollo.
export function isAllowedTenantHost(host: string, callbackHost: string | null): boolean {
  const normalized = host.toLowerCase();
  if (callbackHost && normalized === callbackHost.toLowerCase()) return true;
  if (isLocalHost(normalized)) return true;
  const hostname = normalized.split(":")[0];
  return hostname === TENANCY_BASE_DOMAIN || hostname.endsWith(`.${TENANCY_BASE_DOMAIN}`);
}

export const originForHost = (host: string) => `${isLocalHost(host.toLowerCase()) ? "http" : "https"}://${host}`;

// Vuelta a la pantalla de login del profesional, con ?sso=1 (ok) o ?error=<código>.
export const loginUrl = (host: string, params: Record<string, string>) =>
  `${originForHost(host)}/profesional/login?${new URLSearchParams(params).toString()}`;
