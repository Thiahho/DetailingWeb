import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

function getToken(request: NextRequest) {
  return request.cookies.get("admin_token")?.value ?? request.cookies.get("token")?.value ?? "";
}

// GET: admin — lista de pedidos. POST: público — el cliente carga su pedido de borrado.
export async function GET(request: NextRequest) {
  try {
    const res = await fetch(`${API_URL}/api/data-deletion-requests`, {
      headers: { ...tenantHeader(request), Authorization: `Bearer ${getToken(request)}` },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "Error de conexión" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${API_URL}/api/data-deletion-requests`, {
      method: "POST",
      headers: { ...tenantHeader(request), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "Error de conexión" }, { status: 500 });
  }
}
