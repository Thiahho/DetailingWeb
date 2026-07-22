import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("platform_token")?.value;

  try {
    const response = await fetch(`${API_URL}/api/platform/auth/me`, {
      method: "GET",
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    });

    // Sin cookie o con token vencido, el backend responde 401 con body vacío
    // (challenge JWT estándar, no JSON) — .json() explotaría con ese body.
    if (response.status === 401) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ message: "Error de conexión" }, { status: 500 });
  }
}
