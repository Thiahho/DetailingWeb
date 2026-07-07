import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

export async function GET(request: NextRequest) {
  try {
    const headers = tenantHeader(request);
    const [services, gallery, siteconfig, contentVideos] = await Promise.all([
      fetch(`${API_URL}/api/services`, { headers, next: { revalidate: 60 } }).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch(`${API_URL}/api/gallery`, { headers, next: { revalidate: 60 } }).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch(`${API_URL}/api/siteconfig`, {
        headers,
        next: { revalidate: 300 },
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_URL}/api/content-videos`, {
        headers,
        next: { revalidate: 60 },
      }).then((r) => (r.ok ? r.json() : [])),
    ]);

    return NextResponse.json(
      { services, gallery, siteconfig, contentVideos },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      }
    );
  } catch {
    return NextResponse.json(
      { services: [], gallery: [], siteconfig: null, contentVideos: [] },
      { status: 200 }
    );
  }
}
