"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { Button } from "@/src/components/shared/Button";
import type { Service, InsumoOption } from "./_components/ServiceFormModal";
import { distinctCategories } from "@/src/components/forms/CategoryCombobox";

// El formulario (imagen, receta de insumos, campos dinámicos) es el bloque
// más pesado de la página y solo hace falta al crear/editar un servicio:
// diferirlo evita que entre en el compile/bundle inicial de la ruta.
const ServiceFormModal = dynamic(() => import("./_components/ServiceFormModal"), { ssr: false });

export default function ServiciosAdminPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { toasts, showToast, removeToast } = useToast();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [insumosCatalog, setInsumosCatalog] = useState<InsumoOption[]>([]);

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
    setShowForm(true);
  };

  const openEdit = (service: Service) => {
    setEditingService(service);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingService(null);
  };

  const handleSaved = (message?: string) => {
    showToast("success", editingService ? "Servicio actualizado" : "Servicio creado", message);
    loadServices();
  };

  const handleFormError = (message?: string) => {
    showToast("error", "Error", message);
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

      {showForm && (
        <ServiceFormModal
          initial={editingService}
          insumosCatalog={insumosCatalog}
          categorySuggestions={distinctCategories(services.map((s) => s.category))}
          categoryDefaults={[...services]
            .filter((s) => s.category?.trim())
            .sort((a, b) => b.id - a.id)
            .map((s) => ({ category: s.category!, color: s.color, bufferMinutes: s.bufferMinutes }))}
          onClose={closeForm}
          onSaved={handleSaved}
          onError={handleFormError}
        />
      )}
    </div>
  );
}
