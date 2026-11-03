import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { relayResponse } from "@/src/lib/proxyResponse";
import { API_URL } from "@/src/lib/apiUrl";

// GET: the tenant's active coverage localities for the public booking flow.
// Anonymous: the tenant comes from the host, or from `?tenantSlug=` in the
// Smart Tag flow (same rule as the timeslots proxy).
export async function GET(request: NextRequest) {
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
  try {
    const response = await fetch(`${API_URL}/api/home-service/coverage-localities/active`, {
      method: "GET",
      headers: {
        ...tenantHeader(request, tenantSlug),
        "Content-Type": "application/json",
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
