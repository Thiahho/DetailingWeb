"use client";

import { useRef, useState } from "react";
import { Button } from "@/src/components/shared/Button";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

function formatMoney(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("es-AR")}`;
}

export default function CloseCajaModal({
  expectedCash, onClose, onClosed,
}: {
  expectedCash: number;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [counted, setCounted] = useState(expectedCash);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ difference: number } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useModalHotkeys(true, {
    onClose: result ? onClosed : onClose,
    onSubmit: () => formRef.current?.requestSubmit(),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/caja/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closingCashCounted: counted, notes: notes || undefined }),
      });
      const data = await res.json();
      if (res.ok) setResult({ difference: data.difference });
      else setError(data.message || "No se pudo cerrar la caja");
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    const diffColor = result.difference === 0 ? "text-green-400" : result.difference > 0 ? "text-blue-400" : "text-red-600";
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-ivory border border-mauve/10 rounded-2xl p-6 max-w-sm w-full text-center">
          <p className="text-charcoal font-semibold mb-2">Caja cerrada</p>
          <p className="text-charcoal/50 text-xs mb-1">Diferencia (contado − esperado)</p>
          <p data-testid="caja-close-difference" className={`text-2xl font-bold ${diffColor}`}>
            {result.difference === 0 ? "Sin diferencia" : `${result.difference > 0 ? "+" : ""}${formatMoney(result.difference)}`}
          </p>
          <Button onClick={onClosed} variant="primary" className="mt-4 w-full">
            Listo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-ivory border border-mauve/10 rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-charcoal mb-1">Cerrar caja</h2>
        <p className="text-charcoal/50 text-sm mb-4">Efectivo esperado: {formatMoney(expectedCash)}</p>
        <form ref={formRef} onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Efectivo contado</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={counted}
              onChange={(e) => setCounted(parseFloat(e.target.value) || 0)}
              data-testid="caja-close-counted"
              className="form-input mt-1.5"
            />
          </div>
          <div>
            <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="form-input mt-1.5 resize-none"
            />
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <Button type="submit" disabled={saving} data-testid="caja-close-submit" variant="danger" className="w-full">
            {saving ? "Cerrando..." : "Confirmar cierre"}
          </Button>
        </form>
      </div>
    </div>
  );
}
