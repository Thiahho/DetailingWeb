"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { Button } from "@/src/components/shared/Button";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

interface LoyaltyPrize {
  id: number;
  name: string;
  description: string | null;
  type: string;
  value: number | null;
  probability: number;
  validityDays: number;
  isActive: boolean;
  order: number;
  spinsCount: number;
}

interface LoyaltySpin {
  id: number;
  customerName: string;
  whatsApp: string;
  prizeName: string;
  code: string;
  spunAt: string;
  expiresAt: string;
  status: string;
  redeemedAt: string | null;
}

const PRIZE_TYPES = [
  { value: "PercentOff", label: "% de descuento" },
  { value: "FreeAddOn", label: "Servicio adicional gratis" },
  { value: "FreeProduct", label: "Producto de regalo" },
  { value: "TwoForOne", label: "2x1" },
  { value: "Custom", label: "Otro" },
];

const emptyForm = {
  name: "",
  description: "",
  type: "PercentOff",
  value: "",
  probability: "20",
  validityDays: 30,
  isActive: true,
  order: 0,
};

const STATUS_LABEL: Record<string, string> = {
  Pending: "Pendiente",
  Redeemed: "Canjeado",
  Expired: "Vencido",
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function RuletaAdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"premios" | "giros">("premios");
  const [prizes, setPrizes] = useState<LoyaltyPrize[]>([]);
  const [spins, setSpins] = useState<LoyaltySpin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPrize, setEditingPrize] = useState<LoyaltyPrize | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [redeemCode, setRedeemCode] = useState("");
  const { toasts, showToast, removeToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const closeForm = () => setShowForm(false);
  useModalHotkeys(showForm, { onClose: closeForm, onSubmit: () => formRef.current?.requestSubmit() });

  const loadPrizes = useCallback(async () => {
    const res = await fetch("/api/loyalty-roulette/prizes/all");
    const data = await res.json();
    if (res.ok) setPrizes(Array.isArray(data) ? data : []);
  }, []);

  const loadSpins = useCallback(async () => {
    const res = await fetch("/api/loyalty-roulette/spins");
    const data = await res.json();
    if (res.ok) setSpins(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
      return;
    }
    Promise.all([loadPrizes(), loadSpins()]).finally(() => setLoading(false));
  }, [router, loadPrizes, loadSpins]);

  const openCreate = () => {
    setEditingPrize(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const openEdit = (prize: LoyaltyPrize) => {
    setEditingPrize(prize);
    setFormData({
      name: prize.name,
      description: prize.description || "",
      type: prize.type,
      value: prize.value?.toString() || "",
      probability: prize.probability.toString(),
      validityDays: prize.validityDays,
      isActive: prize.isActive,
      order: prize.order,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingPrize ? `/api/loyalty-roulette/prizes/${editingPrize.id}` : "/api/loyalty-roulette/prizes";
    const method = editingPrize ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.name,
        description: formData.description || null,
        type: formData.type,
        value: formData.value ? Number(formData.value) : null,
        probability: Number(formData.probability),
        validityDays: Number(formData.validityDays),
        isActive: formData.isActive,
        order: Number(formData.order),
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast("error", "Error", data.message || "No se pudo guardar");
      return;
    }

    showToast("success", editingPrize ? "Premio actualizado" : "Premio creado");
    setShowForm(false);
    setEditingPrize(null);
    setFormData(emptyForm);
    loadPrizes();
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCode.trim()) return;

    const res = await fetch("/api/loyalty-roulette/spins/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: redeemCode.trim() }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast("error", "No se pudo canjear", data.message || "Revisá el código");
      return;
    }

    showToast("success", "Beneficio canjeado");
    setRedeemCode("");
    loadSpins();
  };

  const totalProbability = prizes.filter((p) => p.isActive).reduce((sum, p) => sum + p.probability, 0);

  if (loading) return <div className="p-6 text-charcoal">Cargando ruleta...</div>;

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-charcoal">Ruleta de beneficios</h1>
          <p className="text-charcoal/50 text-sm">
            Ofrecésela a tus clientes para que ganen un beneficio y vuelvan por más.
          </p>
        </div>

        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setTab("premios")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${tab === "premios" ? "bg-blush text-cream" : "bg-porcelain/5 text-charcoal/50 hover:text-charcoal"}`}
          >
            Premios
          </button>
          <button
            onClick={() => setTab("giros")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${tab === "giros" ? "bg-blush text-cream" : "bg-porcelain/5 text-charcoal/50 hover:text-charcoal"}`}
          >
            Giros y canje
          </button>
        </div>

        {tab === "premios" && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className={`text-xs ${totalProbability === 100 ? "text-charcoal/40" : "text-champagne"}`}>
                Suma de probabilidad de premios activos: {totalProbability}% {totalProbability !== 100 && "(debería dar 100%)"}
              </p>
              <Button onClick={openCreate} variant="primary">
                + Nuevo premio
              </Button>
            </div>

            {prizes.length === 0 ? (
              <div className="glass-card p-8 text-center text-sm text-charcoal/60">
                Todavía no cargaste ningún premio. Creá el primero para activar la ruleta en /beneficios.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {prizes.map((prize) => (
                  <div key={prize.id} className="rounded-xl border border-mauve/40 bg-ivory p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-charcoal">{prize.name}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${prize.isActive ? "bg-blush/15 text-blush" : "bg-porcelain/10 text-charcoal/40"}`}>
                        {prize.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    {prize.description && <p className="mt-1 text-xs text-charcoal/60">{prize.description}</p>}
                    <p className="mt-2 text-xs text-charcoal/50">
                      Probabilidad: {prize.probability}% · Vigencia: {prize.validityDays} días
                    </p>
                    <p className="text-xs text-charcoal/50">Entregado {prize.spinsCount} {prize.spinsCount === 1 ? "vez" : "veces"}</p>
                    <div className="mt-3 flex gap-2">
                      <Button onClick={() => openEdit(prize)} variant="secondary" size="sm" className="flex-1">Editar</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "giros" && (
          <>
            <form onSubmit={handleRedeem} className="glass-card mb-6 flex flex-wrap items-end gap-3 p-4">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-charcoal/60">Canjear código en el mostrador</label>
                <input
                  className="form-input"
                  placeholder="BENEFICIO-XXXXXX"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value)}
                />
              </div>
              <Button type="submit" variant="primary">Canjear</Button>
            </form>

            <div className="overflow-x-auto rounded-xl border border-mauve/40 bg-ivory">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mauve/40 text-left text-xs uppercase tracking-wide text-charcoal/40">
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Premio</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Ganado</th>
                    <th className="px-4 py-3">Vence</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {spins.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-charcoal/50">
                        Todavía nadie giró la ruleta.
                      </td>
                    </tr>
                  ) : (
                    spins.map((spin) => (
                      <tr key={spin.id} className="border-b border-mauve/20 last:border-0">
                        <td className="px-4 py-3 text-charcoal">
                          {spin.customerName}
                          <span className="block text-xs text-charcoal/40">{spin.whatsApp}</span>
                        </td>
                        <td className="px-4 py-3 text-charcoal/70">{spin.prizeName}</td>
                        <td className="px-4 py-3 font-mono text-xs text-blush">{spin.code}</td>
                        <td className="px-4 py-3 text-charcoal/50">{formatFecha(spin.spunAt)}</td>
                        <td className="px-4 py-3 text-charcoal/50">{formatFecha(spin.expiresAt)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              spin.status === "Redeemed"
                                ? "bg-blush/15 text-blush"
                                : spin.status === "Expired"
                                ? "bg-champagne/10 text-champagne"
                                : "bg-porcelain/10 text-charcoal/60"
                            }`}
                          >
                            {STATUS_LABEL[spin.status] || spin.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <form ref={formRef} onSubmit={handleSubmit} className="w-full max-w-lg space-y-4 rounded-xl bg-ivory p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-charcoal">{editingPrize ? "Editar premio" : "Nuevo premio"}</h2>

            <div>
              <label className="text-xs text-charcoal/60">Nombre (así se ve en la rueda)</label>
              <input
                className="form-input mt-1"
                placeholder="Ej: 10% OFF PRÓXIMO CORTE"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="text-xs text-charcoal/60">Descripción (opcional)</label>
              <input
                className="form-input mt-1"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-charcoal/60">Tipo</label>
                <select
                  className="form-input mt-1"
                  value={formData.type}
                  onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))}
                >
                  {PRIZE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-charcoal/60">Valor (% o $, opcional)</label>
                <input
                  type="number"
                  className="form-input mt-1"
                  value={formData.value}
                  onChange={(e) => setFormData((p) => ({ ...p, value: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-charcoal/60">Probabilidad (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="form-input mt-1"
                  value={formData.probability}
                  onChange={(e) => setFormData((p) => ({ ...p, probability: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-charcoal/60">Vigencia (días)</label>
                <input
                  type="number"
                  className="form-input mt-1"
                  value={formData.validityDays}
                  onChange={(e) => setFormData((p) => ({ ...p, validityDays: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="text-xs text-charcoal/60">Orden en la rueda</label>
                <input
                  type="number"
                  className="form-input mt-1"
                  value={formData.order}
                  onChange={(e) => setFormData((p) => ({ ...p, order: Number(e.target.value) }))}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
              />
              Activo (aparece en la rueda)
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" onClick={closeForm} variant="secondary">Cancelar</Button>
              <Button type="submit" variant="primary">Guardar</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
