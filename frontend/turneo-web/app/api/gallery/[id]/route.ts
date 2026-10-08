import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { relayResponse } from "@/src/lib/proxyResponse";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token =
    request.cookies.get("admin_token")?.value ||
    request.cookies.get("client_token")?.value ||
    request.cookies.get("token")?.value;
  try {
    const response = await fetch(`${API_URL}/api/gallery/${params.id}`, {
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token =
    request.cookies.get("admin_token")?.value ||
    request.cookies.get("client_token")?.value ||
    request.cookies.get("token")?.value;
  const body = await request.json();
  try {
    const response = await fetch(`${API_URL}/api/gallery/${params.id}`, {
      method: "PUT",
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      revalidateTag("gallery");
    }
    return await relayResponse(response);
  } catch {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token =
    request.cookies.get("admin_token")?.value ||
    request.cookies.get("client_token")?.value ||
    request.cookies.get("token")?.value;
  try {
    const response = await fetch(`${API_URL}/api/gallery/${params.id}`, {
      method: "DELETE",
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
      },
    });
    if (response.ok) {
      revalidateTag("gallery");
    }
    if (response.status === 204)
      return new NextResponse(null, { status: 204 });
    return await relayResponse(response);
  } catch {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}
