import { NextRequest, NextResponse } from "next/server";
import { clientIpHeaders } from "@/src/lib/tenantHeader";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

// Login del panel interno (dueño de plataforma) — separado del proxy de
// /api/auth para no mezclar la cookie platform_token con admin_token/client_token.
export async function POST(request: NextRequest) {
  const body = await request.json();

  try {
    const response = await fetch(`${API_URL}/api/platform/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...clientIpHeaders(request) },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok && data.email) {
      const nextResponse = NextResponse.json(data);
      const backendCookie = response.headers.get("set-cookie");

      if (backendCookie) {
        const match = backendCookie.match(/platform_token=([^;]+)/);
        if (match) {
          nextResponse.cookies.set("platform_token", match[1], {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
          });
        }
      }

      return nextResponse;
    }

    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}
