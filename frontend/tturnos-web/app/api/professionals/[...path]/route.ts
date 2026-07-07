import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

// GET: Obtener un profesional por id (público) o todos incluyendo inactivos (admin/all)
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const token = request.cookies.get("admin_token")?.value || request.cookies.get("client_token")?.value || request.cookies.get("token")?.value;
  const path = params.path.join("/");
  try {
    const response = await fetch(`${API_URL}/api/professionals/${path}${request.nextUrl.search}`, {
      method: "GET",
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

// PUT: Actualizar profesional (admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const token = request.cookies.get("admin_token")?.value || request.cookies.get("client_token")?.value || request.cookies.get("token")?.value;
  const path = params.path.join("/");
  const body = await request.json();
  try {
    const response = await fetch(`${API_URL}/api/professionals/${path}`, {
      method: "PUT",
      headers: {
        ...tenantHeader(request),
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

// DELETE: Eliminar profesional (admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const token = request.cookies.get("admin_token")?.value || request.cookies.get("client_token")?.value || request.cookies.get("token")?.value;
  const path = params.path.join("/");
  try {
    const response = await fetch(`${API_URL}/api/professionals/${path}`, {
      method: "DELETE",
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
