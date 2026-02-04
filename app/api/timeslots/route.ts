// app/api/timeslots/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_URL =
  //process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5048";
  
// GET: Obtener todos los timeslots (admin)
export async function GET(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  try {
    const response = await fetch(`${API_URL}/api/timeslots`, {
      method: "GET",
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
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

// POST: Crear timeslot
export async function POST(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const body = await request.json();

  try {
    const response = await fetch(`${API_URL}/api/timeslots`, {
      method: "POST",
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
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
