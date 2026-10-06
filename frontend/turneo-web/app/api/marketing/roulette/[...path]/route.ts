import { NextRequest, NextResponse } from "next/server";
import { clientIpHeaders } from "@/src/lib/tenantHeader";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

// Ruleta de captación (docs/RULETA.pdf) — endpoints públicos, sin tenant ni
// auth: es marketing propio de Turneo, no un dato de un negocio en la plataforma.

// GET: ej. /api/marketing/roulette/prizes
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join("/") || "";

  try {
    const response = await fetch(`${API_URL}/api/marketing/roulette/${path}`, {
      headers: clientIpHeaders(request),
      cache: "no-store",
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ message: "Error de conexión con el servidor" }, { status: 500 });
  }
}

// POST: ej. /api/marketing/roulette/spin
export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join("/") || "";
  const body = await request.text();

  try {
    const response = await fetch(`${API_URL}/api/marketing/roulette/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...clientIpHeaders(request) },
      body,
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ message: "Error de conexión con el servidor" }, { status: 500 });
  }
}

// PATCH: ej. /api/marketing/roulette/leads/5/additional-data
export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join("/") || "";
  const body = await request.text();

  try {
    const response = await fetch(`${API_URL}/api/marketing/roulette/${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...clientIpHeaders(request) },
      body,
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ message: "Error de conexión con el servidor" }, { status: 500 });
  }
}
