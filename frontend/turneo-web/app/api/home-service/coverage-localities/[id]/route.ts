import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { relayResponse } from "@/src/lib/proxyResponse";
import { API_URL } from "@/src/lib/apiUrl";

// PUT: update a coverage locality (admin, full replace)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = request.cookies.get("admin_token")?.value || request.cookies.get("client_token")?.value || request.cookies.get("token")?.value;
  const body = await request.json();
  try {
    const response = await fetch(`${API_URL}/api/home-service/coverage-localities/${encodeURIComponent(params.id)}`, {
      method: "PUT",
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return await relayResponse(response);
  } catch {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}

// DELETE: remove a coverage locality (admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = request.cookies.get("admin_token")?.value || request.cookies.get("client_token")?.value || request.cookies.get("token")?.value;
  try {
    const response = await fetch(`${API_URL}/api/home-service/coverage-localities/${encodeURIComponent(params.id)}`, {
      method: "DELETE",
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
    });
    return await relayResponse(response);
  } catch {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}
