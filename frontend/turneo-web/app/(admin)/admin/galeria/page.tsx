"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import CloudinaryUpload from "@/src/components/forms/CloudinaryUpload";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { Button } from "@/src/components/shared/Button";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

interface GalleryItem {
  id: number;
  title: string;
  tag: string;
  imageUrl: string;
  isActive: boolean;
  order: number;
}

const emptyForm = { title: "", tag: "", imageUrl: "", isActive: true, order: 0 };

export default function GaleriaAdminPage() {
  const router = useRouter();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const { toasts, showToast, removeToast } = useToast();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) { router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login"); return; }
    loadItems();
  }, [router]);

  const loadItems = async () => {
    try {
      const res = await fetch("/api/gallery/all");
      if (res.ok) setItems(await res.json());
    } catch (error) {
      logError("Error cargando galería:", error);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingItem(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const openEdit = (item: GalleryItem) => {
    setEditingItem(item);
    setFormData({ title: item.title, tag: item.tag, imageUrl: item.imageUrl, isActive: item.isActive, order: item.order });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormData(emptyForm);
  };

  const formRef = useRef<HTMLFormElement>(null);
  useModalHotkeys(showForm, { onClose: closeForm, onSubmit: () => formRef.current?.requestSubmit() });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingItem ? `/api/gallery/${editingItem.id}` : "/api/gallery";
      const method = editingItem ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", editingItem ? "Imagen actualizada" : "Imagen agregada");
        closeForm();
        loadItems();
      } else {
        showToast("error", "Error", data.message || "No se pudo guardar");
      }
    } catch {
      showToast("error", "Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/gallery/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("warning", "Imagen eliminada");
        setDeleteConfirmId(null);
        loadItems();
      } else {
        showToast("error", "Error", "No se pudo eliminar");
      }
    } catch {
      showToast("error", "Error de conexión");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando galería...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="mx-auto max-w-6xl">
        <div className="mb-6 md:mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Galería</h1>
            <p className="text-charcoal/50 text-sm mt-1">Administrá las imágenes que se muestran en la sección de trabajos</p>
          </div>
          <Button onClick={openCreate} variant="primary" className="shrink-0 flex items-center gap-2">
            <span className="text-xl leading-none">+</span>
            <span className="hidden sm:inline">Agregar imagen</span>
            <span className="sm:hidden">Agregar</span>
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-mauve/10 rounded-xl">
            <p className="text-charcoal/40 text-lg">No hay imágenes en la galería</p>
            <button onClick={openCreate} className="mt-4 text-blush hover:text-blushdark transition text-sm">
              + Agregar la primera
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                data-testid="gallery-card"
                data-item-title={item.title}
                className={`bg-ivory border rounded-xl overflow-hidden transition ${item.isActive ? "border-mauve/15" : "border-orange-200 opacity-60"}`}
              >
                <div className="h-44 overflow-hidden">
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-charcoal font-semibold text-[15px]">{item.title}</h3>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${item.isActive ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                      {item.isActive ? "ACTIVO" : "INACTIVO"}
                    </span>
                  </div>
                  <p className="text-charcoal/40 text-xs uppercase tracking-wider">{item.tag}</p>
                  <div className="mt-4 flex gap-2">
                    <Button onClick={() => openEdit(item)} data-testid="gallery-edit-button" variant="secondary" size="sm" className="flex-1">
                      Editar
                    </Button>
                    {deleteConfirmId === item.id ? (
                      <div className="flex gap-1">
                        <Button onClick={() => handleDelete(item.id)} data-testid="gallery-delete-confirm-button" variant="danger" size="sm">
                          Confirmar
                        </Button>
                        <Button onClick={() => setDeleteConfirmId(null)} variant="secondary" size="sm">
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={() => setDeleteConfirmId(item.id)} data-testid="gallery-delete-button" variant="danger" size="sm">
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={closeForm}>
          <div
            className="bg-ivory border border-mauve/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-charcoal">{editingItem ? "Editar imagen" : "Agregar imagen"}</h2>
              <button onClick={closeForm} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Título</label>
                <input
                  className="form-input mt-1.5"
                  data-testid="gallery-form-title"
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Pulido total - Honda Civic"
                  required
                />
              </div>

              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Tag / Categoría</label>
                <input
                  className="form-input mt-1.5"
                  value={formData.tag}
                  onChange={(e) => setFormData((p) => ({ ...p, tag: e.target.value }))}
                  placeholder="Detailing · Pulido · Lavado"
                />
              </div>

              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Imagen</label>
                <div className="mt-1.5">
                  <CloudinaryUpload
                    value={formData.imageUrl}
                    onChange={(url) => setFormData((p) => ({ ...p, imageUrl: url }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Orden</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input mt-1.5"
                    value={formData.order}
                    onChange={(e) => setFormData((p) => ({ ...p, order: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Estado</label>
                  <select
                    className="form-input mt-1.5"
                    value={formData.isActive ? "true" : "false"}
                    onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.value === "true" }))}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  data-testid="gallery-form-submit"
                  variant="primary"
                  className="flex-1"
                >
                  {saving ? "Guardando..." : editingItem ? "Guardar cambios" : "Agregar imagen"}
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
