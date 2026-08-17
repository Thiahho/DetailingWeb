"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import { Button } from "@/src/components/shared/Button";
import type { Service, InsumoOption } from "./_components/ServiceFormModal";

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
  const { confirm, ConfirmDialog } = useConfirm();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [insumosCatalog, setInsumosCatalog] = useState<InsumoOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.length === services.length ? [] : services.map((s) => s.id)));
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!(await confirm({ message: `¿Eliminar ${selectedIds.length} servicio(s)? Esta acción no se puede deshacer.`, confirmLabel: "Eliminar" }))) return;

    setBulkDeleting(true);
    try {
      const results = await Promise.all(
        selectedIds.map((id) => fetch(`/api/services/${id}`, { method: "DELETE" }).then((r) => r.ok))
      );
      const okCount = results.filter(Boolean).length;
      const failCount = results.length - okCount;

      if (okCount > 0) {
        showToast(
          "warning",
          "Servicios eliminados",
          failCount > 0 ? `${okCount} eliminado(s), ${failCount} no se pudieron eliminar` : `${okCount} servicio(s) eliminado(s) correctamente`,
          4000
        );
        setSelectedIds([]);
        loadServices();
      } else {
        showToast("error", "Error", "No se pudo eliminar ningún servicio");
      }
    } catch (error) {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
      logError(error);
    } finally {
      setBulkDeleting(false);
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
      {ConfirmDialog}

      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 md:mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Gestión de Servicios</h1>
            <p className="text-charcoal/50 text-sm mt-1">
              Administrá los servicios que se muestran en tu sitio y formulario de reserva
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {services.length > 0 && (
              <button
                type="button"
                data-testid="service-select-all"
                onClick={toggleSelectAll}
                className="text-xs text-charcoal/50 hover:text-charcoal font-medium transition px-2"
              >
                {selectedIds.length === services.length ? "Deseleccionar todos" : "Seleccionar todos"}
              </button>
            )}
            {selectedIds.length > 0 && (
              <Button
                onClick={bulkDelete}
                disabled={bulkDeleting}
                data-testid="service-bulk-delete-button"
                variant="danger"
                className="shrink-0"
              >
                {bulkDeleting ? "Eliminando..." : `Eliminar seleccionados (${selectedIds.length})`}
              </Button>
            )}
            <Button onClick={openCreate} data-testid="service-create-button" variant="primary" className="shrink-0 flex items-center gap-2">
              <span className="text-xl leading-none">+</span>
              <span className="hidden sm:inline">Nuevo Servicio</span>
              <span className="sm:hidden">Nuevo</span>
            </Button>
          </div>
        </div>

        {/* Grid de servicios */}
        {services.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-mauve/10 rounded-xl">
            <p className="text-charcoal/40 text-lg">No hay servicios cargados</p>
            <button onClick={openCreate} className="mt-4 text-blush hover:text-blushdark transition text-sm">
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
                onClick={() => toggleSelect(service.id)}
                className={`relative bg-ivory border rounded-xl overflow-hidden transition cursor-pointer ${
                  selectedIds.includes(service.id) ? "ring-2 ring-blush/60" : ""
                } ${service.isActive ? "border-mauve/15" : "border-orange-200 opacity-60"}`}
              >
                <label
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-2 left-2 z-10 flex items-center justify-center w-6 h-6 rounded-md bg-cream/80 backdrop-blur-sm cursor-pointer"
                  title="Seleccionar"
                >
                  <input
                    type="checkbox"
                    data-testid="service-select-checkbox"
                    checked={selectedIds.includes(service.id)}
                    onChange={() => toggleSelect(service.id)}
                    className="accent-blush w-4 h-4 cursor-pointer"
                  />
                </label>

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
                          ? "bg-green-500/20 text-green-400"
                          : "bg-orange-500/20 text-orange-400"
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

                  <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
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
          onClose={closeForm}
          onSaved={handleSaved}
          onError={handleFormError}
        />
      )}
    </div>
  );
}
