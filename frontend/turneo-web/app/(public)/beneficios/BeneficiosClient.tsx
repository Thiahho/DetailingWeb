"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PartyPopper, Scissors, Sparkles } from "lucide-react";
import { type SiteConfig, getSiteConfig, getWhatsAppLink } from "@/src/lib/siteConfig";

interface Prize {
  id: number;
  name: string;
}

interface SpinResult {
  spinId: number;
  prizeName: string;
  prizeDescription: string | null;
  code: string;
  expiresAt: string;
  alreadyParticipated: boolean;
}

type Step = "form" | "spinning" | "result";

// Misma paleta que /ruleta (ver RouletteClient.tsx) — blush/mauve/champagne,
// para que las dos ruletas del sitio se sientan como el mismo componente.
const SEGMENT_PALETTE = ["#D69AA6", "#9C7C88", "#C07E8C"];
const DIVIDER_COLOR = "#C6A26E"; // champagne — separador dorado entre gajos

function getSegmentColors(count: number) {
  const colors = Array.from({ length: count }, (_, i) => SEGMENT_PALETTE[i % SEGMENT_PALETTE.length]);
  if (count > 2 && colors[count - 1] === colors[0]) {
    const alt = SEGMENT_PALETTE.find((c) => c !== colors[count - 1] && c !== colors[count - 2]);
    if (alt) colors[count - 1] = alt;
  }
  return colors;
}

function buildWheelGradient(prizes: Prize[]) {
  if (prizes.length === 0) return SEGMENT_PALETTE[0];

  const seg = 360 / prizes.length;
  const gap = Math.min(1.4, seg * 0.06);
  const colors = getSegmentColors(prizes.length);
  const stops: string[] = [];

  prizes.forEach((_, i) => {
    const start = i * seg;
    const end = (i + 1) * seg;
    stops.push(
      `${DIVIDER_COLOR} ${start}deg`,
      `${DIVIDER_COLOR} ${start + gap}deg`,
      `${colors[i]} ${start + gap}deg`,
      `${colors[i]} ${end - gap}deg`,
      `${DIVIDER_COLOR} ${end - gap}deg`,
      `${DIVIDER_COLOR} ${end}deg`
    );
  });

  return `conic-gradient(${stops.join(", ")})`;
}

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  rotate: number;
  color: string;
}

const CONFETTI_COLORS = ["#D69AA6", "#C6A26E", "#9C7C88", "#C9BFE0"];

function Confetti() {
  const pieces: ConfettiPiece[] = Array.from({ length: 22 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
    rotate: Math.random() * 360,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  }));

  return (
    <div className="pointer-events-none absolute inset-x-0 -top-2 h-0 overflow-visible">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute top-0 block h-2 w-1.5 rounded-sm"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function formatFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function BeneficiosClient() {
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [step, setStep] = useState<Step>("form");
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({ nombre: "", whatsApp: "" });

  useEffect(() => {
    getSiteConfig()
      .then(setSiteConfig)
      .catch(() => {});

    fetch("/api/loyalty-roulette/prizes")
      .then((r) => r.json())
      .then((data) => setPrizes(Array.isArray(data) ? data : []))
      .catch(() => setPrizes([]));
  }, []);

  const businessName = siteConfig?.businessName || "el negocio";

  const handleSpin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const nombre = form.nombre.trim();
    const whatsAppDigits = form.whatsApp.replace(/\D/g, "");

    if (!nombre) {
      setError("Contanos tu nombre.");
      return;
    }
    if (whatsAppDigits.length < 8) {
      setError("Ingresá un WhatsApp válido, con código de área.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/loyalty-roulette/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: nombre, whatsApp: whatsAppDigits }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No pudimos girar la ruleta, intentá de nuevo.");
      }

      const spin = data as SpinResult;
      setResult(spin);

      if (spin.alreadyParticipated || prizes.length === 0) {
        revealResult();
        return;
      }

      const index = prizes.findIndex((p) => p.name === spin.prizeName);
      const safeIndex = index >= 0 ? index : 0;
      const segmentAngle = 360 / prizes.length;
      const jitter = (Math.random() - 0.5) * segmentAngle * 0.5;
      const target = 360 * 6 + (360 - (safeIndex * segmentAngle + segmentAngle / 2)) + jitter;

      setRotation(target);
      setStep("spinning");
    } catch (err: any) {
      setError(err.message || "Error de conexión, intentá de nuevo.");
      setLoading(false);
    }
  };

  const revealResult = () => {
    setStep("result");
    setLoading(false);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 1500);
  };

  const handleWheelTransitionEnd = () => {
    if (step === "spinning") {
      revealResult();
    }
  };

  const whatsAppCtaUrl =
    result && siteConfig?.whatsAppNumber
      ? getWhatsAppLink(
          siteConfig.whatsAppNumber,
          `Hola! Gané "${result.prizeName}" en la ruleta de beneficios de ${businessName} 🎉\n\nMi nombre es: ${form.nombre}\nMi código es: ${result.code}\n\nQuiero coordinar mi próximo turno con este beneficio.`
        )
      : undefined;

  return (
    <main className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 text-charcoal">
      <div className="w-full max-w-xl space-y-8 text-center">
        <div className="space-y-3">
          <Link href="/reservar" className="text-sm font-semibold text-charcoal/60 hover:text-charcoal">
            {businessName}
          </Link>
          <div className="flex items-center justify-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blush to-champagne shadow-gold">
              <Scissors className="h-5 w-5 text-cream" strokeWidth={2} />
            </span>
            <h1 className="font-display text-3xl font-semibold uppercase tracking-tight md:text-4xl">
              Girá y ganá{" "}
              <span className="bg-gradient-to-r from-blush to-[#d9a954] bg-clip-text text-transparent">
                un beneficio
              </span>
            </h1>
          </div>
          <p className="text-charcoal/70">
            Un premio exclusivo para tu próxima visita. ¡Un giro por persona!
          </p>
        </div>

        {/* RULETA VISUAL */}
        <div className="relative flex justify-center">
          <div
            className={`relative flex h-72 w-72 items-center justify-center rounded-full bg-cream p-2.5 shadow-elevated transition-shadow sm:h-80 sm:w-80 ${
              step === "spinning" ? "wheel-spinning-glow" : ""
            }`}
          >
            {/* Aro metálico exterior */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blushdark via-blush to-blushdark shadow-gold" />

            {/* Puntero — fijo, no rota con la rueda */}
            <div className="pointer-idle absolute -top-3 left-1/2 z-20 origin-bottom -translate-x-1/2">
              <div className="mx-auto h-3 w-3 rounded-full bg-blushdark shadow-soft" />
              <div className="mx-auto -mt-1 h-0 w-0 border-x-[11px] border-t-[20px] border-x-transparent border-t-blushdark drop-shadow" />
            </div>

            {/* Rueda giratoria */}
            <div
              ref={wheelRef}
              onTransitionEnd={handleWheelTransitionEnd}
              className="relative h-[calc(100%-1.25rem)] w-[calc(100%-1.25rem)] overflow-hidden rounded-full border-2 border-cream"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition:
                  step === "spinning"
                    ? "transform 4.2s cubic-bezier(0.18, 1.15, 0.32, 1)"
                    : "none",
                background: buildWheelGradient(prizes),
              }}
            >
              {prizes.map((p, i) => {
                const seg = 360 / prizes.length;
                const centerAngle = i * seg + seg / 2;
                return (
                  <div key={p.id}>
                    <div className="absolute inset-0" style={{ transform: `rotate(${centerAngle}deg)` }}>
                      <span className="absolute left-1/2 top-3 -translate-x-1/2 max-w-[72px] text-center text-[10px] font-semibold uppercase leading-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.35)] sm:top-4 sm:text-xs">
                        {p.name}
                      </span>
                    </div>
                    {/* Peg del gajo — pasa "clickeando" bajo el puntero al girar */}
                    <div className="absolute inset-0" style={{ transform: `rotate(${i * seg}deg)` }}>
                      <span className="absolute left-1/2 top-0.5 h-2 w-2 -translate-x-1/2 rounded-full bg-cream/90 shadow-sm" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Brillo tipo vidrio — fijo, no rota, le da profundidad a la rueda */}
            <div
              className="pointer-events-none absolute inset-2.5 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 32% 26%, rgba(255,255,255,0.55), transparent 45%), radial-gradient(circle at 75% 80%, rgba(0,0,0,0.12), transparent 55%)",
              }}
            />

            {/* Centro */}
            <div className="absolute left-1/2 top-1/2 z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-blushdark bg-gradient-to-br from-blush/25 to-cream shadow-soft">
              <Scissors className="h-5 w-5 text-blush" strokeWidth={2.25} />
            </div>
          </div>

          {showConfetti && <Confetti />}
        </div>

        {step === "form" && (
          <form onSubmit={handleSpin} className="glass-card mx-auto max-w-sm space-y-4 p-6 text-left">
            <div className="space-y-2">
              <label className="text-sm font-medium text-charcoal/70">Tu nombre</label>
              <input
                type="text"
                required
                className="w-full rounded-xl border border-mauve/40 bg-porcelain px-4 py-3 text-charcoal outline-none transition focus:border-blush"
                placeholder="¿Quién sos?"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-charcoal/70">WhatsApp</label>
              <input
                type="tel"
                required
                className="w-full rounded-xl border border-mauve/40 bg-porcelain px-4 py-3 text-charcoal outline-none transition focus:border-blush"
                placeholder="11 2233 4455"
                value={form.whatsApp}
                onChange={(e) => setForm({ ...form, whatsApp: e.target.value })}
              />
            </div>

            {error && <p className="text-sm text-champagne">{error}</p>}

            <button
              type="submit"
              disabled={loading || prizes.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-blush px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-cream shadow-glow transition hover:scale-[1.02] disabled:opacity-50"
            >
              {loading ? (
                "Girando..."
              ) : (
                <>
                  <Sparkles className="h-4 w-4" strokeWidth={2.25} />
                  GIRAR Y GANAR
                </>
              )}
            </button>
            {prizes.length === 0 && !loading && (
              <p className="text-center text-[11px] text-charcoal/40">
                Todavía no hay beneficios cargados. Volvé a intentarlo más tarde.
              </p>
            )}
            <p className="text-center text-[11px] text-charcoal/40">
              Un giro por persona. El beneficio tiene vigencia limitada desde que lo ganás.
            </p>
          </form>
        )}

        {step === "spinning" && (
          <p className="text-lg font-medium text-charcoal/70">Girando la ruleta…</p>
        )}

        {step === "result" && result && (
          <div className="glass-card animate-pop-in mx-auto max-w-sm space-y-4 p-6">
            {result.alreadyParticipated && (
              <p className="text-xs text-charcoal/50">Ya habías participado con este WhatsApp — este es tu premio.</p>
            )}
            <div className="flex flex-col items-center gap-2">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blush to-champagne shadow-gold">
                <PartyPopper className="h-7 w-7 text-cream" strokeWidth={2} />
              </span>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-blush">¡Ganaste!</p>
            </div>
            <h2 className="text-xl font-semibold text-charcoal">{result.prizeName}</h2>
            {result.prizeDescription && (
              <p className="text-sm text-charcoal/60">{result.prizeDescription}</p>
            )}
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-charcoal/40">Código</p>
              <p className="rounded-lg bg-porcelain px-4 py-2 font-mono text-lg font-semibold text-blush">
                {result.code}
              </p>
            </div>
            <p className="text-xs text-charcoal/50">Válido hasta: {formatFecha(result.expiresAt)}</p>
            {whatsAppCtaUrl ? (
              <a
                href={whatsAppCtaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-full bg-blush px-6 py-3.5 text-center text-sm font-semibold uppercase tracking-wide text-cream shadow-glow transition hover:scale-[1.02]"
              >
                Reclamar por WhatsApp
              </a>
            ) : (
              <p className="text-xs text-charcoal/50">
                Mostrá este código en tu próxima visita para canjear el beneficio.
              </p>
            )}
            <Link
              href="/reservar"
              className="block text-center text-xs text-charcoal/50 hover:text-charcoal"
            >
              Reservar mi turno
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
