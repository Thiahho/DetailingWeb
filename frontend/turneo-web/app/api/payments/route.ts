import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { relayResponse } from "@/src/lib/proxyResponse";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

// POST: Create MercadoPago preference
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/payments/create-preference`, {
      method: "POST",
      headers: { ...tenantHeader(request), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return await relayResponse(response);
  } catch {
    return NextResponse.json(
      { success: false, message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}

// GET: All payments (admin)
export async function GET(request: NextRequest) {
  const token =
    request.cookies.get("admin_token")?.value ||
    request.cookies.get("token")?.value;

  try {
    const response = await fetch(`${API_URL}/api/payments`, {
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
    });
    return await relayResponse(response);
  } catch {
    return NextResponse.json(
      { success: false, message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}
