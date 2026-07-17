"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";

interface AutomationRule {
  id: number;
  name: string;
  triggerType: "ClientBirthday" | "ClientInactive";
  inactiveDays: number | null;
  clientLabel: string;
  messageTemplate: string;
  cooldownDays: number;
  isActive: boolean;
  createdAt: string;
  lastRunAt: string | null;
}

interface AutomationRuleExecution {
  customerName: string;
  customerPhone: string;
  executedAt: string;
  reminderStatus: "Pending" | "Sent" | "Failed" | "Cancelled" | "Unknown";
  sentAt: string | null;
}

const EXECUTION_STATUS_LABELS: Record<AutomationRuleExecution["reminderStatus"], string> = {
  Pending: "Pendiente de envío",
  Sent: "Enviado",
  Failed: "Falló el envío",
  Cancelled: "Cancelado",
  Unknown: "Desconocido",
};

const TRIGGER_LABELS: Record<AutomationRule["triggerType"], string> = {
  ClientBirthday: "Cumpleaños del cliente",
  ClientInactive: "Cliente inactivo",
};

const DEFAULT_CLIENT_LABEL: Record<AutomationRule["triggerType"], string> = {
  ClientBirthday: "tu cumpleaños",
  ClientInactive: "te extrañamos",
};

const emptyForm = {
  name: "",
  triggerType: "ClientBirthday" as AutomationRule["triggerType"],
  inactiveDays: 60,
  clientLabel: DEFAULT_CLIENT_LABEL.ClientBirthday,
  messageTemplate: "Hola {nombre}! 👋 Hace rato no te vemos, ¿te gustaría agendar un turno?",
  cooldownDays: 300,
  isActive: true,
};

export default function AutomatizacionesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [historyRule, setHistoryRule] = useState<AutomationRule | null>(null);
  const [executions, setExecutions] = useState<AutomationRuleExecution[]>([]);
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
      return;
    }
    loadRules();
  }, [router]);

  const loadRules = async () => {
    try {
      const res = await fetch("/api/automationrules");
      if (res.ok) setRules(await res.json());
    } catch (error) {
      logError("Error cargando reglas de automatización:", error);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingRule(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const openEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      triggerType: rule.triggerType,
      inactiveDays: rule.inactiveDays ?? 60,
      clientLabel: rule.clientLabel,
      messageTemplate: rule.messageTemplate,
      cooldownDays: rule.cooldownDays,
      isActive: rule.isActive,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRule(null);
    setFormData(emptyForm);
  };

  const handleTriggerChange = (triggerType: AutomationRule["triggerType"]) => {
    setFormData((prev) => ({
      ...prev,
      triggerType,
      // Sugerir un cooldown y un texto para el cliente razonables según el trigger,
      // solo si todavía no los tocaron (edición no pisa lo ya escrito).
      cooldownDays: triggerType === "ClientBirthday" ? 300 : 30,
      clientLabel:
        prev.clientLabel === "" || Object.values(DEFAULT_CLIENT_LABEL).includes(prev.clientLabel)
          ? DEFAULT_CLIENT_LABEL[triggerType]
          : prev.clientLabel,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      name: formData.name,
      triggerType: formData.triggerType,
      inactiveDays: formData.triggerType === "ClientInactive" ? formData.inactiveDays : null,
      clientLabel: formData.clientLabel,
      messageTemplate: formData.messageTemplate,
      cooldownDays: formData.cooldownDays,
      isActive: formData.isActive,
    };

    try {
      const url = editingRule ? `/api/automationrules/${editingRule.id}` : "/api/automationrules";
      const method = editingRule ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", editingRule ? "Regla actualizada" : "Regla creada", undefined, 3500);
        closeForm();
        loadRules();
      } else {
        showToast("error", "Error", data.error || "No se pudo guardar la regla");
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/automationrules/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("warning", "Regla eliminada", undefined, 3500);
        setDeleteConfirmId(null);
        loadRules();
      } else {
        showToast("error", "Error", "No se pudo eliminar la regla");
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
    }
  };

  const handleRunNow = async (rule: AutomationRule) => {
    setRunningId(rule.id);
    try {
      const res = await fetch(`/api/automationrules/${rule.id}/run-now`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const count = data.remindersCreated ?? 0;
        showToast(
          "success",
          "Regla evaluada",
          count > 0
            ? `Se crearon ${count} recordatorio(s) nuevo(s)`
            : "Nadie coincide con esta regla ahora mismo (o ya fue notificado recientemente)",
          5000
        );
        loadRules();
      } else {
        showToast("error", "Error", "No se pudo evaluar la regla");
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
    } finally {
      setRunningId(null);
    }
  };

  const openHistory = async (rule: AutomationRule) => {
    setHistoryRule(rule);
    setLoadingExecutions(true);
    try {
      const res = await fetch(`/api/automationrules/${rule.id}/executions`);
      if (res.ok) setExecutions(await res.json());
    } catch (error) {
      logError("Error cargando historial de envíos:", error);
    } finally {
      setLoadingExecutions(false);
    }
  };

  const closeHistory = () => {
    setHistoryRule(null);
    setExecutions([]);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando automatizaciones...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 md:mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Automatizaciones</h1>
            <p className="text-charcoal/50 text-sm mt-1">
              Reglas que avisan solas a tus clientes: cumpleaños, clientes inactivos, y lo que sumes después
            </p>
          </div>
          <button
            onClick={openCreate}
            data-testid="automation-rule-create-button"
            className="shrink-0 bg-blush hover:bg-blushdark text-white px-4 md:px-5 py-2.5 rounded-lg font-semibold shadow-glow transition flex items-center gap-2 text-sm md:text-base"
          >
            <span className="text-xl leading-none">+</span>
            <span className="hidden sm:inline">Nueva Regla</span>
            <span className="sm:hidden">Nueva</span>
          </button>
        </div>

        {/* Grid de reglas */}
        {rules.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-mauve/10 rounded-xl">
            <p className="text-charcoal/40 text-lg">No hay reglas de automatización cargadas</p>
            <button onClick={openCreate} className="mt-4 text-green-700 hover:text-green-700 transition text-sm">
              + Crear la primera
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                data-testid="automation-rule-card"
                data-rule-name={rule.name}
                className={`bg-ivory border rounded-xl p-4 transition ${
                  rule.isActive ? "border-mauve/15" : "border-orange-200 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-charcoal font-semibold text-[15px] leading-tight">{rule.name}</h3>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      rule.isActive ? "bg-green-500/20 text-green-700" : "bg-orange-500/20 text-orange-700"
                    }`}
                  >
                    {rule.isActive ? "ACTIVA" : "INACTIVA"}
                  </span>
                </div>

                <p className="text-charcoal/60 text-sm">{TRIGGER_LABELS[rule.triggerType]}</p>
                {rule.triggerType === "ClientInactive" && (
                  <p className="text-charcoal/40 text-xs mt-1">Sin reservar hace {rule.inactiveDays} día(s)</p>
                )}
                <p className="text-charcoal/40 text-xs mt-1">Espera {rule.cooldownDays} día(s) antes de reenviar</p>
                <p className="text-charcoal/40 text-xs mt-2">
                  Aparece al cliente como: <span className="text-charcoal/70">"{rule.clientLabel}"</span>
                </p>
                <p className="text-charcoal/30 text-xs mt-1 italic line-clamp-2">"{rule.messageTemplate}"</p>
                {rule.lastRunAt && (
                  <p className="text-charcoal/30 text-[11px] mt-2">
                    Última evaluación: {new Date(rule.lastRunAt).toLocaleString("es-AR")}
                  </p>
                )}

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={() => handleRunNow(rule)}
                    disabled={runningId === rule.id}
                    data-testid="automation-rule-run-now-button"
                    className="w-full bg-blue-600/20 border border-blue-600/50 hover:bg-blue-600/30 text-blue-700 text-sm py-2 rounded-lg transition disabled:opacity-50"
                  >
                    {runningId === rule.id ? "Evaluando..." : "Probar ahora"}
                  </button>
                  <button
                    onClick={() => openHistory(rule)}
                    data-testid="automation-rule-history-button"
                    className="w-full bg-porcelain/5 hover:bg-porcelain/10 text-charcoal/70 text-sm py-2 rounded-lg transition"
                  >
                    Ver envíos
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(rule)}
                      data-testid="automation-rule-edit-button"
                      className="flex-1 bg-porcelain/5 hover:bg-porcelain/10 text-charcoal text-sm py-2 rounded-lg transition"
                    >
                      Editar
                    </button>
                    {deleteConfirmId === rule.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="bg-red-600 hover:bg-red-500 text-charcoal text-sm px-3 py-2 rounded-lg transition"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="bg-porcelain/5 text-charcoal text-sm px-3 py-2 rounded-lg transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(rule.id)}
                        data-testid="automation-rule-delete-button"
                        className="bg-red-900/20 hover:bg-red-900/40 text-red-600 text-sm px-3 py-2 rounded-lg transition"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {rules.length > 1 && (
          <p className="text-charcoal/30 text-xs mt-6">
            Cada regla se evalúa de forma independiente — si dos reglas coinciden con el mismo cliente, puede
            recibir más de un mensaje.
          </p>
        )}
      </div>

      {/* Modal Formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={closeForm}>
          <div
            className="bg-ivory border border-mauve/10 rounded-2xl p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-charcoal">
                {editingRule ? "Editar Regla" : "Nueva Regla"}
              </h2>
              <button onClick={closeForm} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">
                  Nombre (interno, solo para vos)
                </label>
                <input
                  className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition"
                  data-testid="automation-rule-form-name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Regla winback 60 días"
                  required
                />
              </div>

              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Tipo de disparador</label>
                <select
                  className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition"
                  data-testid="automation-rule-form-trigger"
                  value={formData.triggerType}
                  onChange={(e) => handleTriggerChange(e.target.value as AutomationRule["triggerType"])}
                >
                  <option value="ClientBirthday">Cumpleaños del cliente</option>
                  <option value="ClientInactive">Cliente inactivo</option>
                </select>
              </div>

              {formData.triggerType === "ClientInactive" && (
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">
                    Días de inactividad
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition"
                    data-testid="automation-rule-form-inactive-days"
                    value={formData.inactiveDays}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, inactiveDays: parseInt(e.target.value) || 1 }))
                    }
                    required
                  />
                  <p className="text-charcoal/30 text-xs mt-1">
                    Se avisa a clientes que no reservaron en los últimos {formData.inactiveDays} día(s)
                  </p>
                </div>
              )}

              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">
                  Días de espera antes de reenviar
                </label>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition"
                  data-testid="automation-rule-form-cooldown"
                  value={formData.cooldownDays}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, cooldownDays: parseInt(e.target.value) || 1 }))
                  }
                  required
                />
                <p className="text-charcoal/30 text-xs mt-1">
                  Evita que el mismo cliente reciba este aviso más de una vez en ese período
                </p>
              </div>

              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">
                  Texto para el cliente
                </label>
                <input
                  className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition"
                  data-testid="automation-rule-form-client-label"
                  value={formData.clientLabel}
                  onChange={(e) => setFormData((prev) => ({ ...prev, clientLabel: e.target.value }))}
                  placeholder="tu cumpleaños"
                  required
                />
                <p className="text-charcoal/30 text-xs mt-1">
                  Distinto del "Nombre" de arriba (que es solo para vos): esto es lo que reemplaza a{" "}
                  {"{servicio}"} si lo usás en el mensaje, y queda visible para el cliente.
                </p>
              </div>

              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Mensaje</label>
                <textarea
                  className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition text-sm resize-none"
                  data-testid="automation-rule-form-message"
                  rows={4}
                  value={formData.messageTemplate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, messageTemplate: e.target.value }))}
                  placeholder="Hola {nombre}! ..."
                  required
                />
                <p className="text-charcoal/30 text-xs mt-1">
                  Podés usar {"{nombre}"} para el nombre del cliente y {"{servicio}"} para el texto de arriba
                </p>
              </div>

              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Estado</label>
                <select
                  className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition"
                  value={formData.isActive ? "true" : "false"}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.value === "true" }))}
                >
                  <option value="true">Activa</option>
                  <option value="false">Inactiva</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  data-testid="automation-rule-form-submit"
                  className="flex-1 bg-blush hover:bg-blushdark text-white py-3 rounded-lg font-semibold shadow-glow transition disabled:opacity-50"
                >
                  {saving ? "Guardando..." : editingRule ? "Guardar cambios" : "Crear regla"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-6 bg-porcelain/5 text-charcoal py-3 rounded-lg font-semibold hover:bg-porcelain/10 transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Historial de envíos */}
      {historyRule && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={closeHistory}>
          <div
            className="bg-ivory border border-mauve/10 rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-bold text-charcoal">Envíos de "{historyRule.name}"</h2>
              <button onClick={closeHistory} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>
            <p className="text-charcoal/40 text-xs mb-5">A quién le disparó esta regla y si el mensaje salió</p>

            {loadingExecutions ? (
              <p className="text-charcoal/50 text-sm">Cargando...</p>
            ) : executions.length === 0 ? (
              <p className="text-charcoal/30 text-sm">
                Todavía no le disparó a nadie. Probá "Probar ahora" si esperabas que alguien coincida.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="text-left text-charcoal/40 text-xs uppercase tracking-wider border-b border-mauve/10">
                      <th className="pb-2 pr-3 font-medium">Cliente</th>
                      <th className="pb-2 pr-3 font-medium">Disparado</th>
                      <th className="pb-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.map((ex, i) => (
                      <tr key={i} className="border-b border-mauve/5 last:border-0">
                        <td className="py-3 pr-3">
                          <span className="text-charcoal font-medium">{ex.customerName}</span>
                          <span className="block text-charcoal/40 text-xs">{ex.customerPhone}</span>
                        </td>
                        <td className="py-3 pr-3 text-charcoal/60 whitespace-nowrap">
                          {new Date(ex.executedAt).toLocaleString("es-AR")}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              ex.reminderStatus === "Sent"
                                ? "bg-green-500/20 text-green-700"
                                : ex.reminderStatus === "Failed"
                                ? "bg-red-500/20 text-red-600"
                                : ex.reminderStatus === "Pending"
                                ? "bg-orange-500/20 text-orange-700"
                                : "bg-porcelain/10 text-charcoal/40"
                            }`}
                          >
                            {EXECUTION_STATUS_LABELS[ex.reminderStatus]}
                          </span>
                          {ex.sentAt && (
                            <span className="block text-charcoal/30 text-[11px] mt-1">
                              {new Date(ex.sentAt).toLocaleString("es-AR")}
                            </span>
                          )}
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
