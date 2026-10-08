import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { relayResponse } from "@/src/lib/proxyResponse";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
  if (!email) return NextResponse.json({ message: "Email requerido" }, { status: 400 });

  try {
    const res = await fetch(`${API_URL}/api/bookings/by-email?email=${encodeURIComponent(email)}`, {
      headers: tenantHeader(request, tenantSlug),
      ...(tenantSlug ? { cache: "no-store" as const } : {}),
    });
    return await relayResponse(res);
  } catch {
    return NextResponse.json({ message: "Error de conexión" }, { status: 500 });
  }
}
