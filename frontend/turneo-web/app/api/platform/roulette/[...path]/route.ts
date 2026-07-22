import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

// Gestión de leads de la ruleta — solo el dueño de la plataforma (mismo
// patrón que /api/platform/tenants).

// GET: /api/platform/roulette/leads
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join("/") || "";
  const token = request.cookies.get("platform_token")?.value;

  try {
    const response = await fetch(`${API_URL}/api/platform/roulette/${path}`, {
      headers: { Authorization: token ? `Bearer ${token}` : "" },
      cache: "no-store",
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ message: "Error de conexión con el servidor" }, { status: 500 });
  }
}

// PATCH: /api/platform/roulette/leads/5/status | /api/platform/roulette/prizes/3
export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join("/") || "";
  const token = request.cookies.get("platform_token")?.value;
  const body = await request.text();

  try {
    const response = await fetch(`${API_URL}/api/platform/roulette/${path}`, {
      method: "PATCH",
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
      body,
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ message: "Error de conexión con el servidor" }, { status: 500 });
  }
}

// POST: /api/platform/roulette/prizes
export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join("/") || "";
  const token = request.cookies.get("platform_token")?.value;
  const body = await request.text();

  try {
    const response = await fetch(`${API_URL}/api/platform/roulette/${path}`, {
      method: "POST",
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
      body,
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ message: "Error de conexión con el servidor" }, { status: 500 });
  }
}

// DELETE: /api/platform/roulette/leads/5
export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join("/") || "";
  const token = request.cookies.get("platform_token")?.value;

  try {
    const response = await fetch(`${API_URL}/api/platform/roulette/${path}`, {
      method: "DELETE",
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ message: "Error de conexión con el servidor" }, { status: 500 });
  }
}
