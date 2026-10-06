// app/api/auth/google/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getGoogleOAuthConfig, isAllowedTenantHost, loginUrl, originForHost, verifyState } from "@/src/lib/googleOAuth";

export const dynamic = "force-dynamic";

// Paso 2 (dominio central — la única URL registrada en Google): no inicia
// sesión, solo valida el `state` y reenvía el `code` al host del negocio que
// arrancó el flujo. El canje del code y la cookie de sesión se hacen allá.
export async function GET(request: NextRequest) {
  const config = getGoogleOAuthConfig();
  if (!config) return NextResponse.json({ message: "Login con Google no configurado" }, { status: 503 });

  const params = request.nextUrl.searchParams;
  const state = verifyState(params.get("state"), config.stateSecret);

  // Sin un state válido no hay host confiable al que volver.
  if (!state || !isAllowedTenantHost(state.host, request.headers.get("host"))) {
    return NextResponse.json({ message: "Solicitud inválida o expirada. Volvé a intentar desde el login." }, { status: 400 });
  }

  const code = params.get("code");
  if (!code) {
    // El usuario canceló en la pantalla de Google, o Google devolvió un error.
    return NextResponse.redirect(loginUrl(state.host, { error: "google_cancelled" }));
  }

  const finishUrl = new URL(`${originForHost(state.host)}/api/auth/google/finish`);
  finishUrl.search = new URLSearchParams({ code, state: params.get("state")! }).toString();
  return NextResponse.redirect(finishUrl);
}
