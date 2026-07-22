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

const SEGMENT_COLORS = ["#D69AA6", "#9C7C88"]; // blush / mauve, alternados

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
        setStep("result");
        setLoading(false);
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

  const handleWheelTransitionEnd = () => {
    if (step === "spinning") {
      setStep("result");
      setLoading(false);
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
        <div className="relative mx-auto flex h-72 w-72 items-center justify-center sm:h-80 sm:w-80">
          <div className="absolute -top-2 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[22px] border-x-transparent border-t-blushdark" />
          <div
            ref={wheelRef}
            onTransitionEnd={handleWheelTransitionEnd}
            className="relative h-full w-full overflow-hidden rounded-full border-4 border-champagne shadow-glow"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: step === "spinning" ? "transform 4s cubic-bezier(0.17,0.67,0.14,0.99)" : "none",
              background:
                prizes.length > 0
                  ? `conic-gradient(${prizes
                      .map((_, i) => {
                        const seg = 360 / prizes.length;
                        const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
                        return `${color} ${i * seg}deg ${(i + 1) * seg}deg`;
                      })
                      .join(", ")})`
                  : "#D69AA6",
            }}
          >
            {prizes.map((p, i) => {
              const seg = 360 / prizes.length;
              const centerAngle = i * seg + seg / 2;
              return (
                <div
                  key={p.id}
                  className="absolute inset-0"
                  style={{ transform: `rotate(${centerAngle}deg)` }}
                >
                  <span className="absolute left-1/2 top-3 -translate-x-1/2 text-[10px] font-semibold uppercase leading-tight text-white sm:top-4 sm:text-xs max-w-[70px] text-center">
                    {p.name}
                  </span>
                </div>
              );
            })}
            <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream shadow" />
          </div>
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
          <p className="text-lg font-medium text-charcoal/70">Girando la ruleta...</p>
        )}

        {step === "result" && result && (
          <div className="glass-card mx-auto max-w-sm space-y-4 p-6">
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
