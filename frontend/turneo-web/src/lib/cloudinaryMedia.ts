// Helpers para pedirle a Cloudinary versiones livianas de lo que se subió en
// tamaño original, insertando la transformación en la URL de entrega (no hace
// falta volver a subir nada). URLs de otro origen se devuelven sin tocar.

export function withTransform(url: string, transform: string, resource: "image" | "video" = "image"): string {
  const marker = `/${resource}/upload/`;
  if (!url.includes("res.cloudinary.com") || !url.includes(marker)) return url;
  return url.replace(marker, `${marker}${transform}/`);
}

export const PREVIEW_SECONDS = 5;

// Clip corto, angosto y sin audio: es lo único de video que baja el sitio público.
export function videoPreviewUrl(url: string): string {
  return withTransform(url, `du_${PREVIEW_SECONDS},w_480,c_limit,q_auto,ac_none`, "video");
}

// Primer frame del mismo video como imagen (Cloudinary lo genera cambiando la
// extensión): evita pedirle al dueño que suba una portada aparte.
export function videoPosterUrl(url: string): string {
  const transformed = withTransform(url, "so_0,w_480,c_limit,q_auto,f_auto", "video");
  return transformed === url ? "" : transformed.replace(/\.\w+$/, ".jpg");
}

export type SocialPlatform = "instagram" | "tiktok";

export const SOCIAL_LABEL: Record<SocialPlatform, string> = { instagram: "Instagram", tiktok: "TikTok" };

// Mismo allowlist que valida el backend (ContentVideosController).
export function socialPlatform(url?: string | null): SocialPlatform | null {
  if (!url) return null;
  try {
    const { protocol, hostname } = new URL(url.trim());
    if (protocol !== "https:") return null;
    const host = hostname.toLowerCase();
    if (host === "instagram.com" || host === "www.instagram.com") return "instagram";
    if (["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"].includes(host)) return "tiktok";
    return null;
  } catch {
    return null;
  }
}
