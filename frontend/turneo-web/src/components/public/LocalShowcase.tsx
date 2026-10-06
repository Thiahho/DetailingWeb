"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { extractMapEmbedSrc, getWhatsAppLink } from "@/src/lib/siteConfig";
import { withTransform } from "@/src/lib/cloudinaryMedia";

type Step = "local" | "ubicacion";

const STEP_LABEL: Record<Step, string> = { local: "El local", ubicacion: "Cómo llegar" };
const NEXT_LABEL: Record<Step, string> = {
  local: "Volver a las fotos",
  ubicacion: "Ver dónde queda y cómo llegar",
};

// Caja de la foto (en % del escenario): a pantalla completa en "local" y, al
// pasar al mapa, se contrae hacia el centro hasta desaparecer — ahí queda el
// marcador del propio mapa (el embed de Google lo centra en el iframe) como
// único indicador.
const PHOTO_FULL = { left: "0%", top: "0%", width: "100%", height: "100%" };
const PHOTO_AT_PIN = { left: "50%", top: "50%", width: "0%", height: "0%" };

type RouteState =
  | { status: "idle" | "loading" | "denied" | "unavailable" }
  | { status: "ready"; origin: string };

const WHEEL_THRESHOLD_PX = 40;
const WHEEL_LOCK_MS = 750; // traga la inercia del trackpad: un gesto = un paso
const SWIPE_THRESHOLD_PX = 48;

const thumb = (url: string) => withTransform(url, "c_fill,w_160,h_120,q_auto,f_auto");
const full = (url: string) => withTransform(url, "c_limit,w_1400,q_auto,f_auto");

interface LocalShowcaseProps {
  photos: string[];
  businessName: string;
  location?: string;
  mapEmbedUrl?: string;
  whatsAppNumber?: string;
}

// Bloque "El local": un solo escenario donde la foto y el mapa son la misma
// pieza. Se recorre en dos pasos (El local → Cómo llegar) con las pestañas,
// con la rueda/trackpad sobre la card o deslizando hacia los costados en
// mobile. En el primer y último paso el scroll sigue moviendo la página.
export default function LocalShowcase({
  photos,
  businessName,
  location,
  mapEmbedUrl,
  whatsAppNumber,
}: LocalShowcaseProps) {
  const hasPhotos = photos.length > 0;
  const steps: Step[] = [...(hasPhotos ? (["local"] as Step[]) : []), ...(location ? (["ubicacion"] as Step[]) : [])];

  const [index, setIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const [route, setRoute] = useState<RouteState>({ status: "idle" });

  // El permiso de ubicación se pide solo cuando el visitante toca el botón (no
  // al entrar al paso). Las coordenadas no salen del navegador salvo en la URL
  // de Google Maps que arma la ruta: no se mandan ni se guardan en el backend.
  const requestRoute = () => {
    if (!("geolocation" in navigator)) {
      setRoute({ status: "unavailable" });
      return;
    }
    setRoute({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setRoute({ status: "ready", origin: `${pos.coords.latitude},${pos.coords.longitude}` }),
      (err) => setRoute({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  };

  const stepCount = steps.length;
  const current = Math.min(index, stepCount - 1);
  const step = steps[current];
  const photo = photos[Math.min(photoIndex, photos.length - 1)];

  // Listener nativo y no pasivo: el onWheel de React es pasivo y no deja
  // frenar el scroll de la página mientras se cambia de paso.
  const currentRef = useRef(current);
  currentRef.current = current;
  useEffect(() => {
    const card = cardRef.current;
    if (!card || stepCount < 2) return;
    let acc = 0;
    let lockUntil = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      const now = Date.now();
      if (now < lockUntil) {
        e.preventDefault();
        return;
      }
      const next = currentRef.current + (e.deltaY > 0 ? 1 : -1);
      if (next < 0 || next >= stepCount) {
        acc = 0;
        return;
      }
      e.preventDefault();
      acc += e.deltaY;
      if (Math.abs(acc) < WHEEL_THRESHOLD_PX) return;
      acc = 0;
      lockUntil = now + WHEEL_LOCK_MS;
      setIndex(next);
    };
    card.addEventListener("wheel", onWheel, { passive: false });
    return () => card.removeEventListener("wheel", onWheel);
  }, [stepCount]);

  if (stepCount === 0) return null;

  const onTouchStart = (e: TouchEvent) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const next = current + (dx < 0 ? 1 : -1);
    if (next >= 0 && next < stepCount) setIndex(next);
  };

  const origin = route.status === "ready" ? route.origin : null;
  const mapsLink = !location
    ? ""
    : origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${encodeURIComponent(location)}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`;
  // Con la ubicación del visitante, el mismo embed pasa de mostrar el marcador
  // del local a mostrar el recorrido hasta él.
  const mapSrc =
    location && origin
      ? `https://www.google.com/maps?saddr=${origin}&daddr=${encodeURIComponent(location)}&output=embed`
      : extractMapEmbedSrc(mapEmbedUrl, location);
  const nextStep = steps[(current + 1) % stepCount];
  const onPhoto = step === "local";
  const overlayUi = `transition-opacity duration-300 ${onPhoto ? "opacity-100" : "pointer-events-none opacity-0"}`;

  return (
    <div
      ref={cardRef}
      data-testid="local-showcase"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="glass-card flex flex-col gap-6 p-4 md:flex-row md:items-center md:gap-10 md:p-5"
    >
      {/* Escenario */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-mauve/20 bg-porcelain md:flex-[1.35]">
        {location && (
          <>
            <iframe
              src={mapSrc}
              className="absolute inset-0 h-full w-full"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ubicación del local en el mapa"
              tabIndex={-1}
            />
            {/* El mapa acá es una vista, no un control: esta capa evita que el
                iframe se quede con la rueda/el dedo (cortaría el recorrido por
                pasos). El mapa interactivo sigue en Contacto y en "Cómo llegar". */}
            <div className="absolute inset-0" aria-hidden="true" />
          </>
        )}

        {hasPhotos && (
          <div
            data-testid="local-photos"
            style={onPhoto ? PHOTO_FULL : PHOTO_AT_PIN}
            aria-hidden={!onPhoto}
            className={`absolute overflow-hidden bg-porcelain transition-all duration-700 ease-[cubic-bezier(0.6,0,0.2,1)] motion-reduce:transition-none ${
              onPhoto ? "rounded-none opacity-100" : "rounded-full opacity-0"
            }`}
          >
            <img
              src={full(photo)}
              alt={`${businessName} — foto ${photoIndex + 1} del local`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {photos.length > 1 && (
          <div className={`absolute bottom-3 left-3 flex gap-2 ${overlayUi}`}>
            {photos.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setPhotoIndex(i)}
                tabIndex={onPhoto ? 0 : -1}
                aria-label={`Ver foto ${i + 1} del local`}
                aria-pressed={i === photoIndex}
                className={`h-11 w-14 overflow-hidden rounded-lg border-2 border-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blush ${
                  i === photoIndex ? "ring-2 ring-blushdark" : "opacity-80 shadow-soft hover:opacity-100"
                }`}
              >
                <img src={thumb(url)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {hasPhotos && location && (
          <button
            type="button"
            onClick={() => setIndex(steps.indexOf("ubicacion"))}
            tabIndex={onPhoto ? 0 : -1}
            className={`absolute bottom-3 right-3 flex min-h-[44px] items-center gap-2 rounded-full border border-mauve/20 bg-white px-4 text-xs font-semibold text-charcoal shadow-soft ${overlayUi}`}
          >
            <MapPin size={16} className="text-blushdark" />
            Ver en el mapa
          </button>
        )}

        {stepCount > 1 && (
          <div
            aria-hidden="true"
            className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-1.5 rounded-full border border-mauve/20 bg-white/90 px-1.5 py-2"
          >
            {steps.map((s, i) => (
              <span
                key={s}
                className={`w-1.5 rounded-full transition-all duration-500 ${
                  i === current ? "h-5 bg-blushdark" : "h-1.5 bg-mauve/30"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Panel */}
      <div className="flex flex-col items-start gap-5 px-1 pb-2 md:flex-1 md:px-0 md:pb-0 md:pr-3">
        {stepCount > 1 && (
          <div className="flex flex-wrap gap-1 rounded-full bg-cream p-1">
            {steps.map((s, i) => (
              <button
                key={s}
                type="button"
                data-testid={`local-step-${s}`}
                onClick={() => setIndex(i)}
                aria-pressed={i === current}
                className={`min-h-[44px] rounded-full px-4 text-xs font-semibold transition-colors duration-300 ${
                  i === current ? "bg-charcoal text-white" : "text-charcoal/70 hover:text-charcoal"
                }`}
              >
                {STEP_LABEL[s]}
              </button>
            ))}
          </div>
        )}

        <div aria-live="polite" className="space-y-3">
          {step === "local" && (
            <>
              <span className="text-xs font-semibold uppercase tracking-widest text-blushdark">El espacio</span>
              <h4 className="text-2xl font-semibold leading-snug text-charcoal">
                Así es el lugar donde te recibimos
              </h4>
              <p className="text-sm leading-relaxed text-charcoal/70">
                Conocé {businessName} por dentro antes de venir.
              </p>
            </>
          )}
          {step === "ubicacion" && (
            <>
              <span className="text-xs font-semibold uppercase tracking-widest text-blushdark">Dónde estamos</span>
              <h4 className="text-2xl font-semibold leading-snug text-charcoal">{location}</h4>
              <p data-testid="local-route-status" className="text-sm leading-relaxed text-charcoal/70">
                {route.status === "ready"
                  ? "Listo: el mapa muestra el recorrido desde donde estás hasta el local."
                  : route.status === "denied"
                    ? "No tenemos permiso para ver tu ubicación. Podés habilitarlo en el navegador o abrir Maps y elegir tu punto de partida."
                    : route.status === "unavailable"
                      ? "No pudimos obtener tu ubicación. Abrí Maps y elegí tu punto de partida."
                      : "El marcador señala el local. Compartí tu ubicación y te mostramos el recorrido; solo se usa para armar la ruta, no la guardamos."}
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                {route.status !== "ready" && (
                  <button
                    type="button"
                    data-testid="local-route-button"
                    onClick={requestRoute}
                    disabled={route.status === "loading"}
                    className="flex items-center gap-2 rounded-full bg-blush px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition disabled:opacity-60 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]"
                  >
                    <LocateFixed size={16} />
                    {route.status === "loading" ? "Buscando tu ubicación..." : "Usar mi ubicación"}
                  </button>
                )}
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={
                    route.status === "ready"
                      ? "rounded-full bg-blush px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]"
                      : "rounded-full border border-mauve/20 px-5 py-2.5 text-sm text-charcoal/80 transition hover:border-blush hover:text-charcoal"
                  }
                >
                  {route.status === "ready" ? "Abrir la ruta en Maps →" : "Abrir en Maps →"}
                </a>
                {whatsAppNumber && (
                  <a
                    href={getWhatsAppLink(whatsAppNumber, "¡Hola! ¿Me pasan indicaciones para llegar al local?")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-mauve/20 px-5 py-2.5 text-sm text-charcoal/80 transition hover:border-blush hover:text-charcoal"
                  >
                    Pedir indicaciones por WhatsApp
                  </a>
                )}
              </div>
            </>
          )}
        </div>

        {stepCount > 1 && (
          <button
            type="button"
            onClick={() => setIndex((current + 1) % stepCount)}
            className="min-h-[44px] text-sm font-semibold text-blushdark transition hover:text-charcoal"
          >
            {NEXT_LABEL[nextStep]} →
          </button>
        )}
      </div>
    </div>
  );
}
