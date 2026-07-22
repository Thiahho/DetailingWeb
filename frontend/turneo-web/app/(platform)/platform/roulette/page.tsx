"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/src/components/shared/Button";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";

const ESTADOS = [
  "Nuevo",
  "Contactado",
  "Conversando",
  "Interesado",
  "DemoSolicitada",
  "DemoRealizada",
  "SuscripcionIniciada",
  "Cliente",
  "NoResponde",
  "NoInteresado",
  "BeneficioVencido",
  "Perdido",
];

const PRIZE_TYPES = [
  "FreeMonths",
  "PercentOff",
  "FreeActivation",
  "FreeSetup",
  "SpecialBenefit",
  "CustomDemo",
];

interface RouletteLead {
  id: number;
  nombreNegocio: string;
  nombreResponsable: string | null;
  whatsApp: string;
  email: string | null;
  instagram: string | null;
  tipoNegocio: string | null;
  cantidadProfesionales: string | null;
  problemaPrincipal: string | null;
  premioNombre: string;
  codigoPromocional: string;
  fechaParticipacion: string;
  codigoVenceAt: string;
  fuente: string | null;
  campaign: string | null;
  estado: string;
  notas: string | null;
  fechaUltimoContacto: string | null;
}

interface Prize {
  id: number;
  name: string;
  description: string | null;
  type: string;
  value: number | null;
  durationMonths: number | null;
  probability: number;
  validityDays: number;
  codeSlug: string;
  isActive: boolean;
  leadsCount: number;
}

const emptyPrizeForm = {
  name: "",
  description: "",
  type: PRIZE_TYPES[0],
  value: "",
  durationMonths: "",
  probability: "",
  validityDays: "30",
  codeSlug: "",
  isActive: true,
};

export default function PlatformRoulettePage() {
  const { toasts, showToast, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [tab, setTab] = useState<"leads" | "premios">("leads");

  const [leads, setLeads] = useState<RouletteLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loadingPrizes, setLoadingPrizes] = useState(true);
  const [prizeForm, setPrizeForm] = useState(emptyPrizeForm);
  const [editingPrizeId, setEditingPrizeId] = useState<number | null>(null);
  const [savingPrize, setSavingPrize] = useState(false);

  const loadLeads = async () => {
    const res = await fetch("/api/platform/roulette/leads", { credentials: "include" });
    if (res.ok) setLeads(await res.json());
  };

  const loadPrizes = async () => {
    const res = await fetch("/api/platform/roulette/prizes", { credentials: "include" });
    if (res.ok) setPrizes(await res.json());
  };

  useEffect(() => {
    loadLeads().finally(() => setLoadingLeads(false));
    loadPrizes().finally(() => setLoadingPrizes(false));
  }, []);

  const handleStatusChange = async (id: number, estado: string) => {
    const previous = leads;
    setLeads(leads.map((l) => (l.id === id ? { ...l, estado } : l)));

    const res = await fetch(`/api/platform/roulette/leads/${id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });

    if (!res.ok) {
      setLeads(previous);
      showToast("error", "No se pudo actualizar el estado", "");
    }
  };

  const handleDeleteLead = async (lead: RouletteLead) => {
    const ok = await confirm({
      title: "Eliminar lead",
      message: `¿Eliminar la participación de "${lead.nombreNegocio}" (${lead.whatsApp})? También libera ese WhatsApp para una nueva participación.`,
      confirmLabel: "Eliminar",
      variant: "danger",
      theme: "dark",
    });
    if (!ok) return;

    const res = await fetch(`/api/platform/roulette/leads/${lead.id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (res.ok) {
      setLeads(leads.filter((l) => l.id !== lead.id));
      showToast("success", "Lead eliminado", "");
    } else {
      showToast("error", "No se pudo eliminar el lead", "");
    }
  };

  const startEditPrize = (prize: Prize) => {
    setEditingPrizeId(prize.id);
    setPrizeForm({
      name: prize.name,
      description: prize.description || "",
      type: prize.type,
      value: prize.value?.toString() || "",
      durationMonths: prize.durationMonths?.toString() || "",
      probability: prize.probability.toString(),
      validityDays: prize.validityDays.toString(),
      codeSlug: prize.codeSlug,
      isActive: prize.isActive,
    });
  };

  const cancelEditPrize = () => {
    setEditingPrizeId(null);
    setPrizeForm(emptyPrizeForm);
  };

  const handleSubmitPrize = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPrize(true);

    const body = {
      name: prizeForm.name.trim(),
      description: prizeForm.description.trim() || null,
      type: prizeForm.type,
      value: prizeForm.value ? Number(prizeForm.value) : null,
      durationMonths: prizeForm.durationMonths ? Number(prizeForm.durationMonths) : null,
      probability: Number(prizeForm.probability),
      validityDays: Number(prizeForm.validityDays),
      codeSlug: prizeForm.codeSlug.trim(),
      isActive: prizeForm.isActive,
    };

    try {
      const url = editingPrizeId
        ? `/api/platform/roulette/prizes/${editingPrizeId}`
        : "/api/platform/roulette/prizes";

      const res = await fetch(url, {
        method: editingPrizeId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast("error", "No se pudo guardar el premio", data.message || "");
        return;
      }

      showToast("success", editingPrizeId ? "Premio actualizado" : "Premio creado", "");
      cancelEditPrize();
      await loadPrizes();
    } catch {
      showToast("error", "Error de conexión", "");
    } finally {
      setSavingPrize(false);
    }
  };

  const activeProbabilitySum = prizes
    .filter((p) => p.isActive)
    .reduce((sum, p) => sum + p.probability, 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 text-white">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {ConfirmDialog}

      <div className="flex items-center gap-4 text-sm text-white/50">
        <Link href="/platform/tenants" className="hover:text-white">Tenants</Link>
        <span className="font-semibold text-white">Ruleta</span>
      </div>

      <h1 className="mt-2 text-2xl font-bold">Ruleta de Captación</h1>
      <p className="mt-1 text-sm text-white/50">
        Leads y catálogo de premios (docs/RULETA.pdf).
      </p>

      <div className="mt-6 flex gap-2 border-b border-white/10">
        <button
          onClick={() => setTab("leads")}
          className={`px-4 py-2 text-sm font-medium ${tab === "leads" ? "border-b-2 border-white text-white" : "text-white/50 hover:text-white"}`}
        >
          Leads
        </button>
        <button
          onClick={() => setTab("premios")}
          className={`px-4 py-2 text-sm font-medium ${tab === "premios" ? "border-b-2 border-white text-white" : "text-white/50 hover:text-white"}`}
        >
          Premios
        </button>
      </div>

      {tab === "leads" && (
        <div className="mt-6">
          {loadingLeads ? (
            <p className="text-sm text-white/50">Cargando...</p>
          ) : leads.length === 0 ? (
            <p className="text-sm text-white/50">Todavía no hay leads.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-left text-white/60">
                  <tr>
                    <th className="px-4 py-3">Negocio</th>
                    <th className="px-4 py-3">WhatsApp</th>
                    <th className="px-4 py-3">Premio</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Fuente</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-t border-white/10 align-top">
                      <td className="px-4 py-3">
                        <div>{l.nombreNegocio}</div>
                        {l.nombreResponsable && (
                          <div className="text-xs text-white/40">{l.nombreResponsable}</div>
                        )}
                        {l.tipoNegocio && (
                          <div className="text-xs text-white/40">{l.tipoNegocio}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        <div>{l.whatsApp}</div>
                        {l.email && <div className="text-xs text-white/40">{l.email}</div>}
                      </td>
                      <td className="px-4 py-3 text-white/70">{l.premioNombre}</td>
                      <td className="px-4 py-3 font-mono text-xs text-white/70">
                        {l.codigoPromocional}
                        <div className="text-white/40">
                          vence {new Date(l.codigoVenceAt).toLocaleDateString("es-AR")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/50">
                        <div>{l.fuente || "—"}</div>
                        {l.campaign && <div className="text-xs">{l.campaign}</div>}
                      </td>
                      <td className="px-4 py-3 text-white/50">
                        {new Date(l.fechaParticipacion).toLocaleDateString("es-AR")}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-white focus:border-white/30 focus:outline-none"
                          value={l.estado}
                          onChange={(e) => handleStatusChange(l.id, e.target.value)}
                        >
                          {ESTADOS.map((estado) => (
                            <option key={estado} value={estado} className="text-charcoal">
                              {estado}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteLead(l)}
                          className="text-xs font-medium text-red-400 hover:text-red-300"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "premios" && (
        <div className="mt-6 space-y-8">
          <form
            onSubmit={handleSubmitPrize}
            className="grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 sm:grid-cols-2"
          >
            <div className="space-y-1">
              <label className="text-xs font-medium text-white/60">Nombre</label>
              <input
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
                value={prizeForm.name}
                onChange={(e) => setPrizeForm({ ...prizeForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/60">Código (slug)</label>
              <input
                required
                placeholder="Ej: 2MESES"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
                value={prizeForm.codeSlug}
                onChange={(e) => setPrizeForm({ ...prizeForm, codeSlug: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-medium text-white/60">Descripción (opcional)</label>
              <input
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
                value={prizeForm.description}
                onChange={(e) => setPrizeForm({ ...prizeForm, description: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/60">Tipo</label>
              <select
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
                value={prizeForm.type}
                onChange={(e) => setPrizeForm({ ...prizeForm, type: e.target.value })}
              >
                {PRIZE_TYPES.map((t) => (
                  <option key={t} value={t} className="text-charcoal">{t}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/60">Valor (opcional)</label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
                value={prizeForm.value}
                onChange={(e) => setPrizeForm({ ...prizeForm, value: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/60">Duración en meses (opcional)</label>
              <input
                type="number"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
                value={prizeForm.durationMonths}
                onChange={(e) => setPrizeForm({ ...prizeForm, durationMonths: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/60">Probabilidad (%)</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                max="100"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
                value={prizeForm.probability}
                onChange={(e) => setPrizeForm({ ...prizeForm, probability: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/60">Vigencia (días)</label>
              <input
                required
                type="number"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
                value={prizeForm.validityDays}
                onChange={(e) => setPrizeForm({ ...prizeForm, validityDays: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="prize-active"
                checked={prizeForm.isActive}
                onChange={(e) => setPrizeForm({ ...prizeForm, isActive: e.target.checked })}
              />
              <label htmlFor="prize-active" className="text-sm text-white/70">
                Activo en la ruleta
              </label>
            </div>

            <div className="sm:col-span-2 flex gap-3">
              <Button type="submit" disabled={savingPrize} variant="primary" shape="pill">
                {savingPrize ? "Guardando..." : editingPrizeId ? "Guardar cambios" : "Crear premio"}
              </Button>
              {editingPrizeId && (
                <Button type="button" variant="secondary" shape="pill" onClick={cancelEditPrize}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Catálogo de premios</h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  activeProbabilitySum === 100
                    ? "bg-green-500/15 text-green-400"
                    : "bg-amber-500/15 text-amber-400"
                }`}
              >
                Suma de probabilidades activas: {activeProbabilitySum}%
              </span>
            </div>

            {loadingPrizes ? (
              <p className="mt-4 text-sm text-white/50">Cargando...</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-left text-white/60">
                    <tr>
                      <th className="px-4 py-3">Nombre</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Probabilidad</th>
                      <th className="px-4 py-3">Vigencia</th>
                      <th className="px-4 py-3">Entregados</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {prizes.map((p) => (
                      <tr key={p.id} className="border-t border-white/10">
                        <td className="px-4 py-3">
                          <div>{p.name}</div>
                          <div className="text-xs text-white/40 font-mono">{p.codeSlug}</div>
                        </td>
                        <td className="px-4 py-3 text-white/70">{p.type}</td>
                        <td className="px-4 py-3 text-white/70">{p.probability}%</td>
                        <td className="px-4 py-3 text-white/70">{p.validityDays} días</td>
                        <td className="px-4 py-3 text-white/70">{p.leadsCount}</td>
                        <td className="px-4 py-3">
                          <span className={p.isActive ? "text-green-400" : "text-white/40"}>
                            {p.isActive ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => startEditPrize(p)}
                            className="text-xs font-medium text-white/70 hover:text-white"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
