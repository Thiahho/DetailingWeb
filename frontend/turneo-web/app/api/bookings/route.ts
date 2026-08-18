import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

// GET: Obtener todas las reservas (admin)
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value || request.cookies.get("token")?.value;

  try {
    const response = await fetch(`${API_URL}/api/bookings`, {
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
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

// POST: Crear una reserva
// El email de confirmación al cliente/admin lo manda el backend (.NET,
// NotificationService + GmailProvider) — antes este endpoint también mandaba
// el suyo propio con nodemailer, duplicando el aviso al cliente.
export async function POST(request: NextRequest) {
  const body = await request.json();

  try {
    const response = await fetch(`${API_URL}/api/bookings`, {
      method: "POST",
      headers: {
        ...tenantHeader(request),
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
