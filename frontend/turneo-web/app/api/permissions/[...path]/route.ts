import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { relayResponse } from "@/src/lib/proxyResponse";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

function authHeader(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value || request.cookies.get("client_token")?.value || request.cookies.get("token")?.value;
  return token ? `Bearer ${token}` : "";
}

// GET: ej. /api/permissions/me | /api/permissions/modules | /api/permissions/staff
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join("/") || "";

  try {
    const response = await fetch(`${API_URL}/api/permissions/${path}`, {
      headers: {
        ...tenantHeader(request),
        Authorization: authHeader(request),
      },
    });
    return await relayResponse(response);
  } catch {
    return NextResponse.json({ message: "Error de conexión con el servidor" }, { status: 500 });
  }
}

// POST: ej. /api/permissions/staff (crear cuenta Staff)
export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join("/") || "";
  const body = await request.text();

  try {
    const response = await fetch(`${API_URL}/api/permissions/${path}`, {
      method: "POST",
      headers: {
        ...tenantHeader(request),
        Authorization: authHeader(request),
        "Content-Type": "application/json",
      },
      body,
    });
    return await relayResponse(response);
  } catch {
    return NextResponse.json({ message: "Error de conexión con el servidor" }, { status: 500 });
  }
}

// PUT: ej. /api/permissions/staff/{id} | /api/permissions/staff/{id}/password
export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join("/") || "";
  const body = await request.text();

  try {
    const response = await fetch(`${API_URL}/api/permissions/${path}`, {
      method: "PUT",
      headers: {
        ...tenantHeader(request),
        Authorization: authHeader(request),
        "Content-Type": "application/json",
      },
      body,
    });
    return await relayResponse(response);
  } catch {
    return NextResponse.json({ message: "Error de conexión con el servidor" }, { status: 500 });
  }
}

// DELETE: /api/permissions/staff/{id} (revoca el acceso)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join("/") || "";

  try {
    const response = await fetch(`${API_URL}/api/permissions/${path}`, {
      method: "DELETE",
      headers: {
        ...tenantHeader(request),
        Authorization: authHeader(request),
      },
    });
    return await relayResponse(response);
  } catch {
    return NextResponse.json({ message: "Error de conexión con el servidor" }, { status: 500 });
  }
}
