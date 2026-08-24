import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

export async function GET(request: NextRequest) {
  try {
    const headers = tenantHeader(request);
    const [services, gallery, siteconfig, contentVideos, reviews, googleReviews] = await Promise.all([
      fetch(`${API_URL}/api/services`, { headers, next: { revalidate: 60, tags: ["services"] } }).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch(`${API_URL}/api/gallery`, { headers, next: { revalidate: 60, tags: ["gallery"] } }).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch(`${API_URL}/api/siteconfig`, {
        headers,
        next: { revalidate: 300, tags: ["siteconfig"] },
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_URL}/api/content-videos`, {
        headers,
        next: { revalidate: 60, tags: ["content-videos"] },
      }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_URL}/api/reviews`, { headers, next: { revalidate: 60, tags: ["reviews"] } }).then((r) =>
        r.ok ? r.json() : []
      ),
      // El backend ya cachea 24h contra Google Places — acá un revalidate más
      // largo alcanza sin arriesgar contenido viejo.
      fetch(`${API_URL}/api/reviews/google`, { headers, next: { revalidate: 3600, tags: ["reviews-google"] } }).then(
        (r) => (r.ok ? r.json() : [])
      ),
    ]);

    return NextResponse.json(
      { services, gallery, siteconfig, contentVideos, reviews, googleReviews },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      }
    );
  } catch {
    return NextResponse.json(
      { services: [], gallery: [], siteconfig: null, contentVideos: [], reviews: [], googleReviews: [] },
      { status: 200 }
    );
  }
}
