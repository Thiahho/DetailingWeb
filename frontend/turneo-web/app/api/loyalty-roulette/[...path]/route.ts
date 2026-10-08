import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { relayResponse } from "@/src/lib/proxyResponse";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

function authHeader(request: NextRequest) {
  const token =
    request.cookies.get("admin_token")?.value ||
    request.cookies.get("client_token")?.value ||
    request.cookies.get("token")?.value;
  return token ? `Bearer ${token}` : "";
}

// GET: prizes (público), prizes/all y spins (admin)
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join("/");
  try {
    const response = await fetch(`${API_URL}/api/loyalty-roulette/${path}`, {
      method: "GET",
      headers: {
        ...tenantHeader(request),
        Authorization: authHeader(request),
        "Content-Type": "application/json",
      },
    });
    return relayResponse(response);
  } catch {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}

// POST: spin (público), prizes y spins/redeem (admin)
export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join("/");
  const body = await request.json();
  try {
    const response = await fetch(`${API_URL}/api/loyalty-roulette/${path}`, {
      method: "POST",
      headers: {
        ...tenantHeader(request),
        Authorization: authHeader(request),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return relayResponse(response);
  } catch {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}

// PUT: prizes/{id} (admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join("/");
  const body = await request.json();
  try {
    const response = await fetch(`${API_URL}/api/loyalty-roulette/${path}`, {
      method: "PUT",
      headers: {
        ...tenantHeader(request),
        Authorization: authHeader(request),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return relayResponse(response);
  } catch {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}
