import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { relayResponse } from "@/src/lib/proxyResponse";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${API_URL}/api/reviews/google`, {
      headers: tenantHeader(request),
      next: { revalidate: 3600, tags: ["reviews-google"] },
    });
    return await relayResponse(response);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
