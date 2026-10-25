import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { readBackendBody } from "@/src/lib/proxyResponse";
import { API_URL } from "@/src/lib/apiUrl";

// Always answers 200 with an array: the reviews widget is decorative, so any
// backend failure (error status, empty or non-JSON body) degrades to no reviews
// instead of relaying an error object to a caller that expects a list.
export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${API_URL}/api/reviews/google`, {
      headers: tenantHeader(request),
      next: { revalidate: 3600, tags: ["reviews-google"] },
    });
    const data = response.ok ? await readBackendBody(response) : null;
    return NextResponse.json(Array.isArray(data) ? data : [], { status: 200 });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
