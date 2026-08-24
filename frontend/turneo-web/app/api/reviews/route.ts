import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { tenantHeader } from "@/src/lib/tenantHeader";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${API_URL}/api/reviews`, {
      headers: tenantHeader(request),
      next: { revalidate: 60, tags: ["reviews"] },
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

// Formulario público en la web (no requiere sesión): a diferencia de
// app/api/gallery/route.ts, este POST no reenvía ningún token de admin.
export async function POST(request: NextRequest) {
  const body = await request.json();
  try {
    const response = await fetch(`${API_URL}/api/reviews`, {
      method: "POST",
      headers: {
        ...tenantHeader(request),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (response.ok) {
      revalidateTag("reviews");
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}
