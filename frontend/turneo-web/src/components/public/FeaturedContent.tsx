"use client";

import { useEffect, useRef, useState } from "react";
import { Instagram, Music2 } from "lucide-react";
import {
  PREVIEW_SECONDS,
  SOCIAL_LABEL,
  socialPlatform,
  videoPosterUrl,
  videoPreviewUrl,
} from "@/src/lib/cloudinaryMedia";

export interface FeaturedVideo {
  id: number;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  linkUrl?: string | null;
}

// Preview de un contenido: al cargar la página solo baja la portada (imagen).
// El clip de 5 s se pide y reproduce recién cuando la card entra en pantalla, y
// se desmonta al salir — así una sección con varios videos no pesa en la carga.
// Con "reducir movimiento" o ahorro de datos queda solo la portada.
export function VideoPreview({ video, className = "" }: { video: FeaturedVideo; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const poster = video.thumbnailUrl || videoPosterUrl(video.videoUrl);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reducedMotion || saveData) return;

    const observer = new IntersectionObserver(([entry]) => setPlaying(entry.isIntersecting), { threshold: 0.6 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`absolute inset-0 ${className}`}>
      {poster && (
        <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {playing && (
        <video
          src={videoPreviewUrl(video.videoUrl)}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          // El recorte ya viene hecho desde Cloudinary; esto cubre videos
          // alojados en otro origen, donde la URL no se puede transformar.
          onTimeUpdate={(e) => {
            if (e.currentTarget.currentTime >= PREVIEW_SECONDS) e.currentTarget.currentTime = 0;
          }}
        />
      )}
    </div>
  );
}

export function PlatformIcon({ platform, size = 14 }: { platform: "instagram" | "tiktok"; size?: number }) {
  // lucide no trae ícono de TikTok: se usa la nota musical como referencia.
  return platform === "instagram" ? <Instagram size={size} /> : <Music2 size={size} />;
}

const CARD =
  "group relative block aspect-[9/16] w-40 overflow-hidden rounded-3xl bg-inksoft sm:w-52";

interface FeaturedContentProps {
  videos: FeaturedVideo[];
  // Perfil del negocio (SiteConfig.instagramUrl): destino de los videos que no
  // tienen un posteo propio cargado, para que la card igual lleve a la cuenta.
  profileUrl?: string;
}

// Fila deslizable de reels (previews de 5 s que llevan al posteo en
// Instagram/TikTok). Solo la fila: el encabezado lo pone WorkSection.
export default function FeaturedContent({ videos, profileUrl }: FeaturedContentProps) {
  if (videos.length === 0) return null;

  return (
    <div className="snap-row gap-4 px-6 pb-2 [scroll-padding-left:1.5rem] lg:px-[calc((100vw-72rem)/2+1.5rem)] lg:[scroll-padding-left:calc((100vw-72rem)/2+1.5rem)]">
      {videos.map((video) => {
        // Solo se linkea a una red soportada (misma validación que el
        // backend): nunca se arma un href con un valor arbitrario.
        const postPlatform = socialPlatform(video.linkUrl);
        const href = postPlatform ? video.linkUrl! : socialPlatform(profileUrl) ? profileUrl! : null;
        const platform = postPlatform ?? socialPlatform(profileUrl);
        const cta = !platform
          ? ""
          : postPlatform
            ? `Ver publicación en ${SOCIAL_LABEL[platform]}`
            : `Ver nuestro ${SOCIAL_LABEL[platform]}`;

        const inner = (
          <>
            <VideoPreview
              video={video}
              className="transition-transform duration-700 ease-out [@media(hover:hover)]:group-hover:scale-105"
            />
            <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-semibold text-cream">
              Preview {PREVIEW_SECONDS} s
            </span>
            {(video.title || platform) && (
              <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 space-y-1 rounded-2xl bg-cream px-3 py-2.5 text-charcoal">
                {video.title && <p className="line-clamp-2 text-xs font-semibold">{video.title}</p>}
                {platform && (
                  <span
                    data-testid="featured-content-cta"
                    className="flex items-center gap-1.5 text-[11px] font-semibold leading-none text-rosewood"
                  >
                    <PlatformIcon platform={platform} size={13} />
                    {cta} →
                  </span>
                )}
              </div>
            )}
          </>
        );

        return href && platform ? (
          <a
            key={video.id}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="featured-content-card"
            aria-label={`${video.title || "Contenido"} — ${cta}`}
            className={`${CARD} focus:outline-none focus-visible:ring-2 focus-visible:ring-blush`}
          >
            {inner}
          </a>
        ) : (
          <div key={video.id} data-testid="featured-content-card" className={CARD}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
