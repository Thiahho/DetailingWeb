// Location types and normalizers (ported from AccFenix). The browser only talks to /api/geo/*;
// the providers (Georef, Photon, Nominatim) are called from the server (see geoServer.ts).
// Field names (nombre, partido, calle...) are the public response contract of /api/geo/*.

export type Coords = { lat: number; lng: number };

/** `id` is the Georef locality id (null when Georef does not send it). */
export type LocalidadSuggestion = Coords & { id: string | null; nombre: string; partido: string; provincia: string };

/** `exacta` means the point is a house number, not the whole street. */
export type DireccionSuggestion = Coords & { calle: string; altura?: string; localidad: string; partido: string; exacta: boolean };

export type LugarCaptado = Coords & {
  direccion: string;
  tieneAltura: boolean;
  localidad: string;
  partido: string;
  provincia: string;
  /** Inside the Buenos Aires zone (Buenos Aires province or CABA). */
  enZona: boolean;
};

/** `demasiadas-solicitudes` is returned with HTTP 429 by the per-IP rate limit. */
export type GeoError = "link-invalido" | "sin-coordenadas" | "sin-servicio" | "demasiadas-solicitudes";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

type GeorefLocalidad = {
  id?: string;
  nombre?: string;
  departamento?: { nombre?: string };
  provincia?: { nombre?: string };
  centroide?: { lat?: number; lon?: number };
};

/**
 * Georef repeats localities (entity and census locality): they are deduplicated by name and partido
 * within a province, so same-name localities of different provinces are all kept.
 */
export function localidadesFromGeoref(localidades: GeorefLocalidad[], max = 8): LocalidadSuggestion[] {
  const seen = new Set<string>();
  const out: LocalidadSuggestion[] = [];
  for (const l of localidades) {
    const nombre = l.nombre?.trim();
    const { lat, lon } = l.centroide ?? {};
    if (!nombre || typeof lat !== "number" || typeof lon !== "number") continue;
    const partido = l.departamento?.nombre ?? "";
    const provincia = l.provincia?.nombre ?? "";
    const key = fold(`${nombre}|${partido}|${provincia}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: l.id?.trim() || null, nombre, partido, provincia, lat, lng: lon });
    if (out.length === max) break;
  }
  return out;
}

type PhotonFeature = {
  properties?: {
    type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    locality?: string;
    county?: string;
    state?: string;
    countrycode?: string;
  };
  geometry?: { coordinates?: [number, number] };
};

/** Photon streets and house numbers in Argentina, without duplicates. */
export function direccionesFromPhoton(features: PhotonFeature[], max = 6): DireccionSuggestion[] {
  const seen = new Set<string>();
  const out: DireccionSuggestion[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (p.countrycode !== "AR") continue;
    if (p.type !== "street" && p.type !== "house") continue;
    const exacta = p.type === "house";
    const calle = (exacta ? p.street : p.name)?.trim();
    if (!calle || typeof lat !== "number" || typeof lng !== "number") continue;
    if (exacta && !p.housenumber) continue;
    const localidad = p.city ?? p.district ?? p.locality ?? "";
    const key = fold(`${calle}|${p.housenumber ?? ""}|${localidad}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ calle, altura: exacta ? p.housenumber : undefined, localidad, partido: p.county ?? "", exacta, lat, lng });
    if (out.length === max) break;
  }
  return out;
}

/** Keeps suggestions whose street contains every typed word (ignoring the house number); if none match, returns all. */
export function filtrarPorCalle(items: DireccionSuggestion[], query: string): DireccionSuggestion[] {
  const words = fold(query)
    .replace(/\s+\d{1,5}$/, "")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  const matches = items.filter((i) => words.every((w) => fold(i.calle).includes(w)));
  return matches.length > 0 ? matches : items;
}

type NominatimReverse = {
  address?: {
    road?: string;
    pedestrian?: string;
    house_number?: string;
    town?: string;
    city?: string;
    village?: string;
    suburb?: string;
    state_district?: string;
    state?: string;
    "ISO3166-2-lvl4"?: string;
  };
};

/** Builds the place to confirm from a Nominatim reverse response; keeps the original point from the link. */
export function lugarFromNominatim(json: NominatimReverse, coords: Coords): LugarCaptado {
  const a = json.address ?? {};
  const iso = a["ISO3166-2-lvl4"];
  const caba = iso === "AR-C";
  const calle = a.road ?? a.pedestrian ?? "";
  return {
    ...coords,
    direccion: [calle, a.house_number].filter(Boolean).join(" "),
    tieneAltura: Boolean(calle && a.house_number),
    // In CABA "city" is the whole city; the barrio (suburb) is the useful locality.
    localidad: (caba ? (a.suburb ?? a.city) : (a.town ?? a.city ?? a.village ?? a.suburb)) ?? "",
    partido: a.state_district ?? "",
    provincia: a.state ?? (caba ? "Ciudad Autónoma de Buenos Aires" : ""),
    enZona: iso === "AR-B" || caba,
  };
}

/** House number typed at the end of the query ("agustina de aragon 520" -> "520"), unless it is part of the chosen street name. */
export function alturaEscrita(query: string, calle: string): string | undefined {
  const altura = query.trim().match(/\D\s+(\d{1,5})$/)?.[1];
  if (!altura) return undefined;
  return fold(calle).split(/\s+/).includes(altura) ? undefined : altura;
}

/**
 * Optional `lat`/`lng` bias of /api/geo/direcciones. Returns null when either value is missing,
 * blank, non-numeric or out of range (an invalid bias is ignored, not rejected, as in AccFenix).
 */
export function parseCoords(lat: string | null, lng: string | null): Coords | null {
  if (lat === null || lng === null || lat.trim() === "" || lng.trim() === "") return null;
  const c = { lat: Number(lat), lng: Number(lng) };
  const valid = Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180;
  return valid ? c : null;
}

// Client helpers for the booking UI. On HTTP errors (429/502) the JSON body of the list endpoints
// still carries `items: []` (plus `error`), so suggestions simply come back empty.
async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal });
  return (await res.json()) as T;
}

export async function fetchLocalidades(q: string, signal?: AbortSignal) {
  return (await getJson<{ items: LocalidadSuggestion[] }>(`/api/geo/localidades?q=${encodeURIComponent(q)}`, signal)).items;
}

export async function fetchDirecciones(q: string, near: Coords | null, signal?: AbortSignal) {
  const bias = near ? `&lat=${near.lat}&lng=${near.lng}` : "";
  return (await getJson<{ items: DireccionSuggestion[] }>(`/api/geo/direcciones?q=${encodeURIComponent(q)}${bias}`, signal)).items;
}

export async function fetchUbicacion(url: string): Promise<{ lugar: LugarCaptado } | { error: GeoError; message?: string }> {
  try {
    return await getJson(`/api/geo/ubicacion?url=${encodeURIComponent(url)}`);
  } catch {
    return { error: "sin-servicio" };
  }
}
