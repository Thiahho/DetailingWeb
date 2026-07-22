"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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

// blush / mauve / blushdark — evita que el primer y último gajo (que se
// tocan en la costura de 360°) queden pegados del mismo color, ver abajo.
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
  const wheelRef = useRef<HTMLDivElement>(null);

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

      const index = prizes.findIndex((p) => p.name === spin.premioNombre);
      const safeIndex = index >= 0 ? index : 0;
      const segmentAngle = 360 / prizes.length;
      const jitter = (Math.random() - 0.5) * segmentAngle * 0.5;
      const target =
        360 * 6 + (360 - (safeIndex * segmentAngle + segmentAngle / 2)) + jitter;

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
    <main className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 text-charcoal">
      <div className="w-full max-w-xl space-y-8 text-center">
        <div className="space-y-2">
          <Link href="/" className="text-sm font-semibold text-charcoal/60 hover:text-charcoal">
            Turneo
          </Link>
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
            🎁 Girá la Ruleta Turneo
          </h1>
          <p className="text-charcoal/70">
            Descubrí tu beneficio exclusivo para empezar a digitalizar tu salón.
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
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-champagne via-[#e8cfa0] to-champagne shadow-gold" />

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
            <div className="absolute left-1/2 top-1/2 z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-champagne bg-cream text-lg shadow-soft">
              🎁
            </div>
          </div>

          {showConfetti && <Confetti />}
        </div>

        {step === "form" && (
          <form onSubmit={handleSpin} className="glass-card mx-auto max-w-sm space-y-4 p-6 text-left">
            <div className="space-y-2">
              <label className="text-sm font-medium text-charcoal/70">Nombre de tu negocio</label>
              <input
                type="text"
                required
                className="w-full rounded-xl border border-mauve/15 bg-white px-4 py-3 text-charcoal outline-none transition focus:border-blush"
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
                className="w-full rounded-xl border border-mauve/15 bg-white px-4 py-3 text-charcoal outline-none transition focus:border-blush"
                placeholder="11 2233 4455"
                value={form.whatsApp}
                onChange={(e) => setForm({ ...form, whatsApp: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-charcoal/70">Tu nombre (opcional)</label>
              <input
                type="text"
                className="w-full rounded-xl border border-mauve/15 bg-white px-4 py-3 text-charcoal outline-none transition focus:border-blush"
                placeholder="¿Quién sos?"
                value={form.nombreResponsable}
                onChange={(e) => setForm({ ...form, nombreResponsable: e.target.value })}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-blush px-6 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.02] disabled:opacity-50"
            >
              {loading ? "Girando..." : "GIRAR LA RULETA 🎰"}
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
          <div className="glass-card animate-pop-in mx-auto max-w-sm space-y-4 p-6">
            {result.yaHabiaParticipado && (
              <p className="text-xs text-charcoal/50">Ya habías participado con este WhatsApp — este es tu premio.</p>
            )}
            <p className="text-2xl">🎉 ¡GANASTE!</p>
            <h2 className="text-xl font-semibold text-charcoal">{result.premioNombre.toUpperCase()}</h2>
            {result.premioDescripcion && (
              <p className="text-sm text-charcoal/60">{result.premioDescripcion}</p>
            )}
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-charcoal/40">Código</p>
              <p className="rounded-lg bg-cream px-4 py-2 font-mono text-lg font-semibold text-blushdark">
                {result.codigo}
              </p>
            </div>
            <p className="text-xs text-charcoal/50">Válido hasta: {formatFecha(result.venceHasta)}</p>
            <button
              onClick={() => setStep("additional")}
              className="w-full rounded-full bg-blush px-6 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.02]"
            >
              ACTIVAR MI BENEFICIO
            </button>
          </div>
        )}

        {step === "additional" && (
          <div className="glass-card mx-auto max-w-sm space-y-4 p-6 text-left">
            <p className="text-sm text-charcoal/70">
              ¡Tu beneficio está reservado! Contanos un poco más de tu negocio (opcional).
            </p>
            <input
              type="email"
              className="w-full rounded-xl border border-mauve/15 bg-white px-4 py-3 text-charcoal outline-none transition focus:border-blush"
              placeholder="Email (opcional)"
              value={extra.email}
              onChange={(e) => setExtra({ ...extra, email: e.target.value })}
            />
            <input
              type="text"
              className="w-full rounded-xl border border-mauve/15 bg-white px-4 py-3 text-charcoal outline-none transition focus:border-blush"
              placeholder="Instagram (opcional)"
              value={extra.instagram}
              onChange={(e) => setExtra({ ...extra, instagram: e.target.value })}
            />
            <select
              className="w-full rounded-xl border border-mauve/15 bg-white px-4 py-3 text-charcoal outline-none transition focus:border-blush"
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
              className="w-full rounded-xl border border-mauve/15 bg-white px-4 py-3 text-charcoal outline-none transition focus:border-blush"
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
              className="w-full rounded-xl border border-mauve/15 bg-white px-4 py-3 text-charcoal outline-none transition focus:border-blush"
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
                className="flex-1 rounded-full bg-blush px-4 py-3 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.02]"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="glass-card mx-auto max-w-sm space-y-4 p-6">
            <p className="text-lg font-semibold text-charcoal">¿Listo para llevar tu negocio al siguiente nivel?</p>
            <p className="text-sm text-charcoal/60">
              Escribinos por WhatsApp con tu código y coordinamos la activación de tu beneficio.
            </p>
            <a
              href={whatsAppCtaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-full bg-blush px-6 py-3.5 text-center text-sm font-semibold text-white shadow-glow transition hover:scale-[1.02]"
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
      </div>
    </main>
  );
}
