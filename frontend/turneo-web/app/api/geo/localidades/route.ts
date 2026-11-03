import { NextResponse, type NextRequest } from "next/server";
import { searchLocalidades } from "@/src/lib/geo/geoServer";
import { geoRateLimit } from "@/src/lib/geo/geoRateLimit";

// GET /api/geo/localidades?q= -> { items: LocalidadSuggestion[] } (Georef, all of Argentina).
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ items: [] });
  const limited = geoRateLimit(req, "localidades");
  if (limited) return limited;
  try {
    return NextResponse.json({ items: await searchLocalidades(q) });
  } catch {
    return NextResponse.json({ items: [], error: "sin-servicio" }, { status: 502 });
  }
}
