import { CheckCheck, Heart, Instagram, MessageCircle } from "lucide-react";
import type { SocialCapture } from "./demoReviews";

// Verde de WhatsApp y degradé de Instagram: son los colores con los que la
// gente reconoce cada canal de un vistazo, por eso no salen de la paleta del sitio.
const WHATSAPP_GREEN = "#1FA855";
const WHATSAPP_BUBBLE = "#E7FFDB";
const INSTAGRAM_GRADIENT = "linear-gradient(45deg, #F9CE34, #EE2A7B 55%, #6228D7)";

function ChannelBadge({ kind }: { kind: SocialCapture["kind"] }) {
  if (kind === "whatsapp") {
    return (
      <span className="flex items-center gap-2 text-xs font-semibold text-charcoal/70">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: WHATSAPP_GREEN }}
        >
          <MessageCircle size={15} strokeWidth={2.2} />
        </span>
        WhatsApp
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs font-semibold text-charcoal/70">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 items-center justify-center rounded-full text-white"
        style={{ backgroundImage: INSTAGRAM_GRADIENT }}
      >
        <Instagram size={15} strokeWidth={2.2} />
      </span>
      Instagram
    </span>
  );
}

function WhatsAppMock({ capture }: { capture: SocialCapture }) {
  return (
    <div className="rounded-2xl bg-[#EFE7DE] p-3">
      <p className="mb-1.5 px-1 text-xs font-semibold" style={{ color: WHATSAPP_GREEN }}>
        {capture.author}
      </p>
      <div
        className="rounded-2xl rounded-tl-md px-3.5 py-2.5 shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
        style={{ backgroundColor: WHATSAPP_BUBBLE }}
      >
        <p className="text-[15px] leading-snug text-charcoal">{capture.text}</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-charcoal/50">
          {capture.meta}
          <CheckCheck size={14} className="text-[#53BDEB]" aria-hidden="true" />
        </p>
      </div>
    </div>
  );
}

function InstagramMock({ capture }: { capture: SocialCapture }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-mauve/15 bg-white p-3.5">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-[2px]"
        style={{ backgroundImage: INSTAGRAM_GRADIENT }}
      >
        <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-xs font-semibold text-charcoal/70">
          {capture.author[0]?.toUpperCase()}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-snug text-charcoal">
          <span className="font-semibold">{capture.author}</span> {capture.text}
        </p>
        <p className="mt-1.5 text-[11px] font-medium text-charcoal/50">{capture.meta} · Responder</p>
      </div>
      <Heart size={14} className="mt-1 shrink-0 fill-[#ED4956] text-[#ED4956]" aria-hidden="true" />
    </div>
  );
}

interface SocialCapturesProps {
  captures: SocialCapture[];
}

// Mensajes y comentarios que llegan por WhatsApp e Instagram. Cada item puede
// traer una captura real (`imageUrl`) o, si no la trae, se dibuja una maqueta
// del mensaje con el aspecto del canal.
export default function SocialCaptures({ captures }: SocialCapturesProps) {
  if (captures.length === 0) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-6" data-testid="reviews-social-captures">
      <h3 className="text-xl font-semibold tracking-tight text-charcoal md:text-2xl">
        Y lo que nos escriben <span className="accent-serif">por privado</span>
      </h3>
      {/* En celular es una fila que se desliza (cuatro cards apiladas alargan
          demasiado la sección); desde sm pasa a grilla. */}
      <ul className="snap-row -mx-6 m-0 list-none gap-4 px-6 pb-1 [scroll-padding-left:1.5rem] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {captures.map((capture) => (
          <li key={capture.id} className="flex w-[280px] flex-col gap-3 rounded-[1.75rem] bg-ivory p-4 sm:w-auto">
            <ChannelBadge kind={capture.kind} />
            {capture.imageUrl ? (
              <img
                src={capture.imageUrl}
                alt={`Captura de ${capture.kind === "whatsapp" ? "WhatsApp" : "Instagram"}: mensaje de ${capture.author}`}
                loading="lazy"
                className="w-full rounded-2xl object-cover"
              />
            ) : capture.kind === "whatsapp" ? (
              <WhatsAppMock capture={capture} />
            ) : (
              <InstagramMock capture={capture} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
