import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { relayResponse } from "@/src/lib/proxyResponse";
import { API_URL } from "@/src/lib/apiUrl";

function getToken(request: NextRequest) {
  return request.cookies.get("admin_token")?.value ?? request.cookies.get("token")?.value ?? "";
}

export async function GET(request: NextRequest) {
  try {
    const res = await fetch(`${API_URL}/api/smart-tags/analytics`, {
      headers: { ...tenantHeader(request), Authorization: `Bearer ${getToken(request)}` },
      cache: "no-store",
    });
    return await relayResponse(res);
  } catch {
    return NextResponse.json({ message: "Error de conexión" }, { status: 500 });
  }
}
