import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { relayResponse } from "@/src/lib/proxyResponse";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

function getToken(request: NextRequest) {
  return request.cookies.get("admin_token")?.value ?? request.cookies.get("token")?.value ?? "";
}

export async function GET(request: NextRequest) {
  try {
    const res = await fetch(`${API_URL}/api/smart-tags`, {
      headers: { ...tenantHeader(request), Authorization: `Bearer ${getToken(request)}` },
    });
    return await relayResponse(res);
  } catch {
    return NextResponse.json({ message: "Error de conexión" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${API_URL}/api/smart-tags`, {
      method: "POST",
      headers: {
        ...tenantHeader(request),
        Authorization: `Bearer ${getToken(request)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return await relayResponse(res);
  } catch {
    return NextResponse.json({ message: "Error de conexión" }, { status: 500 });
  }
}
