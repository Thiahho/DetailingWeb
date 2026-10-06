import { getCached, setCached, removeCached } from "@/src/lib/publicDataCache";

export interface SocialLink {
  name: string;
  url: string;
}

export interface SiteConfig {
  id?: number;
  businessName: string;
  whatsAppNumber: string;
  instagramUrl: string;
  instagramHandle: string;
  location: string;
  locationShort: string;
  mapEmbedUrl?: string;
  siteUrl: string;
  logoUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  heroBadge: string;
  heroHighlights: string[];
  // Fotos del local para el bloque "El local" de "Sobre nosotros".
  localPhotos: string[];
  // Redes que carga el admin (nombre libre + link https), en su orden.
  socialLinks: SocialLink[];
  metaDescription: string;
  // Viaja solo en la respuesta cruda de GET /api/siteconfig (no pasa por
  // getSiteConfig() de abajo, que solo whitelistea los campos editables del
  // formulario admin) — true si el plan del tenant no incluye ocultar la
  // marca Turneo del pie de página público.
  hideBranding?: boolean;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  businessName: process.env.NEXT_PUBLIC_BUSINESS_NAME || "Turneo",
  whatsAppNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "",
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "",
  instagramHandle: process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE || "",
  location: process.env.NEXT_PUBLIC_LOCATION || "",
  locationShort: process.env.NEXT_PUBLIC_LOCATION_SHORT || "",
  mapEmbedUrl: "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "",
  logoUrl: "/img/LogoPortada.png",
  heroTitle: "",
  heroSubtitle: "",
  heroBadge: "",
  heroHighlights: [],
  localPhotos: [],
  socialLinks: [],
  metaDescription: process.env.NEXT_PUBLIC_META_DESCRIPTION || "",
};

// La respuesta de la API (o una copia vieja en localStorage) puede no traer el
// campo o traerlo con otra forma: solo pasan items con name y url de texto.
export function parseSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is SocialLink =>
        !!item && typeof item === "object" && typeof item.name === "string" && typeof item.url === "string"
    )
    .map(({ name, url }) => ({ name, url }));
}

// El backend ya garantiza https (SiteConfigController.SanitizeSocialLinks); se
// vuelve a chequear antes de armar un <a href> por si llega una copia cacheada
// o una respuesta con otra forma.
export function isSafeSocialUrl(url: string): boolean {
  return url.startsWith("https://");
}

// Forma corta y legible de un link para mostrarlo como texto:
// "https://www.facebook.com/mi.salon/" => "facebook.com/mi.salon".
export function formatSocialLinkValue(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    return `${hostname.replace(/^www\./i, "")}${pathname}`.replace(/\/+$/, "");
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  }
}

// El admin puede pegar el <iframe> completo que da Google Maps ("Insertar un
// mapa") o directamente una URL. Si no cargó nada, se arma un mapa de mínima
// a partir de la dirección para no dejar la sección vacía. Se valida el host
// contra un allowlist: sin esto, un admin (comprometido o malicioso) podría
// pegar cualquier URL y quedaría embebida en un <iframe> en su propio sitio
// público — además, la CSP (frame-src) solo permite google.com, así que una
// URL de otro origen no cargaría igual, pero validar acá evita que ni
// siquiera se intente.
const ALLOWED_EMBED_HOSTS = ["www.google.com", "google.com"];

function isAllowedEmbedUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && ALLOWED_EMBED_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

export function extractMapEmbedSrc(mapEmbedUrl?: string, location?: string): string {
  const raw = mapEmbedUrl?.trim();
  if (raw) {
    const match = raw.match(/src=["']([^"']+)["']/i);
    const candidate = match ? match[1] : (/^https?:\/\//i.test(raw) ? raw : null);
    if (candidate && isAllowedEmbedUrl(candidate)) return candidate;
  }
  if (location?.trim()) {
    return `https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`;
  }
  return "";
}

let cachedConfig: SiteConfig | null = null;
const SITE_CONFIG_CACHE_KEY = "siteconfig";
const SITE_CONFIG_CACHE_MAX_AGE_MS = 24 * 60 * 60_000;

function buildConfig(data: Record<string, unknown>): SiteConfig {
  return {
    id: data.id as number | undefined,
    businessName: (data.businessName as string) || DEFAULT_SITE_CONFIG.businessName,
    whatsAppNumber: (data.whatsAppNumber as string) || DEFAULT_SITE_CONFIG.whatsAppNumber,
    instagramUrl: (data.instagramUrl as string) || DEFAULT_SITE_CONFIG.instagramUrl,
    instagramHandle: (data.instagramHandle as string) || DEFAULT_SITE_CONFIG.instagramHandle,
    location: (data.location as string) || DEFAULT_SITE_CONFIG.location,
    locationShort: (data.locationShort as string) || DEFAULT_SITE_CONFIG.locationShort,
    mapEmbedUrl: (data.mapEmbedUrl as string) || DEFAULT_SITE_CONFIG.mapEmbedUrl,
    siteUrl: (data.siteUrl as string) || DEFAULT_SITE_CONFIG.siteUrl,
    logoUrl: (data.logoUrl as string) || DEFAULT_SITE_CONFIG.logoUrl,
    heroTitle: (data.heroTitle as string) || DEFAULT_SITE_CONFIG.heroTitle,
    heroSubtitle: (data.heroSubtitle as string) || DEFAULT_SITE_CONFIG.heroSubtitle,
    heroBadge: (data.heroBadge as string) || DEFAULT_SITE_CONFIG.heroBadge,
    heroHighlights: Array.isArray(data.heroHighlights)
      ? (data.heroHighlights as string[])
      : DEFAULT_SITE_CONFIG.heroHighlights,
    localPhotos: Array.isArray(data.localPhotos)
      ? (data.localPhotos as string[])
      : DEFAULT_SITE_CONFIG.localPhotos,
    socialLinks: parseSocialLinks(data.socialLinks),
    metaDescription: (data.metaDescription as string) || DEFAULT_SITE_CONFIG.metaDescription,
  };
}

async function fetchAndCacheConfig(): Promise<SiteConfig | null> {
  try {
    const res = await fetch("/api/siteconfig", { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = await res.json();
    const config = buildConfig(data);
    cachedConfig = config;
    setCached(SITE_CONFIG_CACHE_KEY, config);
    return config;
  } catch {
    return null;
  }
}

// La variable de módulo `cachedConfig` muere en cada recarga completa de
// página (el Navbar y compañía vuelven a mostrar el branding por defecto
// hasta que responde el fetch). Con consentimiento de "preferencias" hay una
// copia persistida en localStorage (src/lib/publicDataCache.ts): si existe,
// se devuelve de inmediato (sin esperar red) y se refresca en segundo plano
// — el Navbar vuelve a llamar a getSiteConfig() en cada montaje, así que la
// próxima vez ya sale de `cachedConfig` con los datos frescos. Sin
// consentimiento, getCached() siempre da null y el comportamiento es el
// mismo de antes (esperar el fetch).
export async function getSiteConfig(): Promise<SiteConfig> {
  if (cachedConfig) return cachedConfig;

  const persisted = getCached<SiteConfig>(SITE_CONFIG_CACHE_KEY, SITE_CONFIG_CACHE_MAX_AGE_MS);
  if (persisted) {
    cachedConfig = persisted;
    fetchAndCacheConfig();
    return persisted;
  }

  const fresh = await fetchAndCacheConfig();
  return fresh ?? DEFAULT_SITE_CONFIG;
}

export function clearSiteConfigCache() {
  cachedConfig = null;
  removeCached(SITE_CONFIG_CACHE_KEY);
}

export function getWhatsAppLink(number: string, message?: string): string {
  const clean = number.replace(/\D/g, "");
  const encoded = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${clean}${encoded}`;
}
