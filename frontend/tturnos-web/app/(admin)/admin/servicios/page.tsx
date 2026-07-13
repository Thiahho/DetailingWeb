"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import CloudinaryUpload from "@/src/components/forms/CloudinaryUpload";

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
}

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
};

// --- Toast ---
type ToastType = "success" | "error" | "warning";
interface Toast { id: number; type: ToastType; title: string; message?: string }

function ToastNotification({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), 3700);
    const t2 = setTimeout(onClose, 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onClose]);

  const colors = {
    success: "from-green-600 to-green-500 border-green-400 shadow-green-500/30",
    error: "from-red-600 to-red-500 border-red-400 shadow-red-500/30",
    warning: "from-orange-600 to-orange-500 border-orange-400 shadow-orange-500/30",
  };

  return (
    <div className={`bg-gradient-to-r ${colors[toast.type]} border rounded-xl p-4 pr-12 min-w-[300px] shadow-lg transition-all duration-300 ${exiting ? "translate-x-[120%] opacity-0" : "translate-x-0 opacity-100"}`}>
      <p className="font-bold text-charcoal">{toast.title}</p>
      {toast.message && <p className="text-charcoal/80 text-sm mt-1">{toast.message}</p>}
      <button onClick={() => { setExiting(true); setTimeout(onClose, 300); }} className="absolute top-3 right-3 text-charcoal/60 hover:text-charcoal">✕</button>
    </div>
  );
}

export default function ServiciosAdminPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: Date.now(), type, title, message }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
      return;
    }
    loadServices();
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
    setShowForm(true);
  };

  const openEdit = (service: Service) => {
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
    });
    try {
      setCustomFields(service.customFieldsSchema ? JSON.parse(service.customFieldsSchema) : []);
    } catch {
      setCustomFields([]);
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingService(null);
    setFormData({ ...emptyForm, details: ["", "", ""] });
    setCustomFields([]);
  };

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
      {/* Toasts */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3">
        {toasts.map((t) => (
          <ToastNotification key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 md:mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Gestión de Servicios</h1>
            <p className="text-charcoal/50 text-sm mt-1">
              Administrá los servicios que se muestran en tu sitio y formulario de reserva
            </p>
          </div>
          <button
            onClick={openCreate}
            data-testid="service-create-button"
            className="shrink-0 bg-blush hover:bg-blushdark text-white px-4 md:px-5 py-2.5 rounded-lg font-semibold shadow-glow transition flex items-center gap-2 text-sm md:text-base"
          >
            <span className="text-xl leading-none">+</span>
            <span className="hidden sm:inline">Nuevo Servicio</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        </div>

        {/* Grid de servicios */}
        {services.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-mauve/10 rounded-xl">
            <p className="text-charcoal/40 text-lg">No hay servicios cargados</p>
            <button onClick={openCreate} className="mt-4 text-green-700 hover:text-green-700 transition text-sm">
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
                    <h3 className="text-charcoal font-semibold text-[15px] leading-tight">{service.title}</h3>
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

                  <p className="text-charcoal/60 text-sm">{service.price} · {service.duration}</p>

                  <ul className="mt-3 space-y-1">
                    {service.details.map((d, i) => (
                      <li key={i} className="text-charcoal/40 text-xs flex items-start gap-1.5">
                        <span className="text-green-500 mt-0.5">✓</span> {d}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => openEdit(service)}
                      data-testid="service-edit-button"
                      className="flex-1 bg-porcelain/5 hover:bg-porcelain/10 text-charcoal text-sm py-2 rounded-lg transition"
                    >
                      Editar
                    </button>
                    {deleteConfirmId === service.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDelete(service.id)}
                          data-testid="service-delete-confirm-button"
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
                        onClick={() => setDeleteConfirmId(service.id)}
                        data-testid="service-delete-button"
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
      </div>

      {/* Modal Formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={closeForm}>
          <div
            className="bg-ivory border border-mauve/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-charcoal">
                {editingService ? "Editar Servicio" : "Nuevo Servicio"}
              </h2>
              <button onClick={closeForm} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Título */}
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Título</label>
                <input
                  className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition"
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
                  className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal/70 focus:border-green-500 focus:outline-none transition font-mono text-sm"
                  data-testid="service-form-slug"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="daily-reset"
                  required
                />
              </div>

              {/* Precio y Duración */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Precio</label>
                  <input
                    className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition"
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
                    className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition"
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
                  className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition text-sm resize-none"
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
                      className="w-full bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition text-sm"
                      value={detail}
                      onChange={(e) => updateDetail(i, e.target.value)}
                      placeholder={`Detalle ${i + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* Orden y Estado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Orden</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition"
                    value={formData.order}
                    onChange={(e) => setFormData((prev) => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Estado</label>
                  <select
                    className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition"
                    value={formData.isActive ? "true" : "false"}
                    onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.value === "true" }))}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>

              {/* Campos dinámicos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Campos adicionales del formulario</label>
                  <button
                    type="button"
                    onClick={() => setCustomFields((prev) => [...prev, emptyField()])}
                    className="text-green-700 hover:text-green-700 text-xs transition"
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
                      <div className="flex gap-2">
                        <input
                          className="flex-1 bg-black/30 border border-mauve/10 rounded p-2 text-charcoal text-sm focus:border-green-500 focus:outline-none"
                          placeholder="Nombre del campo"
                          value={field.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            const key = field.key || name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
                            updateCustomField(i, { name, key: field.key ? field.key : key });
                          }}
                        />
                        <input
                          className="w-28 bg-black/30 border border-mauve/10 rounded p-2 text-charcoal/70 text-sm font-mono focus:border-green-500 focus:outline-none"
                          placeholder="key"
                          value={field.key}
                          onChange={(e) => updateCustomField(i, { key: e.target.value })}
                        />
                        <button type="button" onClick={() => removeCustomField(i)} className="text-red-600/70 hover:text-red-600 px-1">✕</button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <select
                          className="bg-black/30 border border-mauve/10 rounded p-2 text-charcoal text-sm focus:border-green-500 focus:outline-none"
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
                            className="w-full bg-black/30 border border-mauve/10 rounded p-2 text-charcoal text-sm focus:border-green-500 focus:outline-none resize-none"
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
                <button
                  type="submit"
                  disabled={saving}
                  data-testid="service-form-submit"
                  className="flex-1 bg-blush hover:bg-blushdark text-white py-3 rounded-lg font-semibold shadow-glow transition disabled:opacity-50"
                >
                  {saving ? "Guardando..." : editingService ? "Guardar cambios" : "Crear servicio"}
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
    </div>
  );
}
