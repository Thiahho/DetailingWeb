"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { Button } from "@/src/components/shared/Button";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

interface SmartTag {
  id: number;
  name: string;
  location: string | null;
  action: "BOOKING" | "REBOOK" | "REVIEW" | "WHATSAPP" | "INSTAGRAM";
  isActive: boolean;
  token: string;
  smartLinkUrl: string;
  createdAt: string;
  updatedAt: string;
}

interface SmartTagAnalytics {
  smartTagId: number;
  interactions: number;
  completions: number;
  conversionRate: number;
}

interface AnalyticsSummary {
  totalInteractions: number;
  totalCompletions: number;
  conversionRate: number;
  tags: SmartTagAnalytics[];
}

const ACTION_LABELS: Record<SmartTag["action"], string> = {
  BOOKING: "Reservar turno",
  REBOOK: "Volver a reservar",
  REVIEW: "Dejar reseña",
  WHATSAPP: "Ir a WhatsApp",
  INSTAGRAM: "Ir a Instagram",
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-ivory border border-mauve/5 rounded-xl p-3 sm:p-5">
      <p className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className="text-xl sm:text-3xl font-bold mt-2 text-charcoal">{value}</p>
      {sub && <p className="text-charcoal/40 text-xs mt-1">{sub}</p>}
    </div>
  );
}

const emptyForm = {
  name: "",
  location: "",
  action: "BOOKING" as SmartTag["action"],
};

export default function SmartTagsPage() {
  const router = useRouter();
  const [tags, setTags] = useState<SmartTag[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTag, setEditingTag] = useState<SmartTag | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
      return;
    }
    loadTags();
    loadAnalytics();
  }, [router]);

  const loadTags = async () => {
    try {
      const res = await fetch("/api/smart-tags");
      if (res.ok) setTags(await res.json());
    } catch (error) {
      logError("Error cargando Smart Tags:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const res = await fetch("/api/smart-tags/analytics");
      if (res.ok) setAnalytics(await res.json());
    } catch (error) {
      logError("Error cargando analytics de Smart Tags:", error);
    }
  };

  const openCreate = () => {
    setEditingTag(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const openEdit = (tag: SmartTag) => {
    setEditingTag(tag);
    setFormData({ name: tag.name, location: tag.location ?? "", action: tag.action });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTag(null);
    setFormData(emptyForm);
  };

  const formRef = useRef<HTMLFormElement>(null);
  useModalHotkeys(showForm, { onClose: closeForm, onSubmit: () => formRef.current?.requestSubmit() });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      name: formData.name,
      location: formData.location || null,
      action: formData.action,
    };

    try {
      const url = editingTag ? `/api/smart-tags/${editingTag.id}` : "/api/smart-tags";
      const method = editingTag ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", editingTag ? "Smart Tag actualizada" : "Smart Tag creada", undefined, 3500);
        closeForm();
        loadTags();
      } else {
        showToast("error", "Error", data.error || "No se pudo guardar la Smart Tag");
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (tag: SmartTag) => {
    setTogglingId(tag.id);
    try {
      const res = await fetch(`/api/smart-tags/${tag.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !tag.isActive }),
      });
      if (res.ok) {
        loadTags();
      } else {
        showToast("error", "Error", "No se pudo cambiar el estado de la Smart Tag");
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/smart-tags/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("warning", "Smart Tag eliminada", undefined, 3500);
        setDeleteConfirmId(null);
        loadTags();
      } else {
        showToast("error", "Error", "No se pudo eliminar la Smart Tag");
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast("success", "Link copiado", undefined, 2500);
    } catch {
      showToast("error", "No se pudo copiar", "Copiá el link manualmente");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando Smart Tags...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="mx-auto max-w-6xl">
        <div className="mb-6 md:mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Smart Tags</h1>
            <p className="text-charcoal/50 text-sm mt-1">
              Etiquetas NFC/QR que convierten una interacción física en una acción digital medible
            </p>
          </div>
          <Button onClick={openCreate} variant="primary" className="shrink-0 flex items-center gap-2">
            <span className="text-xl leading-none">+</span>
            <span className="hidden sm:inline">Nueva Smart Tag</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
        </div>

        {analytics && tags.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6 md:mb-8">
            <StatCard label="Interacciones" value={analytics.totalInteractions} />
            <StatCard label="Completadas" value={analytics.totalCompletions} sub="reservas o reseñas" />
            <StatCard label="Conversión" value={`${analytics.conversionRate}%`} />
          </div>
        )}

        {tags.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-mauve/10 rounded-xl">
            <p className="text-charcoal/40 text-lg">No hay Smart Tags cargadas</p>
            <button onClick={openCreate} className="mt-4 text-blushdark hover:text-blush transition text-sm">
              + Crear la primera
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tags.map((tag) => {
              const tagAnalytics = analytics?.tags.find((a) => a.smartTagId === tag.id);
              return (
              <div
                key={tag.id}
                className={`bg-ivory border rounded-xl p-4 transition ${
                  tag.isActive ? "border-mauve/15" : "border-orange-200 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-charcoal font-semibold text-[15px] leading-tight">{tag.name}</h3>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      tag.isActive ? "bg-green-500/20 text-green-700" : "bg-orange-500/20 text-orange-700"
                    }`}
                  >
                    {tag.isActive ? "ACTIVA" : "INACTIVA"}
                  </span>
                </div>

                {tag.location && <p className="text-charcoal/60 text-sm">{tag.location}</p>}
                <p className="text-charcoal/40 text-xs mt-1">{ACTION_LABELS[tag.action]}</p>
                {tagAnalytics && (
                  <p className="text-charcoal/40 text-xs mt-1">
                    {tagAnalytics.interactions} interacciones · {tagAnalytics.completions} completadas ·{" "}
                    {tagAnalytics.conversionRate}% conversión
                  </p>
                )}

                <div className="mt-3 flex items-center gap-3">
                  <img
                    src={`/api/smart-tags/${tag.id}/qr`}
                    alt={`QR de ${tag.name}`}
                    className="h-20 w-20 rounded-lg border border-mauve/10 bg-white p-1"
                  />
                  <a
                    href={`/api/smart-tags/${tag.id}/qr`}
                    download={`smarttag-${tag.token}.png`}
                    className="text-xs text-blushdark hover:text-blush transition underline"
                  >
                    Descargar QR
                  </a>
                </div>

                <button
                  onClick={() => handleCopyLink(tag.smartLinkUrl)}
                  className="mt-3 w-full text-left bg-porcelain/5 border border-mauve/10 rounded-lg px-2.5 py-2 hover:border-mauve/25 transition"
                  title="Copiar link"
                >
                  <span className="block font-mono text-[11px] text-charcoal/70 truncate">
                    {tag.smartLinkUrl}
                  </span>
                  <span className="text-[10px] text-blushdark">Copiar link</span>
                </button>

                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    onClick={() => handleToggleActive(tag)}
                    disabled={togglingId === tag.id}
                    variant="secondary"
                    className="w-full"
                  >
                    {togglingId === tag.id ? "Actualizando..." : tag.isActive ? "Desactivar" : "Activar"}
                  </Button>
                  <div className="flex gap-2">
                    <Button onClick={() => openEdit(tag)} variant="secondary" className="flex-1">
                      Editar
                    </Button>
                    {deleteConfirmId === tag.id ? (
                      <div className="flex gap-1">
                        <Button onClick={() => handleDelete(tag.id)} variant="danger">
                          Confirmar
                        </Button>
                        <Button onClick={() => setDeleteConfirmId(null)} variant="secondary">
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={() => setDeleteConfirmId(tag.id)} variant="danger">
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={closeForm}>
          <div
            className="bg-ivory border border-mauve/10 rounded-2xl p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-charcoal">
                {editingTag ? "Editar Smart Tag" : "Nueva Smart Tag"}
              </h2>
              <button onClick={closeForm} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>

            {editingTag && (
              <div className="mb-4 bg-porcelain/5 border border-mauve/10 rounded-lg px-2.5 py-2">
                <span className="block text-charcoal/40 text-[10px] font-medium uppercase tracking-wider">
                  Link (no se puede editar)
                </span>
                <span className="block font-mono text-[11px] text-charcoal/70 truncate">
                  {editingTag.smartLinkUrl}
                </span>
              </div>
            )}

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Nombre</label>
                <input
                  className="form-input mt-1.5"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Recepción"
                  required
                />
              </div>

              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">
                  Ubicación (opcional)
                </label>
                <input
                  className="form-input mt-1.5"
                  value={formData.location}
                  onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="Entrada"
                />
              </div>

              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Acción</label>
                <select
                  className="form-input mt-1.5"
                  value={formData.action}
                  onChange={(e) => setFormData((prev) => ({ ...prev, action: e.target.value as SmartTag["action"] }))}
                >
                  <option value="BOOKING">Reservar turno</option>
                  <option value="REBOOK">Volver a reservar</option>
                  <option value="REVIEW">Dejar reseña</option>
                  <option value="WHATSAPP">Ir a WhatsApp</option>
                  <option value="INSTAGRAM">Ir a Instagram</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving} variant="primary" className="flex-1">
                  {saving ? "Guardando..." : editingTag ? "Guardar cambios" : "Crear Smart Tag"}
                </Button>
                <Button type="button" onClick={closeForm} variant="secondary">
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
