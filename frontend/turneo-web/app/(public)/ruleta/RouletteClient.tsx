"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, PartyPopper, Sparkles } from "lucide-react";
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
import { buildWhatsAppUrl } from "@/src/lib/contact";

interface Prize {
  id: number;
  name: string;
}

interface SpinResult {
  leadId: number;
  premioNombre: string;
  premioDescripcion: string | null;
  codigo: string;
  venceHasta: string;
  yaHabiaParticipado: boolean;
}

type Step = "form" | "spinning" | "result" | "additional" | "done";

export default function RouletteClient({
  campaign,
  fuente,
}: {
  campaign?: string;
  fuente?: string;
}) {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [step, setStep] = useState<Step>("form");
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SpinResult | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const [form, setForm] = useState({ nombreNegocio: "", whatsApp: "", nombreResponsable: "" });
  const [extra, setExtra] = useState({
    email: "",
    instagram: "",
    tipoNegocio: "",
    cantidadProfesionales: "",
    problemaPrincipal: "",
  });

  useEffect(() => {
    fetch("/api/marketing/roulette/prizes")
      .then((r) => r.json())
      .then((data) => setPrizes(Array.isArray(data) ? data : []))
      .catch(() => setPrizes([]));
  }, []);

  const handleSpin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const nombreNegocio = form.nombreNegocio.trim();
    const whatsAppDigits = form.whatsApp.replace(/\D/g, "");

    if (!nombreNegocio) {
      setError("Contanos el nombre de tu negocio.");
      return;
    }
    if (whatsAppDigits.length < 8) {
      setError("Ingresá un WhatsApp válido, con código de área.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/marketing/roulette/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreNegocio,
          whatsApp: whatsAppDigits,
          nombreResponsable: form.nombreResponsable.trim() || undefined,
          fuente: fuente || "Landing",
          campaign,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No pudimos girar la ruleta, intentá de nuevo.");
      }

      const spin = data as SpinResult;
      setResult(spin);

      if (spin.yaHabiaParticipado || prizes.length === 0) {
        revealResult();
        return;
      }

      const target = computeSpinTarget(prizes, spin.premioNombre);
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

  const handleContinueExtra = async () => {
    if (result) {
      const hasAny = Object.values(extra).some((v) => v.trim().length > 0);
      if (hasAny) {
        await fetch(`/api/marketing/roulette/leads/${result.leadId}/additional-data`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: extra.email.trim() || undefined,
            instagram: extra.instagram.trim() || undefined,
            tipoNegocio: extra.tipoNegocio || undefined,
            cantidadProfesionales: extra.cantidadProfesionales || undefined,
            problemaPrincipal: extra.problemaPrincipal || undefined,
          }),
        }).catch(() => {});
      }
    }
    setStep("done");
  };

  const whatsAppCtaUrl = result
    ? buildWhatsAppUrl(
        `Hola, participé en la Ruleta Turneo 🎰\n\nMi negocio es: ${form.nombreNegocio}\nMi beneficio es: ${result.premioNombre}\nMi código es: ${result.codigo}\n\nQuiero activar mi beneficio y conocer Turneo.`
      )
    : buildWhatsAppUrl("Hola! Quiero más información sobre Turneo.");

  return (
    <RouletteFrame>
      <RouletteHeader
        backHref="/"
        backLabel="Turneo"
        eyebrow="Ruleta Turneo"
        title="Girá la ruleta y"
        accent="llevate un beneficio."
        subtitle="Descubrí tu beneficio exclusivo para empezar a digitalizar tu salón."
      />

      <RouletteWheel
        prizes={prizes}
        rotation={rotation}
        spinning={step === "spinning"}
        confetti={showConfetti}
        onSpinEnd={handleWheelTransitionEnd}
        centerIcon={<Gift className="h-5 w-5 text-blush" strokeWidth={2.25} />}
      />

        {step === "form" && (
          <form onSubmit={handleSpin} className={`${ROULETTE_CARD} text-left`}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-charcoal/70">Nombre de tu negocio</label>
              <input
                type="text"
                required
                className={ROULETTE_INPUT}
                placeholder="Ej: Estudio Bella"
                value={form.nombreNegocio}
                onChange={(e) => setForm({ ...form, nombreNegocio: e.target.value })}
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-charcoal/70">Tu nombre (opcional)</label>
              <input
                type="text"
                className={ROULETTE_INPUT}
                placeholder="¿Quién sos?"
                value={form.nombreResponsable}
                onChange={(e) => setForm({ ...form, nombreResponsable: e.target.value })}
              />
            </div>

            {error && <p className="text-sm text-rosewood">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className={ROULETTE_PRIMARY}
            >
              {loading ? (
                "Girando..."
              ) : (
                <>
                  <Sparkles className="h-4 w-4" strokeWidth={2.25} />
                  GIRAR LA RULETA
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-charcoal/40">
              Una participación por WhatsApp. El premio tiene vigencia limitada desde que lo ganás.
            </p>
          </form>
        )}

        {step === "spinning" && (
          <p className="text-lg font-medium text-charcoal/70">Girando la ruleta…</p>
        )}

        {step === "result" && result && (
          <div className={`${ROULETTE_CARD} animate-pop-in`}>
            {result.yaHabiaParticipado && (
              <p className="text-xs text-charcoal/50">Ya habías participado con este WhatsApp — este es tu premio.</p>
            )}
            <div className="flex flex-col items-center gap-2">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blush to-champagne shadow-gold">
                <PartyPopper className="h-7 w-7 text-white" strokeWidth={2} />
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rosewood">¡Ganaste!</p>
            </div>
            <h2 className="text-xl font-semibold text-charcoal">{result.premioNombre.toUpperCase()}</h2>
            {result.premioDescripcion && (
              <p className="text-sm text-charcoal/60">{result.premioDescripcion}</p>
            )}
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-charcoal/40">Código</p>
              <p className="rounded-lg bg-porcelain px-4 py-2 font-mono text-lg font-semibold text-rosewood">
                {result.codigo}
              </p>
            </div>
            <p className="text-xs text-charcoal/50">Válido hasta: {formatFecha(result.venceHasta)}</p>
            <button
              onClick={() => setStep("additional")}
              className={ROULETTE_PRIMARY}
            >
              ACTIVAR MI BENEFICIO
            </button>
          </div>
        )}

        {step === "additional" && (
          <div className={`${ROULETTE_CARD} text-left`}>
            <p className="text-sm text-charcoal/70">
              ¡Tu beneficio está reservado! Contanos un poco más de tu negocio (opcional).
            </p>
            <input
              type="email"
              className={ROULETTE_INPUT}
              placeholder="Email (opcional)"
              value={extra.email}
              onChange={(e) => setExtra({ ...extra, email: e.target.value })}
            />
            <input
              type="text"
              className={ROULETTE_INPUT}
              placeholder="Instagram (opcional)"
              value={extra.instagram}
              onChange={(e) => setExtra({ ...extra, instagram: e.target.value })}
            />
            <select
              className={ROULETTE_INPUT}
              value={extra.tipoNegocio}
              onChange={(e) => setExtra({ ...extra, tipoNegocio: e.target.value })}
            >
              <option value="">Tipo de negocio (opcional)</option>
              <option>Salón de belleza</option>
              <option>Peluquería</option>
              <option>Barbería</option>
              <option>Uñas</option>
              <option>Cejas y pestañas</option>
              <option>Estética</option>
              <option>Spa</option>
              <option>Profesional independiente</option>
              <option>Otro</option>
            </select>
            <select
              className={ROULETTE_INPUT}
              value={extra.cantidadProfesionales}
              onChange={(e) => setExtra({ ...extra, cantidadProfesionales: e.target.value })}
            >
              <option value="">¿Cuántas personas trabajan en tu negocio? (opcional)</option>
              <option>Solo yo</option>
              <option>2 a 3 personas</option>
              <option>4 a 10 personas</option>
              <option>Más de 10 personas</option>
            </select>
            <select
              className={ROULETTE_INPUT}
              value={extra.problemaPrincipal}
              onChange={(e) => setExtra({ ...extra, problemaPrincipal: e.target.value })}
            >
              <option value="">¿Qué es lo que más te cuesta gestionar? (opcional)</option>
              <option>Organizar turnos</option>
              <option>Responder WhatsApp</option>
              <option>Evitar cancelaciones</option>
              <option>Gestionar profesionales</option>
              <option>Conseguir clientes</option>
              <option>Organizar el negocio</option>
              <option>Saber cuánto factura</option>
              <option>Todo lo anterior</option>
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("done")}
                className="flex-1 rounded-full border border-mauve/20 px-4 py-3 text-sm font-semibold text-charcoal/70 transition hover:border-blush hover:text-charcoal"
              >
                Saltar
              </button>
              <button
                onClick={handleContinueExtra}
                className="flex-1 rounded-full bg-blush px-4 py-3 text-sm font-semibold text-white shadow-glow transition [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className={ROULETTE_CARD}>
            <p className="text-lg font-semibold text-charcoal">¿Listo para llevar tu negocio al siguiente nivel?</p>
            <p className="text-sm text-charcoal/60">
              Escribinos por WhatsApp con tu código y coordinamos la activación de tu beneficio.
            </p>
            <a
              href={whatsAppCtaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={ROULETTE_PRIMARY}
            >
              ACTIVAR MI BENEFICIO POR WHATSAPP
            </a>
            <Link
              href="/"
              className="block text-center text-xs text-charcoal/50 hover:text-charcoal"
            >
              Ver Turneo en vivo
            </Link>
          </div>
        )}
    </RouletteFrame>
  );
}
