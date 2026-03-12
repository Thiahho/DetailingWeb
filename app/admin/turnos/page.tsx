"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "../../../src/lib/auth";
import { logError } from "../../../src/lib/logger";

// --- Interfaces ---
interface Booking {
  id: number;
  customerName: string;
  customerPhone: string;
  vehicle: string;
  service: string;
  message?: string;
  status: string;
}

interface TimeSlot {
  id: number;
  startDateTime: string;
  endDateTime: string;
  isAvailable: boolean;
  bookingsCount: number;
  label: string;
  booking?: Booking;
}

// --- Toast Types ---
type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// --- Toast Component ---
function ToastNotification({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration || 4000;
    const exitTimer = setTimeout(() => setIsExiting(true), duration - 300);
    const closeTimer = setTimeout(onClose, duration);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
    };
  }, [toast.duration, onClose]);

  const icons = {
    success: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const styles = {
    success: {
      bg: "bg-gradient-to-r from-green-600 to-green-500",
      border: "border-green-400",
      glow: "shadow-[0_0_30px_rgba(34,197,94,0.4)]",
      icon: "bg-green-400/20",
    },
    error: {
      bg: "bg-gradient-to-r from-red-600 to-red-500",
      border: "border-red-400",
      glow: "shadow-[0_0_30px_rgba(239,68,68,0.4)]",
      icon: "bg-red-400/20",
    },
    warning: {
      bg: "bg-gradient-to-r from-orange-600 to-orange-500",
      border: "border-orange-400",
      glow: "shadow-[0_0_30px_rgba(249,115,22,0.4)]",
      icon: "bg-orange-400/20",
    },
    info: {
      bg: "bg-gradient-to-r from-blue-600 to-blue-500",
      border: "border-blue-400",
      glow: "shadow-[0_0_30px_rgba(59,130,246,0.4)]",
      icon: "bg-blue-400/20",
    },
  };

  const style = styles[toast.type];

  return (
    <div
      className={`
        ${style.bg} ${style.glow}
        border ${style.border}
        rounded-xl p-4 pr-12 min-w-[320px] max-w-[420px]
        transform transition-all duration-300 ease-out
        ${isExiting ? "translate-x-[120%] opacity-0" : "translate-x-0 opacity-100"}
        animate-slide-in
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`${style.icon} p-2 rounded-lg`}>
          {icons[toast.type]}
        </div>
        <div className="flex-1 pt-0.5">
          <p className="font-bold text-white text-[15px]">{toast.title}</p>
          {toast.message && (
            <p className="text-white/80 text-sm mt-1">{toast.message}</p>
          )}
        </div>
      </div>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(onClose, 300);
        }}
        className="absolute top-3 right-3 text-white/60 hover:text-white transition p-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// --- Toast Container ---
function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: number) => void }) {
  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3">
      {toasts.map((toast) => (
        <ToastNotification key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

// --- Componente Principal ---
export default function TurnosPage() {
  const router = useRouter();

  // Estados de datos
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<TimeSlot[]>([]);

  // Estados de formulario
  const [formData, setFormData] = useState({ date: "", hour: "09", minute: "00" });
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [creating, setCreating] = useState(false);

  // Estados de Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // Estados de Selección Múltiple
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState(false);

  // Estado modal detalle
  const [detailSlot, setDetailSlot] = useState<TimeSlot | null>(null);

  // Estados de Toast
  const [toasts, setToasts] = useState<Toast[]>([]);
  let toastIdCounter = 0;

  const showToast = useCallback((type: ToastType, title: string, message?: string, duration?: number) => {
    const id = Date.now() + toastIdCounter++;
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/admin/login");
      return;
    }
    loadSlots();
  }, [router]);

  // --- Lógica de Carga y CRUD (Igual que tu código original) ---
  const loadSlots = async () => {
    try {
      const response = await fetch("/api/timeslots");
      if (response.ok) {
        const data = await response.json();
        setSlots(data);
      }
    } catch (error) {
      logError("Error cargando turnos:", error);
    } finally {
      setLoading(false);
    }
  };

  const createSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      // Enviar fecha como string local (sin conversión UTC)
      const startDateTime = `${formData.date}T${formData.hour}:${formData.minute}:00`;
      // Calcular endDateTime sumando 2 horas manualmente
      let endHour = parseInt(formData.hour) + 2;
      let endDate = formData.date;
      if (endHour >= 24) {
        endHour -= 24;
        // Sumar un día
        const nextDay = new Date(formData.date);
        nextDay.setDate(nextDay.getDate() + 1);
        endDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;
      }
      const endDateTime = `${endDate}T${String(endHour).padStart(2, "0")}:${formData.minute}:00`;

      const response = await fetch("/api/timeslots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDateTime,
          endDateTime,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        showToast("success", "Turno Creado", `Turno para el ${formData.date} a las ${formData.hour}:${formData.minute} creado exitosamente`, 5000);
        setFormData({ date: "", hour: "09", minute: "00" });
        loadSlots();
      } else {
        showToast("error", "Error al crear turno", data.message || "No se pudo crear el turno");
      }
    } catch (error) {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
      logError(error);
    } finally {
      setCreating(false);
    }
  };

  const updateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot) return;
    setCreating(true);
    try {
      // Enviar fecha como string local (sin conversión UTC)
      const startDateTime = `${formData.date}T${formData.hour}:${formData.minute}:00`;
      //console.log("Enviando al servidor:", { date: formData.date, hour: formData.hour, minute: formData.minute, startDateTime });
      const response = await fetch(`/api/timeslots/${editingSlot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDateTime,
        }),
      });
      if (response.ok) {
        showToast("success", "Turno Actualizado", "Los cambios se guardaron correctamente", 4000);
        setFormData({ date: "", hour: "09", minute: "00" });
        setEditingSlot(null);
        loadSlots();
      } else {
        showToast("error", "Error al actualizar", "No se pudieron guardar los cambios");
      }
    } catch (error) {
      logError(error);
    } finally {
      setCreating(false);
    }
  };

  const deleteSlot = async (id: number) => {
    if (!confirm("¿Eliminar este turno?")) return;
    try {
      const response = await fetch(`/api/timeslots/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        showToast("warning", "Turno Eliminado", "El turno fue eliminado correctamente", 3500);
        loadSlots();
      }
    } catch (error) {
      showToast("error", "Error", "No se pudo eliminar el turno");
      logError(error);
    }
  };

  const habilitarTurno = async (id: number) => {
    if (!confirm("¿Habilitar este turno? La reserva será cancelada.")) return;
    try {
      const response = await fetch(`/api/timeslots/${id}/release`, {
        method: "PUT",
      });
      if (response.ok) {
        showToast("success", "Turno Habilitado", "El turno fue liberado y está disponible nuevamente", 5000);
        loadSlots();
      }
    } catch (error) {
      showToast("error", "Error", "No se pudo habilitar el turno");
      logError(error);
    }
  };

  // --- Funciones de Selección Múltiple ---
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === slots.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(slots.map((s) => s.id));
    }
  };

  const selectAllPage = () => {
    const pageIds = currentSlots.map((s) => s.id);
    const allPageSelected = pageIds.every((id) => selectedIds.includes(id));
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  const bulkDelete = async () => {
    const availableSelected = slots.filter(
      (s) => selectedIds.includes(s.id) && s.isAvailable
    );
    if (availableSelected.length === 0) {
      showToast("warning", "Acción no permitida", "Solo se pueden eliminar turnos habilitados");
      return;
    }
    if (!confirm(`¿Eliminar ${availableSelected.length} turno(s)?`)) return;

    setBulkAction(true);
    try {
      for (const slot of availableSelected) {
        await fetch(`/api/timeslots/${slot.id}`, { method: "DELETE" });
      }
      setSelectedIds([]);
      showToast("warning", "Turnos Eliminados", `${availableSelected.length} turno(s) eliminado(s) correctamente`, 4000);
      loadSlots();
    } catch (error) {
      showToast("error", "Error", "No se pudieron eliminar algunos turnos");
      logError(error);
    } finally {
      setBulkAction(false);
    }
  };

  const bulkRelease = async () => {
    const reservedSelected = slots.filter(
      (s) => selectedIds.includes(s.id) && !s.isAvailable
    );
    if (reservedSelected.length === 0) {
      showToast("warning", "Acción no permitida", "Solo se pueden habilitar turnos reservados");
      return;
    }
    if (!confirm(`¿Habilitar ${reservedSelected.length} turno(s)? Las reservas serán canceladas.`)) return;

    setBulkAction(true);
    try {
      for (const slot of reservedSelected) {
        await fetch(`/api/timeslots/${slot.id}/release`, { method: "PUT" });
      }
      setSelectedIds([]);
      showToast("success", "Turnos Habilitados", `${reservedSelected.length} turno(s) liberado(s) y disponible(s) nuevamente`, 5000);
      loadSlots();
    } catch (error) {
      showToast("error", "Error", "No se pudieron habilitar algunos turnos");
      logError(error);
    } finally {
      setBulkAction(false);
    }
  };

  const startEditing = (slot: TimeSlot) => {
    setEditingSlot(slot);
    // Extraer fecha y hora directamente del string sin conversión de zona horaria
    // El formato es "2024-02-04T17:35:00" o "2024-02-04T17:35:00Z"
    const isoString = slot.startDateTime.replace("Z", "");
    const [datePart, timePart] = isoString.split("T");
    const [hour, minute] = timePart.split(":");
    setFormData({
      date: datePart,
      hour: hour.padStart(2, "0"),
      minute: minute.padStart(2, "0"),
    });
  };

  const cancelEditing = () => {
    setEditingSlot(null);
    setFormData({ date: "", hour: "09", minute: "00" });
  };

  // --- Lógica de Paginación ---
  const totalPages = Math.ceil(slots.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentSlots = slots.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1115]">
        <p className="text-white">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 font-sans">
      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Estilos de animación */}
      <style jsx global>{`
        @keyframes slide-in {
          from {
            transform: translateX(120%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className="mx-auto max-w-6xl">
        {/* Encabezado Principal */}
        <div className="mb-6 md:mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Gestión de Turnos</h1>
            <p className="text-white/50 text-sm mt-1">
              Administra los turnos disponibles para reservas
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/admin/estadisticas"
              className="bg-[#161b22] border border-white/10 hover:border-white/20 text-white/70 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Estadísticas
            </a>
            <a
              href="/admin/servicios"
              className="bg-[#161b22] border border-white/10 hover:border-white/20 text-white/70 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Servicios
            </a>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* COLUMNA IZQUIERDA: Formulario */}
          <div className="bg-[#161b22] border border-white/5 rounded-xl p-6 h-fit md:sticky md:top-6 z-20 relative">
            <h2 className="text-xl font-semibold text-white mb-6">
              {editingSlot ? "Editar Turno" : "Crear Turno Disponible"}
            </h2>
            <form
              onSubmit={editingSlot ? updateSlot : createSlot}
              className="space-y-5"
            >
              <div>
                <label className="text-white/70 text-sm font-medium">
                  Fecha
                </label>
                <input
                  type="date"
                  className="w-full mt-2 bg-[#0d1117] border border-white/10 rounded-lg p-3 text-white focus:border-green-500 focus:outline-none transition-colors"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, date: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <label className="text-white/70 text-sm font-medium">
                  Hora inicio
                </label>
                <div className="flex gap-2 mt-2 items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="HH"
                    className="w-20 bg-[#0d1117] border border-white/10 rounded-lg p-3 text-white text-center focus:border-green-500 focus:outline-none transition-colors"
                    value={formData.hour}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setFormData((prev) => ({ ...prev, hour: val }));
                    }}
                    onBlur={(e) => {
                      const num = Math.min(23, Math.max(0, parseInt(e.target.value) || 0));
                      setFormData((prev) => ({ ...prev, hour: String(num).padStart(2, "0") }));
                    }}
                    required
                  />
                  <span className="text-white/50 text-xl font-bold">:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="MM"
                    className="w-20 bg-[#0d1117] border border-white/10 rounded-lg p-3 text-white text-center focus:border-green-500 focus:outline-none transition-colors"
                    value={formData.minute}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setFormData((prev) => ({ ...prev, minute: val }));
                    }}
                    onBlur={(e) => {
                      const num = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                      setFormData((prev) => ({ ...prev, minute: String(num).padStart(2, "0") }));
                    }}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {creating
                    ? "Procesando..."
                    : editingSlot
                    ? "Guardar Cambios"
                    : "Crear Turno"}
                </button>

                {editingSlot && (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="px-6 bg-white/5 text-white py-3 rounded-lg font-semibold hover:bg-white/10 transition"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* COLUMNA DERECHA: Lista Estilo Imagen */}
          <div className="bg-[#161b22] border border-white/5 rounded-xl p-6 flex flex-col h-[700px]">
            {/* Header de la lista */}
            <div className="flex justify-between items-center mb-4 px-1">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.length === slots.length && slots.length > 0}
                  onChange={selectAll}
                  className="w-4 h-4 accent-green-500 cursor-pointer"
                  title="Seleccionar todos"
                />
                <h2 className="text-xl font-bold text-white">
                  Turnos Creados{" "}
                  <span className="text-white/60 text-lg font-normal">
                    ({slots.length})
                  </span>
                </h2>
              </div>
              {selectedIds.length > 0 && (
                <span className="text-sm text-white/50">
                  {selectedIds.length} seleccionado(s)
                </span>
              )}
            </div>

            {/* Acciones en lote */}
            {selectedIds.length > 0 && (
              <div className="flex gap-2 mb-4 px-1">
                <button
                  onClick={bulkRelease}
                  disabled={bulkAction}
                  className="flex-1 bg-green-600/20 border border-green-600/50 text-green-400 hover:bg-green-600/30 py-2 px-4 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {bulkAction ? "Procesando..." : "Habilitar seleccionados"}
                </button>
                <button
                  onClick={bulkDelete}
                  disabled={bulkAction}
                  className="flex-1 bg-red-600/20 border border-red-600/50 text-red-400 hover:bg-red-600/30 py-2 px-4 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {bulkAction ? "Procesando..." : "Eliminar seleccionados"}
                </button>
              </div>
            )}

            {/* Contenedor de Scroll y Lista */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {slots.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-white/30 border border-dashed border-white/10 rounded-lg">
                  <p>No hay turnos disponibles</p>
                </div>
              ) : (
                currentSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className={`
                      group relative p-4 rounded-lg border transition-all duration-200
                      ${
                        slot.isAvailable
                          ? "bg-[#0f291e]/40 border-green-900/50 hover:border-green-700/50"
                          : "bg-orange-900/10 border-orange-900/30 hover:border-orange-700/50"
                      }
                      ${selectedIds.includes(slot.id) ? "ring-2 ring-white/30" : ""}
                    `}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(slot.id)}
                          onChange={() => toggleSelect(slot.id)}
                          className="w-4 h-4 mt-1 accent-green-500 cursor-pointer"
                        />
                        <div>
                          {/* Fecha y Hora */}
                          <p className="text-white font-medium text-[15px] tracking-wide">
                            {formatDateFriendly(slot.startDateTime)}
                          </p>

                          {/* Estado */}
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                slot.isAvailable
                                  ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                                  : "bg-orange-500"
                              }`}
                            ></span>
                            <span
                              className={`text-xs font-bold tracking-wider ${
                                slot.isAvailable
                                  ? "text-green-500"
                                  : "text-orange-500"
                              }`}
                            >
                              {slot.isAvailable ? "HABILITADO" : "RESERVADO"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Botones de Acción (Editar/Eliminar) */}
                      <div className="flex flex-col items-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        {slot.isAvailable ? (
                          <>
                            <button
                              onClick={() => startEditing(slot)}
                              className="text-blue-400 hover:text-blue-300 text-xs font-medium uppercase tracking-wide transition"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => deleteSlot(slot.id)}
                              className="text-red-400 hover:text-red-300 text-xs font-medium uppercase tracking-wide transition"
                            >
                              Eliminar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setDetailSlot(slot)}
                              className="text-blue-400 hover:text-blue-300 text-xs font-medium uppercase tracking-wide transition"
                            >
                              Ver detalle
                            </button>
                            <button
                              onClick={() => habilitarTurno(slot.id)}
                              className="text-green-400 hover:text-green-300 text-xs font-medium uppercase tracking-wide transition"
                            >
                              Liberar
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Información Extra si está reservado */}
                    {!slot.isAvailable && slot.booking && (
                      <div className="mt-3 pt-3 border-t border-white/5 text-xs text-white/60">
                        Reservado por:{" "}
                        <span className="text-white">
                          {slot.booking.customerName}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* --- Footer / Paginación --- */}
            {slots.length > 0 && (
              <div className="pt-6 mt-2 flex justify-center items-center gap-4 border-t border-white/5">
                {/* Flecha Izquierda */}
                <button
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                  className="p-2 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                {/* Números de Página */}
                <div className="flex gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                        ${
                          currentPage === page
                            ? "bg-white text-black scale-110 shadow-lg"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }
                      `}
                      >
                        {page}
                      </button>
                    )
                  )}
                </div>

                {/* Flecha Derecha */}
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="p-2 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DETALLE DE RESERVA */}
      {detailSlot && detailSlot.booking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setDetailSlot(null)}
        >
          <div
            className="bg-[#161b22] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div>
                <h2 className="text-white font-semibold text-lg">Detalle de reserva</h2>
                <p className="text-white/40 text-xs mt-0.5">{formatDateFriendly(detailSlot.startDateTime)}</p>
              </div>
              <button onClick={() => setDetailSlot(null)} className="text-white/40 hover:text-white transition text-xl">✕</button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <Row label="Cliente" value={detailSlot.booking.customerName} />
              <Row label="Teléfono" value={
                <a href={`tel:${detailSlot.booking.customerPhone}`} className="text-blue-400 hover:underline">
                  {detailSlot.booking.customerPhone}
                </a>
              } />
              <Row label="Vehículo" value={detailSlot.booking.vehicle} />
              <Row label="Servicio" value={detailSlot.booking.service || "—"} />
              {detailSlot.booking.message && (
                <Row label="Mensaje" value={detailSlot.booking.message} />
              )}
              <Row label="Estado" value={
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  detailSlot.booking.status === "Confirmed"
                    ? "bg-green-500/20 text-green-400"
                    : detailSlot.booking.status === "Cancelled"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-orange-500/20 text-orange-400"
                }`}>
                  {detailSlot.booking.status === "Confirmed" ? "Confirmado"
                    : detailSlot.booking.status === "Cancelled" ? "Cancelado"
                    : "Pendiente"}
                </span>
              } />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/5 flex gap-3">
              <a
                href={`https://wa.me/+54${detailSlot.booking.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                  `Hola ${detailSlot.booking.customerName} 👋\n\nTe confirmamos tu reserva en *AutoDetail Studio*:\n\n📅 *Fecha:* ${formatDateFriendly(detailSlot.startDateTime)}\n🚗 *Vehículo:* ${detailSlot.booking.vehicle}\n🔧 *Servicio:* ${detailSlot.booking.service || "—"}\n\n¡Nos vemos! Cualquier consulta estamos a disposición.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-lg text-sm font-semibold transition"
              >
                WhatsApp
              </a>
              <button
                onClick={() => { setDetailSlot(null); habilitarTurno(detailSlot.id); }}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white/70 py-2.5 rounded-lg text-sm font-semibold transition"
              >
                Liberar turno
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-white/40 text-sm shrink-0">{label}</span>
      <span className="text-white text-sm text-right">{value}</span>
    </div>
  );
}

// Helper para formatear fecha estilo "jue 15/01/2026 - 15:30"
function formatDateFriendly(isoString: string) {
  // Extraer valores directamente del string sin conversión de zona horaria
  const cleanString = isoString.replace("Z", "");
  const [datePart, timePart] = cleanString.split("T");
  const [year, month, day] = datePart.split("-");
  const [hours, minutes] = timePart.split(":");

  // Calcular día de la semana
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const days = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const dayName = days[date.getDay()];

  return `${dayName} ${day}/${month}/${year} - ${hours}:${minutes}`;
}
