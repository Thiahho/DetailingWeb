"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PartyPopper, Scissors, Sparkles } from "lucide-react";
import {
  computeSpinTarget,
  formatFecha,
  ROULETTE_CARD,
  ROULETTE_INPUT,
  ROULETTE_PRIMARY,
  RouletteFrame,
  RouletteHeader,
  RouletteWheel,
} from "@/src/components/public/roulette/RouletteShared";
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

export default function BeneficiosClient() {
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [step, setStep] = useState<Step>("form");
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);

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

      const target = computeSpinTarget(prizes, spin.prizeName);
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
    <RouletteFrame>
      <RouletteHeader
        backHref="/reservar"
        backLabel={businessName}
        eyebrow="Beneficios"
        title="Girá y ganá"
        accent="un beneficio."
        subtitle="Un premio exclusivo para tu próxima visita. ¡Un giro por persona!"
      />

      <RouletteWheel
        prizes={prizes}
        rotation={rotation}
        spinning={step === "spinning"}
        confetti={showConfetti}
        onSpinEnd={handleWheelTransitionEnd}
        centerIcon={<Scissors className="h-5 w-5 text-blush" strokeWidth={2.25} />}
      />

        {step === "form" && (
          <form onSubmit={handleSpin} className={`${ROULETTE_CARD} text-left`}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-charcoal/70">Tu nombre</label>
              <input
                type="text"
                required
                className={ROULETTE_INPUT}
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
                className={ROULETTE_INPUT}
                placeholder="11 2233 4455"
                value={form.whatsApp}
                onChange={(e) => setForm({ ...form, whatsApp: e.target.value })}
              />
            </div>

            {error && <p className="text-sm text-rosewood">{error}</p>}

            <button
              type="submit"
              disabled={loading || prizes.length === 0}
              className={ROULETTE_PRIMARY}
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
          <p className="text-lg font-medium text-mist">Girando la ruleta…</p>
        )}

        {step === "result" && result && (
          <div className={`${ROULETTE_CARD} animate-pop-in`}>
            {result.alreadyParticipated && (
              <p className="text-xs text-charcoal/50">Ya habías participado con este WhatsApp — este es tu premio.</p>
            )}
            <div className="flex flex-col items-center gap-2">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blush to-champagne shadow-gold">
                <PartyPopper className="h-7 w-7 text-cream" strokeWidth={2} />
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rosewood">¡Ganaste!</p>
            </div>
            <h2 className="text-2xl font-semibold leading-tight text-charcoal">{result.prizeName}</h2>
            {result.prizeDescription && (
              <p className="text-sm text-charcoal/60">{result.prizeDescription}</p>
            )}
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-charcoal/40">Código</p>
              <p className="rounded-lg bg-porcelain px-4 py-2 font-mono text-lg font-semibold text-rosewood">
                {result.code}
              </p>
            </div>
            <p className="text-xs text-charcoal/50">Válido hasta: {formatFecha(result.expiresAt)}</p>
            {whatsAppCtaUrl ? (
              <a
                href={whatsAppCtaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={ROULETTE_PRIMARY}
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
              className="block text-center text-xs text-charcoal/60 hover:text-charcoal"
            >
              Reservar mi turno
            </Link>
          </div>
        )}
    </RouletteFrame>
  );
}
