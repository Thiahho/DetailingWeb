import { NextRequest, NextResponse } from "next/server";
import { relayResponse } from "@/src/lib/proxyResponse";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

// Sin tenantHeader: el backend resuelve el tenant por el token del Smart Tag,
// no por Host (ver SmartLinkController.cs).
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = await request.json();
    const res = await fetch(`${API_URL}/api/smart/${params.token}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return await relayResponse(res);
  } catch {
    return NextResponse.json({ message: "Error de conexión" }, { status: 500 });
  }
}
