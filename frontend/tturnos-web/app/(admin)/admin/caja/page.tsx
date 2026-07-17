"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";

type MovementType = "Charge" | "Deposit" | "Refund" | "ManualIn" | "ManualOut";
type MovementMethod = "Cash" | "Transfer";
type MovementMode = "charge" | "refund" | "manual";

interface CajaMovementRecord {
  id: number;
  type: MovementType;
  method: MovementMethod;
  amount: number;
  bookingId?: number | null;
  description?: string | null;
  createdAt: string;
}

interface CajaTotals {
  chargeTotal: number;
  depositTotal: number;
  refundTotal: number;
  transferTotal: number;
  manualTotal: number;
}

interface CurrentSession {
  open: boolean;
  id?: number;
  openedAt?: string;
  openingCashBalance?: number;
  expectedCash?: number;
  totals?: CajaTotals;
  movements?: CajaMovementRecord[];
}

interface PendingBooking {
  bookingId: number;
  customerName: string;
  subject: string;
  startDateTime: string;
  itemsTotal: number;
  alreadyCharged: number;
  balance: number;
}

interface MonthlySession {
  id: number;
  openedAt: string;
  closedAt: string;
  openingCashBalance: number;
  expectedCash: number;
  closingCashCounted?: number | null;
  difference: number;
  totals: CajaTotals;
}

interface MonthlyReport {
  sessions: MonthlySession[];
  mercadoPagoTotal: number;
  totalCharges: number;
  totalDeposits: number;
  totalRefunds: number;
  totalTransfers: number;
  totalDifference: number;
}

function formatMoney(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("es-AR")}`;
}

function formatDateTime(iso: string) {
  const clean = iso.replace("Z", "");
  const [datePart, timePart] = clean.split("T");
  const [year, month, day] = datePart.split("-");
  const [hours, minutes] = (timePart ?? "00:00").split(":");
  return `${day}/${month} ${hours}:${minutes}`;
}

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

function MovementModal({
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
        <form onSubmit={submit} className="space-y-3">
          {typeOptions.length > 1 && (
            <div>
              <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as MovementType)}
                data-testid="caja-movement-type"
                className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-2.5 text-charcoal focus:border-green-500 focus:outline-none"
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
              className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-2.5 text-charcoal focus:border-green-500 focus:outline-none"
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
                className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-2.5 text-charcoal focus:border-green-500 focus:outline-none"
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
              className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-2.5 text-charcoal focus:border-green-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Descripción (opcional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="caja-movement-description"
              className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-2.5 text-charcoal focus:border-green-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            data-testid="caja-movement-submit"
            className="w-full bg-blush hover:bg-blushdark text-white py-2.5 rounded-lg font-semibold shadow-glow transition disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </div>
    </div>
  );
}

function CloseCajaModal({
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
    const diffColor = result.difference === 0 ? "text-green-700" : result.difference > 0 ? "text-blue-700" : "text-red-600";
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-ivory border border-mauve/10 rounded-2xl p-6 max-w-sm w-full text-center">
          <p className="text-charcoal font-semibold mb-2">Caja cerrada</p>
          <p className="text-charcoal/50 text-xs mb-1">Diferencia (contado − esperado)</p>
          <p data-testid="caja-close-difference" className={`text-2xl font-bold ${diffColor}`}>
            {result.difference === 0 ? "Sin diferencia" : `${result.difference > 0 ? "+" : ""}${formatMoney(result.difference)}`}
          </p>
          <button onClick={onClosed} className="mt-4 w-full bg-blush hover:bg-blushdark text-white py-2.5 rounded-lg font-semibold transition">
            Listo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-ivory border border-mauve/10 rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-charcoal mb-1">Cerrar caja</h2>
        <p className="text-charcoal/50 text-sm mb-4">Efectivo esperado: {formatMoney(expectedCash)}</p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Efectivo contado</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={counted}
              onChange={(e) => setCounted(parseFloat(e.target.value) || 0)}
              data-testid="caja-close-counted"
              className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-2.5 text-charcoal focus:border-green-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-2.5 text-charcoal text-sm resize-none focus:border-green-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            data-testid="caja-close-submit"
            className="w-full bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {saving ? "Cerrando..." : "Confirmar cierre"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CajaAdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"diaria" | "mensual">("diaria");
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<CurrentSession | null>(null);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [opening, setOpening] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [movementModal, setMovementModal] = useState<{ mode: MovementMode; bookingId?: number; amount?: number } | null>(null);
  const { toasts, showToast, removeToast } = useToast();

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  const loadCurrent = useCallback(async () => {
    try {
      const res = await fetch("/api/caja/current");
      if (res.ok) setSession(await res.json());
    } catch (error) {
      logError("Error cargando caja:", error);
    }
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const res = await fetch("/api/caja/pending-bookings");
      if (res.ok) setPendingBookings(await res.json());
    } catch (error) {
      logError("Error cargando turnos pendientes:", error);
    }
  }, []);

  const loadMonthly = useCallback(async (value: string) => {
    setLoadingMonthly(true);
    const [year, m] = value.split("-").map(Number);
    try {
      const res = await fetch(`/api/caja/sessions?year=${year}&month=${m}`);
      if (res.ok) setMonthlyReport(await res.json());
    } catch (error) {
      logError("Error cargando caja mensual:", error);
    } finally {
      setLoadingMonthly(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
      return;
    }
    Promise.all([loadCurrent(), loadPending()]).finally(() => setLoading(false));
  }, [router, loadCurrent, loadPending]);

  useEffect(() => {
    if (tab === "mensual") loadMonthly(month);
  }, [tab, month, loadMonthly]);

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpening(true);
    try {
      const res = await fetch("/api/caja/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingCashBalance: openingBalance }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", "Caja abierta");
        setOpeningBalance(0);
        loadCurrent();
      } else {
        showToast("error", "Error", data.message || "No se pudo abrir la caja");
      }
    } finally {
      setOpening(false);
    }
  };

  const afterMovementSaved = (message: string) => {
    showToast("success", message);
    loadCurrent();
    loadPending();
  };

  const afterClosed = () => {
    setCloseModalOpen(false);
    loadCurrent();
    loadPending();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando caja...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Caja</h1>
          <p className="text-charcoal/50 text-sm mt-1">Cobros, señas, devoluciones y cierre diario</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("diaria")}
            data-testid="caja-tab-diaria"
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${tab === "diaria" ? "bg-white text-black" : "bg-porcelain/5 text-charcoal/50 hover:text-charcoal"}`}
          >
            Caja diaria
          </button>
          <button
            onClick={() => setTab("mensual")}
            data-testid="caja-tab-mensual"
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${tab === "mensual" ? "bg-white text-black" : "bg-porcelain/5 text-charcoal/50 hover:text-charcoal"}`}
          >
            Caja mensual
          </button>
        </div>

        {tab === "diaria" && (
          <>
            {!session?.open ? (
              <div className="bg-ivory border border-mauve/5 rounded-2xl p-6 max-w-sm">
                <h2 className="text-charcoal font-semibold mb-3">Abrir caja</h2>
                <form onSubmit={handleOpen} className="space-y-3">
                  <div>
                    <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Saldo inicial en efectivo</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                      data-testid="caja-open-balance-input"
                      className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-2.5 text-charcoal focus:border-green-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={opening}
                    data-testid="caja-open-submit"
                    className="w-full bg-blush hover:bg-blushdark text-white py-2.5 rounded-lg font-semibold shadow-glow transition disabled:opacity-50"
                  >
                    {opening ? "Abriendo..." : "Abrir caja"}
                  </button>
                </form>
              </div>
            ) : (
              <>
                {/* Totales */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                  <div className="bg-ivory border border-mauve/5 rounded-xl p-3 text-center">
                    <p data-testid="caja-expected-cash" className="text-lg md:text-xl font-bold text-charcoal">{formatMoney(session.expectedCash ?? 0)}</p>
                    <p className="text-charcoal/40 text-[11px] mt-1">Efectivo esperado</p>
                  </div>
                  <div className="bg-ivory border border-mauve/5 rounded-xl p-3 text-center">
                    <p className="text-lg md:text-xl font-bold text-emerald-700">{formatMoney(session.totals?.chargeTotal ?? 0)}</p>
                    <p className="text-charcoal/40 text-[11px] mt-1">Cobros</p>
                  </div>
                  <div className="bg-ivory border border-mauve/5 rounded-xl p-3 text-center">
                    <p className="text-lg md:text-xl font-bold text-blue-700">{formatMoney(session.totals?.depositTotal ?? 0)}</p>
                    <p className="text-charcoal/40 text-[11px] mt-1">Señas</p>
                  </div>
                  <div className="bg-ivory border border-mauve/5 rounded-xl p-3 text-center">
                    <p className="text-lg md:text-xl font-bold text-charcoal">{formatMoney(session.totals?.transferTotal ?? 0)}</p>
                    <p className="text-charcoal/40 text-[11px] mt-1">Transferencias</p>
                  </div>
                  <div className="bg-ivory border border-mauve/5 rounded-xl p-3 text-center">
                    <p className="text-lg md:text-xl font-bold text-red-600">{formatMoney(session.totals?.refundTotal ?? 0)}</p>
                    <p className="text-charcoal/40 text-[11px] mt-1">Devoluciones</p>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <button
                    onClick={() => setMovementModal({ mode: "charge" })}
                    data-testid="caja-action-charge"
                    className="bg-blush hover:bg-blushdark text-white px-4 py-2 rounded-lg font-semibold text-sm transition"
                  >
                    Cobrar turno
                  </button>
                  <button
                    onClick={() => setMovementModal({ mode: "refund" })}
                    data-testid="caja-action-refund"
                    className="bg-porcelain/10 hover:bg-porcelain/20 text-charcoal px-4 py-2 rounded-lg font-semibold text-sm transition"
                  >
                    Devolución
                  </button>
                  <button
                    onClick={() => setMovementModal({ mode: "manual" })}
                    data-testid="caja-action-manual"
                    className="bg-porcelain/10 hover:bg-porcelain/20 text-charcoal px-4 py-2 rounded-lg font-semibold text-sm transition"
                  >
                    Movimiento manual
                  </button>
                  <button
                    onClick={() => setCloseModalOpen(true)}
                    data-testid="caja-action-close"
                    className="ml-auto bg-red-900/20 hover:bg-red-900/40 text-red-600 px-4 py-2 rounded-lg font-semibold text-sm transition"
                  >
                    Cerrar caja
                  </button>
                </div>

                {/* Turnos con saldo pendiente */}
                {pendingBookings.some((b) => b.balance > 0) && (
                  <div className="mb-6">
                    <h2 className="text-charcoal font-semibold mb-2 text-sm">Turnos con saldo pendiente</h2>
                    <div className="bg-ivory border border-mauve/5 rounded-2xl overflow-hidden">
                      {pendingBookings.filter((b) => b.balance > 0).map((b) => (
                        <div
                          key={b.bookingId}
                          data-testid="caja-pending-row"
                          data-booking-id={b.bookingId}
                          className="flex items-center justify-between gap-3 px-4 py-3 border-b border-mauve/5 last:border-0"
                        >
                          <div>
                            <p className="text-charcoal text-sm font-medium">{b.customerName}</p>
                            <p className="text-charcoal/40 text-xs">{b.subject} · {formatDateTime(b.startDateTime)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-charcoal/70 text-sm font-semibold">{formatMoney(b.balance)}</span>
                            <button
                              onClick={() => setMovementModal({ mode: "charge", bookingId: b.bookingId, amount: b.balance })}
                              data-testid="caja-pending-charge-button"
                              className="bg-porcelain/10 hover:bg-porcelain/20 text-charcoal text-xs px-3 py-1.5 rounded-lg transition"
                            >
                              Cobrar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Movimientos */}
                <div>
                  <h2 className="text-charcoal font-semibold mb-2 text-sm">Movimientos de hoy</h2>
                  {(session.movements ?? []).length === 0 ? (
                    <div className="bg-ivory border border-mauve/5 rounded-2xl py-10 text-center text-charcoal/30 text-sm">
                      Sin movimientos todavía
                    </div>
                  ) : (
                    <div className="bg-ivory border border-mauve/5 rounded-2xl overflow-hidden">
                      {(session.movements ?? []).map((m) => (
                        <div key={m.id} data-testid="caja-movement-row" className="flex items-center justify-between gap-3 px-4 py-3 border-b border-mauve/5 last:border-0 text-sm">
                          <div>
                            <span className="text-charcoal font-medium">{movementTypeLabel(m.type)}</span>
                            <span className="text-charcoal/40 text-xs ml-2">{m.method === "Cash" ? "Efectivo" : "Transferencia"}</span>
                            {m.bookingId && <span className="text-charcoal/30 text-xs ml-2">Turno #{m.bookingId}</span>}
                            {m.description && <p className="text-charcoal/30 text-xs mt-0.5">{m.description}</p>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-charcoal/40 text-xs">{formatDateTime(m.createdAt)}</span>
                            <span className={`font-semibold ${m.type === "Refund" || m.type === "ManualOut" ? "text-red-600" : "text-emerald-700"}`}>
                              {m.type === "Refund" || m.type === "ManualOut" ? "-" : "+"}{formatMoney(m.amount)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {tab === "mensual" && (
          <div>
            <div className="mb-4">
              <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Mes</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                data-testid="caja-monthly-month"
                className="block mt-1.5 bg-cream border border-mauve/10 rounded-lg p-2.5 text-charcoal focus:border-green-500 focus:outline-none"
              />
            </div>

            {loadingMonthly ? (
              <p className="text-charcoal/40 text-sm">Cargando...</p>
            ) : monthlyReport && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
                  <div className="bg-ivory border border-mauve/5 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-emerald-700">{formatMoney(monthlyReport.totalCharges + monthlyReport.totalDeposits)}</p>
                    <p className="text-charcoal/40 text-[11px] mt-1">Cobros + señas (efectivo/transf.)</p>
                  </div>
                  <div className="bg-ivory border border-mauve/5 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-charcoal">{formatMoney(monthlyReport.mercadoPagoTotal)}</p>
                    <p className="text-charcoal/40 text-[11px] mt-1">Mercado Pago (online)</p>
                  </div>
                  <div className="bg-ivory border border-mauve/5 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-red-600">{formatMoney(monthlyReport.totalRefunds)}</p>
                    <p className="text-charcoal/40 text-[11px] mt-1">Devoluciones</p>
                  </div>
                </div>

                {monthlyReport.sessions.length === 0 ? (
                  <div className="bg-ivory border border-mauve/5 rounded-2xl py-10 text-center text-charcoal/30 text-sm">
                    Sin cajas cerradas en este mes
                  </div>
                ) : (
                  <div className="bg-ivory border border-mauve/5 rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-mauve/5 text-charcoal/30 text-xs uppercase tracking-wider">
                          <th className="text-left px-4 py-2.5 font-medium">Apertura</th>
                          <th className="text-left px-4 py-2.5 font-medium">Cierre</th>
                          <th className="text-left px-4 py-2.5 font-medium">Esperado</th>
                          <th className="text-left px-4 py-2.5 font-medium">Contado</th>
                          <th className="text-left px-4 py-2.5 font-medium">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyReport.sessions.map((s) => (
                          <tr key={s.id} data-testid="caja-monthly-row" className="border-b border-mauve/5 last:border-0">
                            <td className="px-4 py-3 text-charcoal/70 font-mono text-xs">{formatDateTime(s.openedAt)}</td>
                            <td className="px-4 py-3 text-charcoal/70 font-mono text-xs">{formatDateTime(s.closedAt)}</td>
                            <td className="px-4 py-3 text-charcoal">{formatMoney(s.expectedCash)}</td>
                            <td className="px-4 py-3 text-charcoal">{formatMoney(s.closingCashCounted ?? 0)}</td>
                            <td className={`px-4 py-3 font-semibold ${s.difference === 0 ? "text-charcoal/50" : s.difference > 0 ? "text-blue-700" : "text-red-600"}`}>
                              {s.difference > 0 ? "+" : ""}{formatMoney(s.difference)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {movementModal && (
        <MovementModal
          mode={movementModal.mode}
          initialBookingId={movementModal.bookingId}
          initialAmount={movementModal.amount}
          onClose={() => setMovementModal(null)}
          onSaved={afterMovementSaved}
        />
      )}

      {closeModalOpen && (
        <CloseCajaModal
          expectedCash={session?.expectedCash ?? 0}
          onClose={() => setCloseModalOpen(false)}
          onClosed={afterClosed}
        />
      )}
    </div>
  );
}
