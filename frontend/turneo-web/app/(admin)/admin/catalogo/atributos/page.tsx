"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/src/components/shared/Button";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import CatalogShell, { CatalogModal, EmptyState, labelClass, useAdminGuard } from "@/src/components/admin/catalog/CatalogShell";
import AttributeValuesEditor from "@/src/components/admin/catalog/AttributeValuesEditor";
import { catalogRequest } from "@/src/lib/catalog/api";
import type { CatalogAttribute } from "@/src/lib/catalog/types";

const emptyForm = { name: "", sortOrder: 0 };

export default function CatalogAttributesPage() {
  const ready = useAdminGuard();
  const [attributes, setAttributes] = useState<CatalogAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CatalogAttribute | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toasts, showToast, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const load = useCallback(async () => {
    const result = await catalogRequest<CatalogAttribute[]>("attributes");
    if (result.ok) setAttributes(result.data);
    else showToast("error", "Error", result.message);
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, sortOrder: attributes.length });
    setShowForm(true);
  };

  const openEdit = (attribute: CatalogAttribute) => {
    setEditing(attribute);
    setForm({ name: attribute.name, sortOrder: attribute.sortOrder });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await catalogRequest<CatalogAttribute>(editing ? `attributes/${editing.id}` : "attributes", {
      method: editing ? "PUT" : "POST",
      body: { name: form.name.trim(), sortOrder: form.sortOrder },
      fallback: "No se pudo guardar el atributo",
    });
    setSaving(false);
    if (!result.ok) {
      showToast("error", "Error", result.message);
      return;
    }
    showToast("success", editing ? "Atributo actualizado" : "Atributo creado");
    setShowForm(false);
    load();
  };

  const handleDelete = async (attribute: CatalogAttribute) => {
    const ok = await confirm({
      title: "Eliminar atributo",
      message: `¿Eliminar "${attribute.name}" y sus valores? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    const result = await catalogRequest(`attributes/${attribute.id}`, { method: "DELETE", fallback: "No se pudo eliminar" });
    if (result.ok) {
      showToast("warning", "Atributo eliminado");
      load();
    } else {
      showToast("error", "No se pudo eliminar", result.message);
    }
  };

  return (
    <CatalogShell
      title="Catálogo"
      description="Atributos con los que se arman las variantes (Talle, Color, Medida…) y sus valores."
      action={
        <Button onClick={openCreate} variant="primary" className="shrink-0 flex items-center gap-2">
          <span className="text-xl leading-none">+</span>
          <span className="hidden sm:inline">Nuevo atributo</span>
          <span className="sm:hidden">Nuevo</span>
        </Button>
      }
    >
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {ConfirmDialog}

      {loading ? (
        <p className="text-charcoal/50 text-sm">Cargando atributos...</p>
      ) : attributes.length === 0 ? (
        <EmptyState message="No hay atributos cargados" actionLabel="+ Crear el primero" onAction={openCreate} />
      ) : (
        <div className="space-y-4">
          {attributes.map((attribute) => (
            <section key={attribute.id} className="bg-ivory border border-mauve/5 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-charcoal font-semibold">{attribute.name}</h2>
                  <p className="text-charcoal/40 text-xs mt-0.5">
                    Orden {attribute.sortOrder} · {attribute.values.length} {attribute.values.length === 1 ? "valor" : "valores"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => openEdit(attribute)} variant="secondary" size="sm">
                    Editar
                  </Button>
                  <Button onClick={() => handleDelete(attribute)} variant="danger" size="sm">
                    Eliminar
                  </Button>
                </div>
              </div>
              <AttributeValuesEditor
                attribute={attribute}
                onChanged={load}
                onError={(message) => showToast("error", "Error", message)}
                confirm={confirm}
              />
            </section>
          ))}
        </div>
      )}

      {showForm && (
        <CatalogModal title={editing ? "Editar atributo" : "Nuevo atributo"} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="attribute-name">Nombre</label>
              <input
                id="attribute-name"
                className="form-input mt-1.5"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Talle"
                maxLength={80}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="attribute-order">Orden</label>
              <input
                id="attribute-order"
                type="number"
                min={0}
                className="form-input mt-1.5"
                value={form.sortOrder}
                onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} variant="primary" className="flex-1">
                {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear atributo"}
              </Button>
              <Button type="button" onClick={() => setShowForm(false)} variant="secondary">
                Cancelar
              </Button>
            </div>
          </form>
        </CatalogModal>
      )}
    </CatalogShell>
  );
}
