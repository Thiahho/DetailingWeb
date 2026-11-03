// Server-side geo providers (ported from AccFenix lib/geo-server.ts). Only imported by the
// app/api/geo/* route handlers; never import it from a client component.
import {
  direccionesFromPhoton,
  filtrarPorCalle,
  localidadesFromGeoref,
  lugarFromNominatim,
  type Coords,
  type DireccionSuggestion,
  type GeoError,
  type LocalidadSuggestion,
  type LugarCaptado,
} from "@/src/lib/geo/geo";
import { isGoogleHost, isMapsUrl, parseMapsUrl } from "@/src/lib/geo/mapsUrl";
import { createMemoryCache } from "@/src/lib/geo/memoryCache";
import { createThrottle } from "@/src/lib/geo/throttle";

const GEOREF = "https://apis.datos.gob.ar/georef/api";
const PHOTON = "https://photon.komoot.io/api";
const NOMINATIM = "https://nominatim.openstreetmap.org";

// Nominatim requires an identifying User-Agent. Same source as DEFAULT_SITE_CONFIG.siteUrl
// (src/lib/siteConfig.ts): the platform URL, no personal contact data.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://turneo.app";
const HEADERS = { "User-Agent": `Turneo/1.0 (+${SITE_URL})`, Accept: "application/json" };
const TIMEOUT_MS = 5000;
const DAY_SECONDS = 60 * 60 * 24;
// Buenos Aires province + CABA: min lon, min lat, max lon, max lat.
const BBOX = "-63.4,-41.1,-56.6,-33.2";
const MAX_REDIRECTS = 5;

// Nominatim allows at most 1 request per second. Per server instance (see throttle.ts): calls
// are spaced 1 s apart and a call that would wait more than 3 s fails fast as "sin-servicio".
const nominatimThrottle = createThrottle({ intervalMs: 1000, maxWaitMs: 3000 });
// Identical reverse lookups are answered from memory, without spending the 1 req/s budget.
const nominatimCache = createMemoryCache<unknown>({ ttlMs: DAY_SECONDS * 1000, maxEntries: 500 });

async function getJson<T>(url: string, revalidate: number): Promise<T> {
  // `next.revalidate` uses the Next.js data cache, so identical Georef/Photon queries are cached for a day.
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate } });
  if (!res.ok) throw new Error(`${new URL(url).hostname} responded ${res.status}`);
  return (await res.json()) as T;
}

/** Localities of Buenos Aires province (06) and CABA (02) matching the query. */
export async function searchLocalidades(q: string): Promise<LocalidadSuggestion[]> {
  const query = (provincia: string) =>
    getJson<{ localidades: Parameters<typeof localidadesFromGeoref>[0] }>(
      `${GEOREF}/localidades?nombre=${encodeURIComponent(q)}&provincia=${provincia}&campos=nombre,departamento.nombre,provincia.nombre,centroide&max=10`,
      DAY_SECONDS,
    );
  const results = await Promise.allSettled([query("06"), query("02")]);
  if (results.every((r) => r.status === "rejected")) throw new Error("Georef unavailable");
  return localidadesFromGeoref(results.flatMap((r) => (r.status === "fulfilled" ? r.value.localidades : [])));
}

/** Streets and addresses while typing, biased toward `near` (the center of the chosen locality). */
export async function searchDirecciones(q: string, near: Coords | null): Promise<DireccionSuggestion[]> {
  const bias = near ? `&lat=${near.lat}&lon=${near.lng}` : "";
  const query = async (text: string) => {
    const { features } = await getJson<{ features: Parameters<typeof direccionesFromPhoton>[0] }>(
      `${PHOTON}?q=${encodeURIComponent(text)}&limit=15&bbox=${BBOX}${bias}`,
      DAY_SECONDS,
    );
    // With a house number, Photon adds houses of other streets that only share the number.
    return filtrarPorCalle(direccionesFromPhoton(features, 15), q).slice(0, 6);
  };
  const items = await query(q);
  if (items.length > 0) return items;
  // With the house number included there are sometimes no matches: retry with the street only.
  const sinAltura = q.replace(/\s+\d{1,5}\s*$/, "");
  return sinAltura !== q && sinAltura.length >= 3 ? query(sinAltura) : items;
}

/** Follows short links until coordinates show up, never leaving Google hosts over HTTPS (SSRF guard). */
async function resolveCoords(text: string): Promise<Coords | GeoError> {
  if (!isMapsUrl(text)) return "link-invalido";
  let url = new URL(text.trim());
  url.protocol = "https:";

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const coords = parseMapsUrl(url.href);
    if (coords) return coords;

    let res: Response;
    try {
      res = await fetch(url, { redirect: "manual", headers: { "User-Agent": HEADERS["User-Agent"] }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    } catch {
      return "sin-servicio";
    }
    void res.body?.cancel();
    const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!location) return "sin-coordenadas";

    const next = new URL(location, url);
    // Only HTTPS, default port, Google hosts: anything else stops the walk.
    if (next.protocol !== "https:" || next.port !== "" || !isGoogleHost(next.hostname)) return "sin-coordenadas";
    url = next;
  }
  return "sin-coordenadas";
}

/** Turns a Google Maps link into a place with an address for the client to confirm. */
export async function resolveMapsUrl(text: string): Promise<LugarCaptado | GeoError> {
  const coords = await resolveCoords(text);
  if (typeof coords === "string") return coords;
  const url = `${NOMINATIM}/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}&zoom=18&addressdetails=1&accept-language=es`;
  try {
    const json = await nominatimCache.getOrLoad(url, () => nominatimThrottle(() => getJson(url, DAY_SECONDS)));
    return lugarFromNominatim(json as Parameters<typeof lugarFromNominatim>[0], coords);
  } catch {
    // Provider down, timeout, or the throttle queue is full (ThrottleBusyError).
    return "sin-servicio";
  }
}
