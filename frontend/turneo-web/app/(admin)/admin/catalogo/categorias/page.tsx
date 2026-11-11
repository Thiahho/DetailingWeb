"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import CatalogShell, {
  CatalogModal,
  EmptyState,
  StatusBadge,
  labelClass,
  useAdminGuard,
} from "@/src/components/admin/catalog/CatalogShell";
import { catalogRequest } from "@/src/lib/catalog/api";
import { buildCategoryPayload, type CategoryFormValues } from "@/src/lib/catalog/payloads";
import { moveItem } from "@/src/lib/catalog/ordering";
import type { CatalogAttribute, CatalogCategory } from "@/src/lib/catalog/types";

const emptyForm: CategoryFormValues = { name: "", description: "", sortOrder: 0, isActive: true, attributeIds: [] };

export default function CatalogCategoriesPage() {
  const ready = useAdminGuard();
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [attributes, setAttributes] = useState<CatalogAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CatalogCategory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CategoryFormValues>(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toasts, showToast, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const load = useCallback(async () => {
    const [cats, attrs] = await Promise.all([
      catalogRequest<CatalogCategory[]>("categories"),
      catalogRequest<CatalogAttribute[]>("attributes"),
    ]);
    if (cats.ok) setCategories(cats.data);
    else showToast("error", "Error", cats.message);
    if (attrs.ok) setAttributes(attrs.data);
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const attributeName = (id: number) => attributes.find((a) => a.id === id)?.name ?? `#${id}`;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, sortOrder: categories.length });
    setShowForm(true);
  };

  const openEdit = (category: CatalogCategory) => {
    setEditing(category);
    setForm({
      name: category.name,
      description: category.description ?? "",
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      attributeIds: category.attributeIds,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const attributesChanged = editing !== null && editing.attributeIds.join(",") !== form.attributeIds.join(",");
    if (attributesChanged && (editing?.productCount ?? 0) > 0) {
      const ok = await confirm({
        title: "Cambiar atributos",
        message:
          "Cambiar los atributos (o su orden) vuelve a generar las variantes de todos los productos de esta categoría. Las combinaciones que ya no apliquen se desactivan. ¿Continuar?",
        confirmLabel: "Guardar",
        variant: "primary",
      });
      if (!ok) return;
    }

    setSaving(true);
    const result = await catalogRequest<CatalogCategory>(editing ? `categories/${editing.id}` : "categories", {
      method: editing ? "PUT" : "POST",
      body: buildCategoryPayload(form),
      fallback: "No se pudo guardar la categoría",
    });
    setSaving(false);
    if (!result.ok) {
      showToast("error", "Error", result.message);
      return;
    }
    showToast("success", editing ? "Categoría actualizada" : "Categoría creada");
    setShowForm(false);
    load();
  };

  const handleDelete = async (category: CatalogCategory) => {
    const ok = await confirm({
      title: "Eliminar categoría",
      message: `¿Eliminar "${category.name}"? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    const result = await catalogRequest(`categories/${category.id}`, { method: "DELETE", fallback: "No se pudo eliminar" });
    if (result.ok) {
      showToast("warning", "Categoría eliminada");
      load();
    } else {
      showToast("error", "No se pudo eliminar", result.message);
    }
  };

  const availableAttributes = attributes.filter((a) => !form.attributeIds.includes(a.id));

  return (
    <CatalogShell
      title="Catálogo"
      description="Categorías del catálogo y los atributos que combinan sus variantes, en orden."
      action={
        <Button onClick={openCreate} variant="primary" className="shrink-0 flex items-center gap-2">
          <span className="text-xl leading-none">+</span>
          <span className="hidden sm:inline">Nueva categoría</span>
          <span className="sm:hidden">Nueva</span>
        </Button>
      }
    >
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {ConfirmDialog}

      {loading ? (
        <p className="text-charcoal/50 text-sm">Cargando categorías...</p>
      ) : categories.length === 0 ? (
        <EmptyState message="No hay categorías cargadas" actionLabel="+ Crear la primera" onAction={openCreate} />
      ) : (
        <div className="bg-ivory border border-mauve/5 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mauve/5 text-charcoal/30 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Nombre</th>
                <th className="text-left px-5 py-3 font-medium">Atributos</th>
                <th className="text-left px-5 py-3 font-medium">Productos</th>
                <th className="text-left px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-b border-mauve/5 last:border-0">
                  <td className="px-5 py-4">
                    <p className="text-charcoal font-medium">{category.name}</p>
                    <p className="text-charcoal/40 text-xs">/{category.slug}</p>
                  </td>
                  <td className="px-5 py-4 text-charcoal/60">
                    {category.attributeIds.length === 0 ? "—" : category.attributeIds.map(attributeName).join(" → ")}
                  </td>
                  <td className="px-5 py-4 text-charcoal/60">{category.productCount ?? 0}</td>
                  <td className="px-5 py-4">
                    <StatusBadge active={category.isActive} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button onClick={() => openEdit(category)} variant="secondary" size="sm">
                        Editar
                      </Button>
                      <Button onClick={() => handleDelete(category)} variant="danger" size="sm">
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <CatalogModal title={editing ? "Editar categoría" : "Nueva categoría"} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="category-name">Nombre</label>
              <input
                id="category-name"
                className="form-input mt-1.5"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Remeras"
                maxLength={120}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="category-description">Descripción</label>
              <textarea
                id="category-description"
                className="form-input mt-1.5 min-h-[72px]"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                maxLength={2000}
              />
            </div>

            <div>
              <span className={labelClass}>Atributos (en orden de combinación)</span>
              <div className="mt-1.5 space-y-1.5">
                {form.attributeIds.length === 0 && (
                  <p className="text-charcoal/40 text-xs">Sin atributos: cada producto tiene una sola variante.</p>
                )}
                {form.attributeIds.map((id, index) => (
                  <div key={id} className="flex items-center justify-between rounded-lg bg-white/60 border border-mauve/10 px-3 py-1.5">
                    <span className="text-charcoal text-sm">
                      {index + 1}. {attributeName(id)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="p-1 text-charcoal/40 hover:text-charcoal disabled:opacity-30"
                        onClick={() => setForm((prev) => ({ ...prev, attributeIds: moveItem(prev.attributeIds, index, index - 1) }))}
                        disabled={index === 0}
                        aria-label="Subir"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="p-1 text-charcoal/40 hover:text-charcoal disabled:opacity-30"
                        onClick={() => setForm((prev) => ({ ...prev, attributeIds: moveItem(prev.attributeIds, index, index + 1) }))}
                        disabled={index === form.attributeIds.length - 1}
                        aria-label="Bajar"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className="p-1 text-red-500/70 hover:text-red-600"
                        onClick={() => setForm((prev) => ({ ...prev, attributeIds: prev.attributeIds.filter((x) => x !== id) }))}
                        aria-label="Quitar"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {availableAttributes.length > 0 && form.attributeIds.length < 10 && (
                  <select
                    className="form-input"
                    value=""
                    onChange={(e) => {
                      const id = parseInt(e.target.value);
                      if (id) setForm((prev) => ({ ...prev, attributeIds: [...prev.attributeIds, id] }));
                    }}
                    aria-label="Agregar atributo"
                  >
                    <option value="">+ Agregar atributo…</option>
                    {availableAttributes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
                {attributes.length === 0 && (
                  <p className="text-charcoal/40 text-xs">Primero creá atributos en la pestaña Atributos.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="category-order">Orden</label>
                <input
                  id="category-order"
                  type="number"
                  min={0}
                  className="form-input mt-1.5"
                  value={form.sortOrder}
                  onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="category-status">Estado</label>
                <select
                  id="category-status"
                  className="form-input mt-1.5"
                  value={form.isActive ? "true" : "false"}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === "true" }))}
                >
                  <option value="true">Activa</option>
                  <option value="false">Inactiva</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} variant="primary" className="flex-1">
                {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear categoría"}
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
