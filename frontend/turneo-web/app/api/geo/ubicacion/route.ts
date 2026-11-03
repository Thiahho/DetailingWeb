import { NextResponse, type NextRequest } from "next/server";
import { resolveMapsUrl } from "@/src/lib/geo/geoServer";
import { geoRateLimit } from "@/src/lib/geo/geoRateLimit";

// GET /api/geo/ubicacion?url= -> { lugar: LugarCaptado } | { error: GeoError }
// 422 link-invalido / sin-coordenadas, 502 sin-servicio, 429 demasiadas-solicitudes.
export async function GET(req: NextRequest) {
  const url = (req.nextUrl.searchParams.get("url") ?? "").trim();
  if (!url || url.length > 2000) return NextResponse.json({ error: "link-invalido" }, { status: 422 });
  const limited = geoRateLimit(req, "ubicacion");
  if (limited) return limited;

  const result = await resolveMapsUrl(url);
  if (typeof result === "string") {
    return NextResponse.json({ error: result }, { status: result === "sin-servicio" ? 502 : 422 });
  }
  return NextResponse.json({ lugar: result });
}
