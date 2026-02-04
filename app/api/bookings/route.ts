// app/api/bookings/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_URL =
  // process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5048";

// POST: Crear una reserva
export async function POST(request: NextRequest) {
  const body = await request.json();

  try {
    const response = await fetch(`${API_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}
