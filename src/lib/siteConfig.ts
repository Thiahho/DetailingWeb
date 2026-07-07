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
  metaDescription: string;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  businessName: process.env.NEXT_PUBLIC_BUSINESS_NAME || "TTurnos",
  whatsAppNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "",
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "",
  instagramHandle: process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE || "",
  location: process.env.NEXT_PUBLIC_LOCATION || "",
  locationShort: process.env.NEXT_PUBLIC_LOCATION_SHORT || "",
  mapEmbedUrl: "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "",
  logoUrl: "/img/logo.png",
  heroTitle: "",
  heroSubtitle: "",
  heroBadge: "",
  metaDescription: process.env.NEXT_PUBLIC_META_DESCRIPTION || "",
};

// El admin puede pegar el <iframe> completo que da Google Maps ("Insertar un
// mapa") o directamente una URL. Si no cargó nada, se arma un mapa de mínima
// a partir de la dirección para no dejar la sección vacía.
export function extractMapEmbedSrc(mapEmbedUrl?: string, location?: string): string {
  const raw = mapEmbedUrl?.trim();
  if (raw) {
    const match = raw.match(/src=["']([^"']+)["']/i);
    if (match) return match[1];
    if (/^https?:\/\//i.test(raw)) return raw;
  }
  if (location?.trim()) {
    return `https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`;
  }
  return "";
}

let cachedConfig: SiteConfig | null = null;

export async function getSiteConfig(): Promise<SiteConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await fetch("/api/siteconfig", { next: { revalidate: 300 } });
    if (!res.ok) return DEFAULT_SITE_CONFIG;
    const data = await res.json();
    cachedConfig = {
      id: data.id,
      businessName: data.businessName || DEFAULT_SITE_CONFIG.businessName,
      whatsAppNumber: data.whatsAppNumber || DEFAULT_SITE_CONFIG.whatsAppNumber,
      instagramUrl: data.instagramUrl || DEFAULT_SITE_CONFIG.instagramUrl,
      instagramHandle: data.instagramHandle || DEFAULT_SITE_CONFIG.instagramHandle,
      location: data.location || DEFAULT_SITE_CONFIG.location,
      locationShort: data.locationShort || DEFAULT_SITE_CONFIG.locationShort,
      mapEmbedUrl: data.mapEmbedUrl || DEFAULT_SITE_CONFIG.mapEmbedUrl,
      siteUrl: data.siteUrl || DEFAULT_SITE_CONFIG.siteUrl,
      logoUrl: data.logoUrl || DEFAULT_SITE_CONFIG.logoUrl,
      heroTitle: data.heroTitle || DEFAULT_SITE_CONFIG.heroTitle,
      heroSubtitle: data.heroSubtitle || DEFAULT_SITE_CONFIG.heroSubtitle,
      heroBadge: data.heroBadge || DEFAULT_SITE_CONFIG.heroBadge,
      metaDescription: data.metaDescription || DEFAULT_SITE_CONFIG.metaDescription,
    };
    return cachedConfig;
  } catch {
    return DEFAULT_SITE_CONFIG;
  }
}

export function clearSiteConfigCache() {
  cachedConfig = null;
}

export function getWhatsAppLink(number: string, message?: string): string {
  const clean = number.replace(/\D/g, "");
  const encoded = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${clean}${encoded}`;
}
