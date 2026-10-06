// app/api/auth/google/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { NONCE_COOKIE, createState, getGoogleOAuthConfig, loginUrl } from "@/src/lib/googleOAuth";

export const dynamic = "force-dynamic";

// Paso 1 (en el host del negocio): manda al profesional a Google. El `state`
// firmado lleva este host para que el callback central sepa a dónde volver; el
// nonce queda en una cookie de este host y se compara en /finish (anti-CSRF).
export async function GET(request: NextRequest) {
  const host = request.headers.get("host");
  const config = getGoogleOAuthConfig();
  if (!host) return NextResponse.json({ message: "Host inválido" }, { status: 400 });
  if (!config) return NextResponse.redirect(loginUrl(host, { error: "google_unavailable" }));

  const nonce = randomBytes(16).toString("hex");
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email",
    state: createState(host, nonce, config.stateSecret),
    prompt: "select_account",
  }).toString();

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax", // tiene que viajar en la navegación de vuelta desde Google
    path: "/api/auth/google",
    maxAge: 600,
  });
  return response;
}
