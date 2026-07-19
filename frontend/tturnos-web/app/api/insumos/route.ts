import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { tenantHeader } from "@/src/lib/tenantHeader";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

// GET: Obtener insumos (admin)
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value || request.cookies.get("client_token")?.value || request.cookies.get("token")?.value;
  try {
    const response = await fetch(`${API_URL}/api/insumos`, {
      method: "GET",
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
      next: { revalidate: 60, tags: ["insumos"] }, // cache 60s, invalidado al crear/editar/borrar
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

// POST: Crear insumo (admin)
export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value || request.cookies.get("client_token")?.value || request.cookies.get("token")?.value;
  const body = await request.json();
  try {
    const response = await fetch(`${API_URL}/api/insumos`, {
      method: "POST",
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (response.ok) {
      revalidateTag("insumos");
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}
