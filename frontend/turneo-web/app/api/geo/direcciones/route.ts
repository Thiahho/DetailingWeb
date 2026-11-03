import { NextResponse, type NextRequest } from "next/server";
import { parseCoords } from "@/src/lib/geo/geo";
import { searchDirecciones } from "@/src/lib/geo/geoServer";
import { geoRateLimit } from "@/src/lib/geo/geoRateLimit";

// GET /api/geo/direcciones?q=&lat=&lng= -> { items: DireccionSuggestion[] } (Photon).
// lat/lng optionally bias results toward the chosen locality; an invalid pair is ignored.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 3) return NextResponse.json({ items: [] });
  const limited = geoRateLimit(req, "direcciones");
  if (limited) return limited;
  try {
    return NextResponse.json({ items: await searchDirecciones(q, parseCoords(params.get("lat"), params.get("lng"))) });
  } catch {
    return NextResponse.json({ items: [], error: "sin-servicio" }, { status: 502 });
  }
}
