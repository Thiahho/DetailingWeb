import { NextRequest, NextResponse } from "next/server";
import { relayResponse } from "@/src/lib/proxyResponse";
import { API_URL } from "@/src/lib/apiUrl";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("platform_token")?.value;

  try {
    const response = await fetch(`${API_URL}/api/platform/plans`, {
      method: "GET",
      headers: { Authorization: token ? `Bearer ${token}` : "" },
      cache: "no-store",
    });
    return await relayResponse(response);
  } catch {
    return NextResponse.json({ message: "Error de conexión" }, { status: 500 });
  }
}
