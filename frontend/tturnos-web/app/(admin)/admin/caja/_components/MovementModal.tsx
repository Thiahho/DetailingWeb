"use client";

import { useRef, useState } from "react";
import { Button } from "@/src/components/shared/Button";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

export type MovementType = "Charge" | "Deposit" | "Refund" | "ManualIn" | "ManualOut";
export type MovementMethod = "Cash" | "Transfer";
export type MovementMode = "charge" | "refund" | "manual";

function movementTypeLabel(type: string) {
  switch (type) {
    case "Charge": return "Cobro";
    case "Deposit": return "Seña";
    case "Refund": return "Devolución";
    case "ManualIn": return "Ingreso manual";
    case "ManualOut": return "Egreso manual";
    default: return type;
  }
}

export default function MovementModal({
  mode, initialBookingId, initialAmount, onClose, onSaved,
}: {
  mode: MovementMode;
  initialBookingId?: number;
  initialAmount?: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const typeOptions: MovementType[] = mode === "charge" ? ["Charge", "Deposit"] : mode === "refund" ? ["Refund"] : ["ManualIn", "ManualOut"];
  const [type, setType] = useState<MovementType>(typeOptions[0]);
  const [method, setMethod] = useState<MovementMethod>("Cash");
  const [amount, setAmount] = useState(initialAmount ?? 0);
  const [bookingId, setBookingId] = useState<number | "">(initialBookingId ?? "");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const titles: Record<MovementMode, string> = { charge: "Cobrar turno", refund: "Registrar devolución", manual: "Movimiento manual" };
  const formRef = useRef<HTMLFormElement>(null);
  useModalHotkeys(true, { onClose, onSubmit: () => formRef.current?.requestSubmit() });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) { setError("El monto debe ser mayor a 0"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/caja/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          method,
          amount,
          bookingId: mode === "manual" || bookingId === "" ? undefined : Number(bookingId),
          description: description || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSaved(`${movementTypeLabel(type)} registrado`);
        onClose();
      } else {
        setError(data.message || "No se pudo registrar el movimiento");
      }
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-ivory border border-mauve/10 rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-charcoal">{titles[mode]}</h2>
          <button onClick={onClose} className="text-charcoal/40 hover:text-charcoal text-xl">✕</button>
        </div>
        <form ref={formRef} onSubmit={submit} className="space-y-3">
          {typeOptions.length > 1 && (
            <div>
              <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as MovementType)}
                data-testid="caja-movement-type"
                className="form-input mt-1.5"
              >
                {typeOptions.map((t) => <option key={t} value={t}>{movementTypeLabel(t)}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Método</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as MovementMethod)}
              data-testid="caja-movement-method"
              className="form-input mt-1.5"
            >
              <option value="Cash">Efectivo</option>
              <option value="Transfer">Transferencia</option>
            </select>
          </div>
          {mode !== "manual" && (
            <div>
              <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Turno (ID, opcional)</label>
              <input
                type="number"
                min={1}
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value === "" ? "" : parseInt(e.target.value))}
                placeholder="ID de turno"
                data-testid="caja-movement-booking-id"
                className="form-input mt-1.5"
              />
            </div>
          )}
          <div>
            <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Monto</label>
            <input
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              required
              data-testid="caja-movement-amount"
              className="form-input mt-1.5"
            />
          </div>
          <div>
            <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Descripción (opcional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="caja-movement-description"
              className="form-input mt-1.5"
            />
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <Button type="submit" disabled={saving} data-testid="caja-movement-submit" variant="primary" className="w-full">
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
