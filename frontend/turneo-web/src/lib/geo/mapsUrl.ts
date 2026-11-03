// Google Maps link parsing (ported from AccFenix lib/maps-url.ts).
import type { Coords } from "@/src/lib/geo/geo";

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
const PIN = new RegExp(`!3d${NUM}!4d${NUM}`);
const AT = new RegExp(`@${NUM},${NUM}`);
const PATH = new RegExp(`/(?:place|search|dir)/${NUM},\\+?${NUM}`);
const PAIR = new RegExp(`^\\s*${NUM}\\s*,\\s*${NUM}\\s*$`);
const COORD_PARAMS = ["q", "query", "ll", "destination", "daddr", "center", "viewpoint"];

const SHORT_HOSTS = ["maps.app.goo.gl", "goo.gl"];
const GOOGLE_HOST = /(^|\.)google\.(com|com\.ar)$/;

function toUrl(text: string): URL | null {
  try {
    const url = new URL(text.trim());
    // Explicit ports are never valid Maps links (default ports are normalized to "" by URL).
    return (url.protocol === "https:" || url.protocol === "http:") && url.port === "" ? url : null;
  } catch {
    return null;
  }
}

/** Google host a redirect may be followed to (short links included). Guards the server-side redirect walk (SSRF). */
export function isGoogleHost(hostname: string) {
  return SHORT_HOSTS.includes(hostname) || GOOGLE_HOST.test(hostname);
}

export function isShortMapsUrl(text: string) {
  const url = toUrl(text);
  return !!url && SHORT_HOSTS.includes(url.hostname) && (url.hostname !== "goo.gl" || url.pathname.startsWith("/maps"));
}

export function isMapsUrl(text: string) {
  const url = toUrl(text);
  if (!url) return false;
  if (isShortMapsUrl(text)) return true;
  return GOOGLE_HOST.test(url.hostname) && (url.hostname.startsWith("maps.") || url.pathname.startsWith("/maps"));
}

function coords(lat: string, lng: string): Coords | null {
  const c = { lat: Number(lat), lng: Number(lng) };
  const valid = Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180 && !(c.lat === 0 && c.lng === 0);
  return valid ? c : null;
}

/**
 * Coordinates of a Google Maps link. Prefers the place pin (!3d...!4d...) over the view center
 * (@lat,lng), which is also what Street View links carry.
 */
export function parseMapsUrl(text: string): Coords | null {
  const url = toUrl(text);
  if (!url || !isMapsUrl(text)) return null;

  let path = url.pathname;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    // Path with stray % signs: use it as is.
  }

  const pin = url.href.match(PIN) ?? path.match(AT);
  if (pin) return coords(pin[1], pin[2]);

  for (const name of COORD_PARAMS) {
    const pair = url.searchParams.get(name)?.match(PAIR);
    if (pair) return coords(pair[1], pair[2]);
  }

  const inPath = path.match(PATH);
  return inPath ? coords(inPath[1], inPath[2]) : null;
}

export function mapsLink({ lat, lng }: Coords) {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
