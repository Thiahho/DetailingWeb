"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import CloudinaryUpload from "@/src/components/forms/CloudinaryUpload";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { Button } from "@/src/components/shared/Button";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

interface Service {
  id: number;
  title: string;
  slug: string;
  price: string;
  duration: string;
  imageUrl: string;
  details: string[];
  isActive: boolean;
  description: string;
  order: number;
  customFieldsSchema?: string;
  category?: string;
  bufferMinutes: number;
  color: string;
}

interface InsumoOption { id: number; name: string; stock: number; }
interface RecipeItem { insumoId: number; insumoName: string; quantity: number; }

interface CustomFieldDef {
  name: string;
  key: string;
  type: "text" | "select" | "number" | "textarea";
  options: string[];
  required: boolean;
}

const emptyField = (): CustomFieldDef => ({ name: "", key: "", type: "text", options: [], required: false });

const emptyForm = {
  title: "",
  slug: "",
  price: "",
  duration: "",
  description: "",
  imageUrl: "",
  details: ["", "", ""],
  isActive: true,
  order: 0,
  category: "",
  bufferMinutes: 0,
  color: "#7c3aed",
};

export default function ServiciosAdminPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const { toasts, showToast, removeToast } = useToast();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [insumosCatalog, setInsumosCatalog] = useState<InsumoOption[]>([]);
  const [recipe, setRecipe] = useState<RecipeItem[]>([]);
  const [newRecipeItem, setNewRecipeItem] = useState({ insumoId: 0, quantity: 1 });

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
      return;
    }
    loadServices();
    fetch("/api/insumos").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setInsumosCatalog(data); });
  }, [router]);

  const loadServices = async () => {
    try {
      const res = await fetch("/api/services/all");
      if (res.ok) setServices(await res.json());
    } catch (error) {
      logError("Error cargando servicios:", error);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingService(null);
    setFormData({ ...emptyForm, details: ["", "", ""] });
    setCustomFields([]);
    setRecipe([]);
    setShowForm(true);
  };

  const openEdit = async (service: Service) => {
    setEditingService(service);
    setFormData({
      title: service.title,
      slug: service.slug,
      price: service.price,
      duration: service.duration,
      imageUrl: service.imageUrl,
      details: service.details.length >= 3 ? [...service.details] : [...service.details, "", "", ""].slice(0, 3),
      isActive: service.isActive,
      description: service.description ?? "",
      order: service.order,
      category: service.category ?? "",
      bufferMinutes: service.bufferMinutes,
      color: service.color,
    });
    try {
      setCustomFields(service.customFieldsSchema ? JSON.parse(service.customFieldsSchema) : []);
    } catch {
      setCustomFields([]);
    }
    setRecipe([]);
    setShowForm(true);
    try {
      const res = await fetch(`/api/services/${service.id}/recipe`);
      if (res.ok) setRecipe(await res.json());
    } catch (error) {
      logError("Error cargando receta del servicio:", error);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingService(null);
    setFormData({ ...emptyForm, details: ["", "", ""] });
    setCustomFields([]);
    setRecipe([]);
    setNewRecipeItem({ insumoId: 0, quantity: 1 });
  };

  const formRef = useRef<HTMLFormElement>(null);
  useModalHotkeys(showForm, { onClose: closeForm, onSubmit: () => formRef.current?.requestSubmit() });

  const addRecipeItem = () => {
    if (!newRecipeItem.insumoId) return;
    const insumo = insumosCatalog.find((i) => i.id === newRecipeItem.insumoId);
    if (!insumo) return;
    setRecipe((prev) => [...prev, { insumoId: insumo.id, insumoName: insumo.name, quantity: newRecipeItem.quantity }]);
    setNewRecipeItem({ insumoId: 0, quantity: 1 });
  };

  const removeRecipeItem = (idx: number) => setRecipe((prev) => prev.filter((_, i) => i !== idx));

  const updateCustomField = (index: number, patch: Partial<CustomFieldDef>) => {
    setCustomFields((prev) => prev.map((f, i) => i === index ? { ...f, ...patch } : f));
  };

  const removeCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const validFields = customFields.filter((f) => f.name.trim() && f.key.trim());
    const payload = {
      ...formData,
      details: formData.details.filter((d) => d.trim() !== ""),
      customFieldsSchema: validFields.length > 0 ? JSON.stringify(validFields) : null,
    };

    try {
      const url = editingService ? `/api/services/${editingService.id}` : "/api/services";
      const method = editingService ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        const serviceId = editingService ? editingService.id : data.id;
        await fetch(`/api/services/${serviceId}/recipe`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: recipe.map((r) => ({ insumoId: r.insumoId, quantity: r.quantity })) }),
        });
        showToast("success", editingService ? "Servicio actualizado" : "Servicio creado", data.message);
        closeForm();
        loadServices();
      } else {
        showToast("error", "Error", data.message || "No se pudo guardar el servicio");
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showToast("warning", "Servicio eliminado", data.message);
        setDeleteConfirmId(null);
        loadServices();
      } else {
        showToast("error", "Error", data.message || "No se pudo eliminar");
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
    }
  };

  const updateDetail = (index: number, value: string) => {
    setFormData((prev) => {
      const details = [...prev.details];
      details[index] = value;
      return { ...prev, details };
    });
  };
  // Auto-slug desde el título
  const handleTitleChange = (title: string) => {
    const slug = title
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    setFormData((prev) => ({ ...prev, title, slug: editingService ? prev.slug : slug }));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando servicios...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 md:mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Gestión de Servicios</h1>
            <p className="text-charcoal/50 text-sm mt-1">
              Administrá los servicios que se muestran en tu sitio y formulario de reserva
            </p>
          </div>
          <Button onClick={openCreate} data-testid="service-create-button" variant="primary" className="shrink-0 flex items-center gap-2">
            <span className="text-xl leading-none">+</span>
            <span className="hidden sm:inline">Nuevo Servicio</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>

        {/* Grid de servicios */}
        {services.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-mauve/10 rounded-xl">
            <p className="text-charcoal/40 text-lg">No hay servicios cargados</p>
            <button onClick={openCreate} className="mt-4 text-blushdark hover:text-blush transition text-sm">
              + Crear el primero
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <div
                key={service.id}
                data-testid="service-card"
                data-service-title={service.title}
                className={`bg-ivory border rounded-xl overflow-hidden transition ${
                  service.isActive ? "border-mauve/15" : "border-orange-200 opacity-60"
                }`}
              >
                {/* Imagen */}
                {service.imageUrl && (
                  <div className="h-36 overflow-hidden">
                    <img
                      src={service.imageUrl}
                      alt={service.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-charcoal font-semibold text-[15px] leading-tight flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: service.color }}
                        title={service.color}
                      />
                      {service.title}
                    </h3>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        service.isActive
                          ? "bg-green-500/20 text-green-700"
                          : "bg-orange-500/20 text-orange-700"
                      }`}
                    >
                      {service.isActive ? "ACTIVO" : "INACTIVO"}
                    </span>
                  </div>

                  {service.category && (
                    <p className="text-charcoal/40 text-xs mb-1">{service.category}</p>
                  )}
                  <p className="text-charcoal/60 text-sm">{service.price} · {service.duration}</p>

                  <ul className="mt-3 space-y-1">
                    {service.details.map((d, i) => (
                      <li key={i} className="text-charcoal/40 text-xs flex items-start gap-1.5">
                        <span className="text-green-500 mt-0.5">✓</span> {d}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => openEdit(service)}
                      data-testid="service-edit-button"
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                    >
                      Editar
                    </Button>
                    {deleteConfirmId === service.id ? (
                      <div className="flex gap-1">
                        <Button
                          onClick={() => handleDelete(service.id)}
                          data-testid="service-delete-confirm-button"
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
                        onClick={() => setDeleteConfirmId(service.id)}
                        data-testid="service-delete-button"
                        variant="danger"
                        size="sm"
                      >
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

      {/* Modal Formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={closeForm}>
          <div
            className="bg-ivory border border-mauve/10 rounded-2xl p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-charcoal">
                {editingService ? "Editar Servicio" : "Nuevo Servicio"}
              </h2>
              <button onClick={closeForm} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              {/* Título */}
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Título</label>
                <input
                  className="form-input mt-1.5"
                  data-testid="service-form-title"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Pack Daily Reset"
                  required
                />
              </div>

              {/* Slug */}
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Slug</label>
                <input
                  className="form-input mt-1.5 font-mono"
                  data-testid="service-form-slug"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="daily-reset"
                  required
                />
              </div>

              {/* Precio y Duración */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Precio</label>
                  <input
                    className="form-input mt-1.5"
                    data-testid="service-form-price"
                    value={formData.price}
                    onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                    placeholder="Desde $45.000"
                    required
                  />
                </div>
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Duración</label>
                  <input
                    className="form-input mt-1.5"
                    value={formData.duration}
                    onChange={(e) => setFormData((prev) => ({ ...prev, duration: e.target.value }))}
                    placeholder="4-6 hs"
                  />
                </div>
              </div>

              {/* Imagen */}
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Imagen</label>
                <div className="mt-1.5">
                  <CloudinaryUpload
                    value={formData.imageUrl}
                    onChange={(url) => setFormData((prev) => ({ ...prev, imageUrl: url }))}
                    hint="Recomendado: 1200×800 px (horizontal, 3:2). Se recorta automáticamente al mostrarse, así que centrá lo importante de la foto."
                  />
                </div>
              </div>

              {/*Descripcion */}
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">
                  Descripción
                </label>
                <textarea
                  className="form-input mt-1.5 resize-none"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción del servicio..."
                />
              </div>
              {/* Detalles */}
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">
                  Detalles del servicio (hasta 3)
                </label>
                <div className="mt-1.5 space-y-2">
                  {formData.details.map((detail, i) => (
                    <input
                      key={i}
                      className="form-input"
                      value={detail}
                      onChange={(e) => updateDetail(i, e.target.value)}
                      placeholder={`Detalle ${i + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* Categoría y Buffer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Categoría</label>
                  <input
                    className="form-input mt-1.5"
                    data-testid="service-form-category"
                    value={formData.category}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                    placeholder="Peluquería"
                  />
                </div>
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Buffer entre turnos (min)</label>
                  <input
                    type="number"
                    min={0}
                    max={480}
                    className="form-input mt-1.5"
                    data-testid="service-form-buffer"
                    value={formData.bufferMinutes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, bufferMinutes: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {/* Color y Orden */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Color</label>
                  <input
                    type="color"
                    className="w-full mt-1.5 h-11 bg-cream border border-mauve/10 rounded-lg p-1 cursor-pointer"
                    data-testid="service-form-color"
                    value={formData.color}
                    onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
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

              {/* Estado */}
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

              {/* Receta: insumos que consume este servicio */}
              <div className="pt-2 border-t border-mauve/5">
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">
                  Insumos que consume (receta)
                </label>
                <p className="text-charcoal/30 text-[11px] mt-1 mb-2">
                  Al cargar este servicio en el detalle de un turno, estos insumos se agregan solos con su cantidad (editable antes de guardar).
                </p>
                {recipe.length > 0 && (
                  <div className="space-y-1.5 mb-2" data-testid="service-recipe-list">
                    {recipe.map((item, i) => (
                      <div key={i} data-testid="service-recipe-row" className="flex items-center justify-between gap-2 text-sm bg-cream border border-mauve/10 rounded-lg px-3 py-1.5">
                        <span className="text-charcoal/70">{item.insumoName} <span className="text-charcoal/30 text-xs">×{item.quantity}</span></span>
                        <button type="button" onClick={() => removeRecipeItem(i)} data-testid="service-recipe-remove" className="text-red-600/60 hover:text-red-600 text-xs">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5 items-center">
                  <select
                    value={newRecipeItem.insumoId}
                    onChange={(e) => setNewRecipeItem((prev) => ({ ...prev, insumoId: parseInt(e.target.value) || 0 }))}
                    data-testid="service-recipe-select"
                    className="flex-1 min-w-0 bg-cream border border-mauve/10 rounded-lg px-1.5 py-1.5 text-xs text-charcoal focus:outline-none"
                  >
                    <option value={0}>Elegir insumo...</option>
                    {insumosCatalog.map((i) => (
                      <option key={i.id} value={i.id}>{i.name} (Stock: {i.stock})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={newRecipeItem.quantity}
                    onChange={(e) => setNewRecipeItem((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    data-testid="service-recipe-quantity"
                    className="w-14 bg-cream border border-mauve/10 rounded-lg px-1 py-1.5 text-xs text-charcoal text-center focus:outline-none"
                  />
                  <Button type="button" onClick={addRecipeItem} data-testid="service-recipe-add" variant="secondary" size="sm" className="shrink-0">
                    +
                  </Button>
                </div>
              </div>

              {/* Campos dinámicos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Campos adicionales del formulario</label>
                  <button
                    type="button"
                    onClick={() => setCustomFields((prev) => [...prev, emptyField()])}
                    className="text-blushdark hover:text-blush text-xs transition"
                  >
                    + Agregar campo
                  </button>
                </div>
                {customFields.length === 0 && (
                  <p className="text-charcoal/30 text-xs italic">Sin campos extra. El cliente solo verá Nombre, Trabajo, WhatsApp y Email.</p>
                )}
                <div className="space-y-3 mt-2">
                  {customFields.map((field, i) => (
                    <div key={i} className="bg-cream border border-mauve/10 rounded-lg p-3 space-y-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          className="flex-1 bg-ivory border border-mauve/10 rounded p-2 text-charcoal text-sm focus:border-blush focus:outline-none"
                          placeholder="Nombre del campo"
                          value={field.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            const key = field.key || name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
                            updateCustomField(i, { name, key: field.key ? field.key : key });
                          }}
                        />
                        <div className="flex gap-2">
                          <input
                            className="flex-1 sm:w-28 sm:flex-none bg-ivory border border-mauve/10 rounded p-2 text-charcoal/70 text-sm font-mono focus:border-blush focus:outline-none"
                            placeholder="key"
                            value={field.key}
                            onChange={(e) => updateCustomField(i, { key: e.target.value })}
                          />
                          <button type="button" onClick={() => removeCustomField(i)} className="text-red-600/70 hover:text-red-600 px-1">✕</button>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <select
                          className="bg-ivory border border-mauve/10 rounded p-2 text-charcoal text-sm focus:border-blush focus:outline-none"
                          value={field.type}
                          onChange={(e) => updateCustomField(i, { type: e.target.value as CustomFieldDef["type"] })}
                        >
                          <option value="text">Texto</option>
                          <option value="number">Número</option>
                          <option value="select">Selección</option>
                          <option value="textarea">Área de texto</option>
                        </select>
                        <label className="flex items-center gap-1.5 text-charcoal/60 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateCustomField(i, { required: e.target.checked })}
                            className="accent-green-500"
                          />
                          Requerido
                        </label>
                      </div>
                      {field.type === "select" && (
                        <div>
                          <p className="text-charcoal/40 text-xs mb-1">Opciones (una por línea)</p>
                          <textarea
                            className="w-full bg-ivory border border-mauve/10 rounded p-2 text-charcoal text-sm focus:border-blush focus:outline-none resize-none"
                            rows={3}
                            value={field.options.join("\n")}
                            onChange={(e) => updateCustomField(i, { options: e.target.value.split("\n").map((o) => o.trim()).filter(Boolean) })}
                            placeholder={"Chico\nMediano\nGrande"}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  data-testid="service-form-submit"
                  variant="primary"
                  className="flex-1"
                >
                  {saving ? "Guardando..." : editingService ? "Guardar cambios" : "Crear servicio"}
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
