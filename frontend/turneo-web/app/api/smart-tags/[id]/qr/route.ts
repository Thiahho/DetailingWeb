import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

function getToken(request: NextRequest) {
  return request.cookies.get("admin_token")?.value ?? request.cookies.get("token")?.value ?? "";
}

// A diferencia del resto de los proxies de smart-tags, esto devuelve bytes de
// imagen, no JSON.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = await fetch(`${API_URL}/api/smart-tags/${params.id}/qr`, {
      headers: { ...tenantHeader(request), Authorization: `Bearer ${getToken(request)}` },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ message: "No se pudo generar el QR" }, { status: res.status });
    }

    const bytes = await res.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  } catch {
    return NextResponse.json({ message: "Error de conexión" }, { status: 500 });
  }
}
