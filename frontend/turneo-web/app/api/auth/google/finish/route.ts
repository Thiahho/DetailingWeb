// app/api/auth/google/finish/route.ts
import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { NONCE_COOKIE, getGoogleOAuthConfig, loginUrl, verifyState } from "@/src/lib/googleOAuth";

export const dynamic = "force-dynamic";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

// Paso 3 (de vuelta en el host del negocio): canjea el `code` por el ID token
// de Google, se lo pasa al backend (que lo valida por su cuenta y decide si ese
// correo puede entrar) y deja la cookie de sesión del profesional en este host.
export async function GET(request: NextRequest) {
  const host = request.headers.get("host");
  const config = getGoogleOAuthConfig();
  if (!host) return NextResponse.json({ message: "Host inválido" }, { status: 400 });

  const fail = (error: string) => {
    const response = NextResponse.redirect(loginUrl(host, { error }));
    response.cookies.delete({ name: NONCE_COOKIE, path: "/api/auth/google" });
    return response;
  };

  if (!config) return fail("google_unavailable");

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = verifyState(params.get("state"), config.stateSecret);
  const nonce = request.cookies.get(NONCE_COOKIE)?.value;

  // El state tiene que haber salido de ESTE navegador (nonce en cookie) y para ESTE host.
  if (!code || !state || !nonce || state.nonce !== nonce || state.host.toLowerCase() !== host.toLowerCase()) {
    return fail("google_failed");
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.id_token) return fail("google_failed");

    const backendResponse = await fetch(`${API_URL}/api/auth/professional/google`, {
      method: "POST",
      headers: { ...tenantHeader(request), "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: tokenData.id_token }),
    });

    if (backendResponse.status === 401) return fail("not_invited");
    if (!backendResponse.ok) return fail("google_failed");

    const sessionToken = backendResponse.headers.get("set-cookie")?.match(/token=([^;]+)/)?.[1];
    if (!sessionToken) return fail("google_failed");

    const response = NextResponse.redirect(loginUrl(host, { sso: "1" }));
    // Mismo slot y mismas opciones que el login por contraseña de un profesional
    // (ver app/api/auth/[...path]/route.ts).
    response.cookies.set("token", sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    response.cookies.delete({ name: NONCE_COOKIE, path: "/api/auth/google" });
    return response;
  } catch {
    return fail("google_failed");
  }
}
