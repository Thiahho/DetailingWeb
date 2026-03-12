import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

// GET: Obtener servicios activos (público)
export async function GET() {
  try {
    const response = await fetch(`${API_URL}/api/services`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 60 }, // cache 60s
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}

// POST: Crear servicio (admin)
export async function POST(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const body = await request.json();
  try {
    const response = await fetch(`${API_URL}/api/services`, {
      method: "POST",
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}
