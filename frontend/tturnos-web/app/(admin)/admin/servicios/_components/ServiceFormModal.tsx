"use client";

import { useEffect, useRef, useState } from "react";
import { logError } from "@/src/lib/logger";
import CloudinaryUpload from "@/src/components/forms/CloudinaryUpload";
import { Button } from "@/src/components/shared/Button";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

const DIACRITICS_RE = new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g");

export interface Service {
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

export interface InsumoOption { id: number; name: string; stock: number; }
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

export default function ServiceFormModal({
  initial,
  insumosCatalog,
  onClose,
  onSaved,
  onError,
}: {
  initial: Service | null;
  insumosCatalog: InsumoOption[];
  onClose: () => void;
  onSaved: (message?: string) => void;
  onError: (message?: string) => void;
}) {
  const [formData, setFormData] = useState(() =>
    initial
      ? {
          title: initial.title,
          slug: initial.slug,
          price: initial.price,
          duration: initial.duration,
          imageUrl: initial.imageUrl,
          details: initial.details.length >= 3 ? [...initial.details] : [...initial.details, "", "", ""].slice(0, 3),
          isActive: initial.isActive,
          description: initial.description ?? "",
          order: initial.order,
          category: initial.category ?? "",
          bufferMinutes: initial.bufferMinutes,
          color: initial.color,
        }
      : { ...emptyForm, details: ["", "", ""] }
  );
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>(() => {
    if (!initial?.customFieldsSchema) return [];
    try {
      return JSON.parse(initial.customFieldsSchema);
    } catch {
      return [];
    }
  });
  const [recipe, setRecipe] = useState<RecipeItem[]>([]);
  const [newRecipeItem, setNewRecipeItem] = useState({ insumoId: 0, quantity: 1 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initial) return;
    fetch(`/api/services/${initial.id}/recipe`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setRecipe(Array.isArray(data) ? data : []))
      .catch((error) => logError("Error cargando receta del servicio:", error));
  }, [initial]);

  const formRef = useRef<HTMLFormElement>(null);
  useModalHotkeys(true, { onClose, onSubmit: () => formRef.current?.requestSubmit() });

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
      .normalize("NFD").replace(DIACRITICS_RE, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    setFormData((prev) => ({ ...prev, title, slug: initial ? prev.slug : slug }));
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
      const url = initial ? `/api/services/${initial.id}` : "/api/services";
      const method = initial ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        const serviceId = initial ? initial.id : data.id;
        await fetch(`/api/services/${serviceId}/recipe`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: recipe.map((r) => ({ insumoId: r.insumoId, quantity: r.quantity })) }),
        });
        onSaved(data.message);
        onClose();
      } else {
        onError(data.message || "No se pudo guardar el servicio");
      }
    } catch {
      onError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-ivory border border-mauve/10 rounded-2xl p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-charcoal">
            {initial ? "Editar Servicio" : "Nuevo Servicio"}
          </h2>
          <button onClick={onClose} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
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
                        const key = field.key || name.toLowerCase().normalize("NFD").replace(DIACRITICS_RE, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
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
              {saving ? "Guardando..." : initial ? "Guardar cambios" : "Crear servicio"}
            </Button>
            <Button type="button" onClick={onClose} variant="secondary">
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
