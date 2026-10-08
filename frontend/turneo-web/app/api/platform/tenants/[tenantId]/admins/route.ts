import { NextRequest, NextResponse } from "next/server";
import { relayResponse } from "@/src/lib/proxyResponse";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const { tenantId } = params;
  const token = request.cookies.get("platform_token")?.value;
  const body = await request.json();

  try {
    const response = await fetch(`${API_URL}/api/platform/tenants/${tenantId}/admins`, {
      method: "POST",
      headers: {
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
