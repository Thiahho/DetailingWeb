import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { relayResponse } from "@/src/lib/proxyResponse";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

// GET también sirve como proxy de GET /api/reviews/all (id="all") desde el
// panel admin — mismo truco que app/api/gallery/[id]/route.ts, ya que el
// backend no define GET /api/reviews/{id}.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token =
    request.cookies.get("admin_token")?.value ||
    request.cookies.get("client_token")?.value ||
    request.cookies.get("token")?.value;
  try {
    const response = await fetch(`${API_URL}/api/reviews/${params.id}`, {
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
      },
      cache: "no-store",
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
    const response = await fetch(`${API_URL}/api/reviews/${params.id}`, {
      method: "PUT",
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      revalidateTag("reviews");
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
    const response = await fetch(`${API_URL}/api/reviews/${params.id}`, {
      method: "DELETE",
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
      },
    });
    if (response.ok) {
      revalidateTag("reviews");
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
