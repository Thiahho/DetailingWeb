"use client";

import { useState, type FormEvent } from "react";
import { logError } from "@/src/lib/logger";

export default function SolicitarBorradoPage() {
  const [formData, setFormData] = useState({ contactName: "", contactEmail: "", contactPhone: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!formData.contactEmail.trim() && !formData.contactPhone.trim()) {
      setError("Indicá al menos un email o un teléfono para que podamos encontrar tus datos.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/data-deletion-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: formData.contactName,
          contactEmail: formData.contactEmail || null,
          contactPhone: formData.contactPhone || null,
          note: formData.note || null,
        }),
      });

      if (res.ok) {
        setDone(true);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.message || data?.title || "No se pudo enviar el pedido. Intentá nuevamente.");
      }
    } catch (err) {
      setError("No se pudo conectar con el servidor. Intentá nuevamente.");
      logError(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <main className="min-h-screen bg-cream px-6 py-16 text-charcoal">
        <div className="mx-auto max-w-lg space-y-6 text-center">
          <span className="badge">Legal</span>
          <h1 className="text-3xl font-semibold text-charcoal">Pedido recibido</h1>
          <p className="text-charcoal/70">
            Tu solicitud de borrado de datos fue registrada. El negocio la va a revisar y
            confirmar; una vez confirmada, tus datos personales se anonimizan en el sistema.
          </p>
          <a href="/" className="text-sm font-medium text-blush hover:underline">
            ← Volver al inicio
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream px-6 py-16 text-charcoal">
      <div className="mx-auto max-w-lg space-y-8">
        <div className="space-y-3">
          <span className="badge">Legal</span>
          <h1 className="text-3xl font-semibold text-charcoal">Solicitar borrado de mis datos</h1>
          <p className="text-sm text-charcoal/60">
            Completá tus datos de contacto para que el negocio pueda encontrar y anonimizar
            tu información. Ver{" "}
            <a href="/privacidad" className="font-medium text-blush hover:underline">
              Política de Privacidad
            </a>
            .
          </p>
        </div>

        <form className="glass-card space-y-4 p-6" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-charcoal/50">Nombre</label>
            <input
              className="form-input mt-2"
              required
              value={formData.contactName}
              onChange={(e) => setFormData((prev) => ({ ...prev, contactName: e.target.value }))}
              placeholder="Tu nombre"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-charcoal/50">Email</label>
            <input
              type="email"
              className="form-input mt-2"
              value={formData.contactEmail}
              onChange={(e) => setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))}
              placeholder="tucorreo@gmail.com"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-charcoal/50">WhatsApp</label>
            <input
              className="form-input mt-2"
              value={formData.contactPhone}
              onChange={(e) => setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))}
              placeholder="+54 9 11 111 1111"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-charcoal/50">Comentario (opcional)</label>
            <textarea
              className="form-input mt-2 min-h-[80px]"
              value={formData.note}
              onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="¿Algo que quieras aclarar?"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            className="w-full rounded-full bg-blush px-6 py-3 text-sm font-semibold uppercase tracking-wide text-cream shadow-glow transition [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.01] disabled:opacity-50"
            type="submit"
            disabled={submitting || !formData.contactName.trim()}
          >
            {submitting ? "Enviando..." : "Enviar solicitud"}
          </button>
        </form>

        <a href="/privacidad" className="text-sm font-medium text-blush hover:underline">
          ← Volver a Privacidad
        </a>
      </div>
    </main>
  );
}
