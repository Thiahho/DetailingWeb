"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { Button } from "@/src/components/shared/Button";
import CategoryCombobox, { distinctCategories } from "@/src/components/forms/CategoryCombobox";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import BulkActionBar, { BulkCheckbox } from "@/src/components/dashboard/BulkActionBar";
import { useBulkSelection } from "@/src/hooks/useBulkSelection";
import { countLabel, runBulk } from "@/src/lib/bulk";

interface Insumo {
  id: number;
  name: string;
  stock: number;
  lowStockThreshold: number;
  unitCost: number;
  category?: string | null;
  isActive: boolean;
  order: number;
}

const emptyForm = {
  name: "",
  stock: 0,
  lowStockThreshold: 0,
  unitCost: 0,
  category: "",
  isActive: true,
  order: 0,
};

function StockBadge({ stock, lowStockThreshold }: { stock: number; lowStockThreshold: number }) {
  if (stock <= 0) {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-700">
        SIN STOCK
      </span>
    );
  }
  if (stock <= lowStockThreshold) {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700">
        POCO STOCK
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-700">
      OK
    </span>
  );
}

export default function InsumosAdminPage() {
  const router = useRouter();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const { toasts, showToast, removeToast } = useToast();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();
  const bulk = useBulkSelection(insumos.map((i) => i.id));
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
      return;
    }
    loadInsumos();
  }, [router]);

  const loadInsumos = async () => {
    try {
      const res = await fetch("/api/insumos");
      if (res.ok) setInsumos(await res.json());
    } catch (error) {
      logError("Error cargando insumos:", error);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingInsumo(null);
    setFormData({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (insumo: Insumo) => {
    setEditingInsumo(insumo);
    setFormData({
      name: insumo.name,
      stock: insumo.stock,
      lowStockThreshold: insumo.lowStockThreshold,
      unitCost: insumo.unitCost,
      category: insumo.category ?? "",
      isActive: insumo.isActive,
      order: insumo.order,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingInsumo(null);
    setFormData({ ...emptyForm });
  };

  const formRef = useRef<HTMLFormElement>(null);
  useModalHotkeys(showForm, { onClose: closeForm, onSubmit: () => formRef.current?.requestSubmit() });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingInsumo ? `/api/insumos/${editingInsumo.id}` : "/api/insumos";
      const method = editingInsumo ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", editingInsumo ? "Insumo actualizado" : "Insumo creado", data.message);
        closeForm();
        loadInsumos();
      } else {
        showToast("error", "Error", data.message || "No se pudo guardar el insumo");
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/insumos/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showToast("warning", "Insumo eliminado", data.message);
        setDeleteConfirmId(null);
        loadInsumos();
      } else {
        showToast("error", "Error", data.message || "No se pudo eliminar");
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
    }
  };

  const selectedInsumos = insumos.filter((i) => bulk.isSelected(i.id));

  // Avisa el resultado de una acción masiva y deja marcados solo los que
  // fallaron, para poder reintentar sin volver a elegirlos.
  const finishBulk = (done: Insumo[], failed: Insumo[], doneTitle: string) => {
    bulk.setSelection(failed.map((i) => i.id));
    if (failed.length === 0) {
      showToast("success", doneTitle, countLabel(done.length, "insumo", "insumos"));
    } else {
      showToast(
        done.length > 0 ? "warning" : "error",
        done.length > 0 ? `${doneTitle} con errores` : "No se pudo completar",
        `${done.length} listos, ${failed.length} con error (quedaron seleccionados).`
      );
    }
    loadInsumos();
  };

  // Activar/desactivar reenvía el insumo por el mismo PUT que el formulario
  // de edición, con isActive cambiado. El stock viaja tal cual está en el
  // listado: ese PUT también lo pisa.
  const bulkSetActive = async (isActive: boolean) => {
    const targets = selectedInsumos.filter((i) => i.isActive !== isActive);
    if (targets.length === 0) return;
    setBulkBusy(true);
    const { done, failed } = await runBulk(targets, async (i) => {
      const res = await fetch(`/api/insumos/${i.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: i.name,
          stock: i.stock,
          lowStockThreshold: i.lowStockThreshold,
          unitCost: i.unitCost,
          category: i.category ?? "",
          isActive,
          order: i.order,
        }),
      });
      return res.ok;
    });
    setBulkBusy(false);
    finishBulk(done, failed, isActive ? "Insumos activados" : "Insumos desactivados");
  };

  const bulkDelete = async () => {
    const targets = selectedInsumos;
    if (targets.length === 0) return;
    const ok = await confirm({
      title: "Eliminar insumos",
      message: `¿Eliminar ${countLabel(targets.length, "insumo", "insumos")}? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    setBulkBusy(true);
    const { done, failed } = await runBulk(targets, async (i) => {
      const res = await fetch(`/api/insumos/${i.id}`, { method: "DELETE" });
      return res.ok;
    });
    setBulkBusy(false);
    finishBulk(done, failed, "Insumos eliminados");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando insumos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      {/* Toasts */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {ConfirmDialog}

      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 md:mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Gestión de Insumos</h1>
            <p className="text-charcoal/50 text-sm mt-1">
              Inventario de insumos usados en los turnos (Historial). El stock se descuenta solo al registrar consumo.
            </p>
          </div>
          <Button onClick={openCreate} data-testid="insumo-create-button" variant="primary" className="shrink-0 flex items-center gap-2">
            <span className="text-xl leading-none">+</span>
            <span className="hidden sm:inline">Nuevo Insumo</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>

        {/* Lista de insumos */}
        {insumos.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-mauve/10 rounded-xl">
            <p className="text-charcoal/40 text-lg">No hay insumos cargados</p>
            <button onClick={openCreate} className="mt-4 text-blushdark hover:text-blush transition text-sm">
              + Crear el primero
            </button>
          </div>
        ) : (
          <>
          <BulkActionBar
            count={bulk.count}
            total={insumos.length}
            allSelected={bulk.allSelected}
            someSelected={bulk.someSelected}
            onToggleAll={bulk.toggleAll}
            onClear={bulk.clear}
            busy={bulkBusy}
            singular="insumo"
            plural="insumos"
            testIdPrefix="insumo"
            actions={[
              { key: "activate", label: "Activar", onClick: () => bulkSetActive(true), hidden: selectedInsumos.every((i) => i.isActive) },
              { key: "deactivate", label: "Desactivar", onClick: () => bulkSetActive(false), hidden: selectedInsumos.every((i) => !i.isActive) },
              { key: "delete", label: "Eliminar", onClick: bulkDelete, variant: "danger" },
            ]}
          />
          <div className="bg-ivory border border-mauve/5 rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mauve/5 text-charcoal/30 text-xs uppercase tracking-wider">
                  <th className="w-10 pl-2" />
                  <th className="text-left px-5 py-3 font-medium">Nombre</th>
                  <th className="text-left px-5 py-3 font-medium">Categoría</th>
                  <th className="text-left px-5 py-3 font-medium">Stock</th>
                  <th className="text-left px-5 py-3 font-medium">Costo unitario</th>
                  <th className="text-left px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {insumos.map((insumo) => (
                  <tr
                    key={insumo.id}
                    data-testid="insumo-row"
                    data-insumo-name={insumo.name}
                    className={`border-b border-mauve/5 last:border-0 ${bulk.isSelected(insumo.id) ? "bg-blush/10" : ""}`}
                  >
                    <td className="pl-2">
                      <BulkCheckbox
                        checked={bulk.isSelected(insumo.id)}
                        onChange={() => bulk.toggle(insumo.id)}
                        disabled={bulkBusy}
                        label={`Seleccionar ${insumo.name}`}
                        data-testid="insumo-select"
                      />
                    </td>
                    <td className="px-5 py-4 text-charcoal font-medium">{insumo.name}</td>
                    <td className="px-5 py-4 text-charcoal/60">{insumo.category || "—"}</td>
                    <td className="px-5 py-4 text-charcoal/60">
                      <div className="flex items-center gap-2">
                        <span>{insumo.stock}</span>
                        <StockBadge stock={insumo.stock} lowStockThreshold={insumo.lowStockThreshold} />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-charcoal/60">${insumo.unitCost.toLocaleString("es-AR")}</td>
                    <td className="px-5 py-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${insumo.isActive ? "bg-green-500/20 text-green-700" : "bg-orange-500/20 text-orange-700"}`}>
                        {insumo.isActive ? "ACTIVO" : "INACTIVO"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          onClick={() => openEdit(insumo)}
                          data-testid="insumo-edit-button"
                          variant="secondary"
                          size="sm"
                        >
                          Editar
                        </Button>
                        {deleteConfirmId === insumo.id ? (
                          <div className="flex gap-1">
                            <Button
                              onClick={() => handleDelete(insumo.id)}
                              data-testid="insumo-delete-confirm-button"
                              variant="danger"
                              size="sm"
                            >
                              Confirmar
                            </Button>
                            <Button
                              onClick={() => setDeleteConfirmId(null)}
                              variant="secondary"
                              size="sm"
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={() => setDeleteConfirmId(insumo.id)}
                            data-testid="insumo-delete-button"
                            variant="danger"
                            size="sm"
                          >
                            Eliminar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Modal Formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={closeForm}>
          <div
            className="bg-ivory border border-mauve/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-charcoal">
                {editingInsumo ? "Editar Insumo" : "Nuevo Insumo"}
              </h2>
              <button onClick={closeForm} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Nombre</label>
                <input
                  className="form-input mt-1.5"
                  data-testid="insumo-form-name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Esmalte rojo"
                  required
                />
              </div>

              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Categoría</label>
                <CategoryCombobox
                  testId="insumo-form-category"
                  value={formData.category}
                  onChange={(category) => setFormData((prev) => ({ ...prev, category }))}
                  suggestions={distinctCategories(insumos.map((i) => i.category))}
                  placeholder="Esmaltes"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Stock actual</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input mt-1.5"
                    data-testid="insumo-form-stock"
                    value={formData.stock}
                    onChange={(e) => setFormData((prev) => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                    required
                  />
                  <p className="text-charcoal/40 text-[11px] mt-1">Editá este valor para ajustar stock manualmente (compra/entrada).</p>
                </div>
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Umbral poco stock</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input mt-1.5"
                    data-testid="insumo-form-threshold"
                    value={formData.lowStockThreshold}
                    onChange={(e) => setFormData((prev) => ({ ...prev, lowStockThreshold: parseInt(e.target.value) || 0 }))}
                  />
                  <p className="text-charcoal/40 text-[11px] mt-1">
                    Te avisamos cuando el stock llegue a este número o menos. En 0, solo avisa cuando ya no queda nada.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Costo unitario</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="form-input mt-1.5"
                    value={formData.unitCost}
                    onChange={(e) => setFormData((prev) => ({ ...prev, unitCost: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Orden</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input mt-1.5"
                    value={formData.order}
                    onChange={(e) => setFormData((prev) => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Estado</label>
                <select
                  className="form-input mt-1.5"
                  value={formData.isActive ? "true" : "false"}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.value === "true" }))}
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  data-testid="insumo-form-submit"
                  variant="primary"
                  className="flex-1"
                >
                  {saving ? "Guardando..." : editingInsumo ? "Guardar cambios" : "Crear insumo"}
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
