"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { Button } from "@/src/components/shared/Button";

// --- Interfaces ---
interface Booking {
  id: number;
  customerName: string;
  customerPhone: string;
  email?: string;
  subject: string;
  service: string;
  professionalId?: number | null;
  professionalName?: string | null;
  message?: string;
  status: string;
  customFieldsJson?: string;
  paymentStatus?: string | null;
  paymentAmount?: number | null;
  paymentPaidAt?: string | null;
  paymentProvider?: string | null;
}

interface TimeSlot {
  id: number;
  startDateTime: string;
  endDateTime: string;
  isAvailable: boolean;
  bookingsCount: number;
  label: string;
  booking?: Booking;
  professionalId?: number | null;
  professionalName?: string | null;
}

interface Professional {
  id: number;
  firstName: string;
  lastName: string;
}

const normalizeBookingStatus = (status: string) => {
  if (status === "Reservado") return "Pending";
  return status;
};

// --- Componente Principal ---
export default function TurnosPage() {
  const router = useRouter();

  // Estados de datos
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<TimeSlot[]>([]);

  // Estados de formulario
  const [formData, setFormData] = useState({ date: "", hour: "09", minute: "00", professionalId: "" });
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [creating, setCreating] = useState(false);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [professionalFilter, setProfessionalFilter] = useState<string>("all");

  // Estados de Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // Estados de Selección Múltiple
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState(false);

  // Estado modal detalle
  const [detailSlot, setDetailSlot] = useState<TimeSlot | null>(null);

  // Estado filtro por estado
  type StatusFilter = "all" | "available" | "pending" | "confirmed" | "expired";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const handleFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
      return;
    }
    loadSlots();
    fetch("/api/professionals").then((r) => r.json()).then((d) => setProfessionals(Array.isArray(d) ? d : [])).catch(() => {});
  }, [router]);

  // --- Lógica de Carga y CRUD (Igual que tu código original) ---
  const loadSlots = async () => {
    try {
      const response = await fetch("/api/timeslots");
      if (response.ok) {
        const data: TimeSlot[] = await response.json();
        const normalizedSlots = data.map((slot) => ({
          ...slot,
          booking: slot.booking
            ? { ...slot.booking, status: normalizeBookingStatus(slot.booking.status) }
            : undefined,
        }));
        setSlots(normalizedSlots);
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
        // Parsear con hora local para evitar desfase de timezone
        const [y, m, d] = formData.date.split("-").map(Number);
        const nextDay = new Date(y, m - 1, d + 1);
        endDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;
      }
      const endDateTime = `${endDate}T${String(endHour).padStart(2, "0")}:${formData.minute}:00`;

      const response = await fetch("/api/timeslots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDateTime,
          endDateTime,
          professionalId: formData.professionalId ? Number(formData.professionalId) : null,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        showToast("success", "Turno Creado", `Turno para el ${formData.date} a las ${formData.hour}:${formData.minute} creado exitosamente`, 5000);
        setFormData({ date: "", hour: "09", minute: "00", professionalId: formData.professionalId });
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
        setFormData({ date: "", hour: "09", minute: "00", professionalId: "" });
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

  const confirmarTurno = async (bookingId: number, booking?: Booking, slotStartDateTime?: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: booking?.email,
          customerName: booking?.customerName,
          subject: booking?.subject,
          service: booking?.service,
          startDateTime: slotStartDateTime,
        }),
      });
      if (response.ok) {
        showToast("success", "Turno Confirmado", "La reserva fue marcada como confirmada", 4000);
        setDetailSlot((prev) =>
          prev && prev.booking
            ? { ...prev, booking: { ...prev.booking, status: "Confirmed" } }
            : prev
        );
        setSlots((prev) =>
          prev.map((s) =>
            s.booking?.id === bookingId
              ? { ...s, booking: { ...s.booking!, status: "Confirmed" } }
              : s
          )
        );
        return true;
      } else {
        showToast("error", "Error", "No se pudo confirmar el turno");
        return false;
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
      return false;
    }
  };

  const buildWhatsAppUrl = (slot: TimeSlot) => {
    const booking = slot.booking;
    if (!booking) return "";

    const phone = booking.customerPhone.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Hola ${booking.customerName} 👋\n\nTe confirmamos tu reserva:\n\n📅 *Fecha:* ${formatDateFriendly(slot.startDateTime)}\n📝 *Trabajo:* ${booking.subject || "—"}\n🔧 *Servicio:* ${booking.service || "—"}\n\n¡Nos vemos! Cualquier consulta estamos a disposición.`
    );

    return `https://wa.me/+54${phone}?text=${message}`;
  };

  const confirmarYEnviarWhatsApp = async (slot: TimeSlot) => {
    if (!slot.booking) return;

    const alreadyConfirmed = slot.booking.status === "Confirmed";

    if (!alreadyConfirmed) {
      const confirmed = await confirmarTurno(slot.booking.id, slot.booking, slot.startDateTime);
      if (!confirmed) return;
    }

    const whatsappUrl = buildWhatsAppUrl(slot);
    if (whatsappUrl) {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }
  };

  const habilitarTurno = async (id: number, isConfirmed = false) => {
    const msg = isConfirmed
      ? "¿Cancelar este turno? La reserva quedará cancelada y la fecha se liberará."
      : "¿Liberar este turno? La fecha quedará disponible nuevamente.";
    if (!confirm(msg)) return;
    try {
      const response = await fetch(`/api/timeslots/${id}/release`, {
        method: "PUT",
      });
      if (response.ok) {
        showToast(
          "success",
          isConfirmed ? "Turno cancelado" : "Turno liberado",
          isConfirmed
            ? "La reserva fue cancelada y el turno está disponible nuevamente"
            : "El turno está disponible nuevamente",
          5000
        );
        loadSlots();
      }
    } catch (error) {
      showToast("error", "Error", isConfirmed ? "No se pudo cancelar el turno" : "No se pudo liberar el turno");
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
    if (selectedIds.length === filteredSlots.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSlots.map((s) => s.id));
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
      (s) => selectedIds.includes(s.id) && (s.isAvailable || isExpired(s.startDateTime))
    );
    if (availableSelected.length === 0) {
      showToast("warning", "Acción no permitida", "Solo se pueden eliminar turnos habilitados o expirados");
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
    if (!confirm(`¿Cancelar ${reservedSelected.length} turno(s)? Las reservas quedarán canceladas y las fechas se liberarán.`)) return;

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
      professionalId: slot.professionalId ? String(slot.professionalId) : "",
    });
  };

  const cancelEditing = () => {
    setEditingSlot(null);
    setFormData({ date: "", hour: "09", minute: "00", professionalId: "" });
  };

  // --- Filtrado por estado + profesional ---
  const filteredSlots = slots.filter((slot) => {
    if (professionalFilter !== "all" && String(slot.professionalId ?? "") !== professionalFilter) return false;
    if (statusFilter === "all") return true;
    const expired = isExpired(slot.startDateTime);
    if (statusFilter === "expired") return expired;
    if (expired) return false;
    if (statusFilter === "available") return slot.isAvailable;
    if (statusFilter === "pending") return !slot.isAvailable && slot.booking?.status !== "Confirmed";
    if (statusFilter === "confirmed") return !slot.isAvailable && slot.booking?.status === "Confirmed";
    return true;
  });

  // --- Lógica de Paginación ---
  const totalPages = Math.ceil(filteredSlots.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentSlots = filteredSlots.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory">
        <p className="text-charcoal">Cargando...</p>
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
            <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Gestión de Turnos</h1>
            <p className="text-charcoal/50 text-sm mt-1">
              Administra los turnos disponibles para reservas
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a
              href="/admin/estadisticas"
              className="bg-ivory border border-mauve/10 hover:border-mauve/20 text-charcoal/70 hover:text-charcoal px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Estadísticas
            </a>
            <a
              href="/admin/servicios"
              className="bg-ivory border border-mauve/10 hover:border-mauve/20 text-charcoal/70 hover:text-charcoal px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
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
          <div className="bg-ivory border border-mauve/5 rounded-xl p-6 h-fit md:sticky md:top-6 z-20 relative">
            <h2 className="text-xl font-semibold text-charcoal mb-6">
              {editingSlot ? "Editar Turno" : "Crear Turno Disponible"}
            </h2>
            <form
              onSubmit={editingSlot ? updateSlot : createSlot}
              className="space-y-5"
            >
              <div>
                <label className="text-charcoal/70 text-sm font-medium">
                  Fecha
                </label>
                <input
                  type="date"
                  data-testid="slot-form-date"
                  className="form-input mt-2"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, date: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <label className="text-charcoal/70 text-sm font-medium">
                  Hora inicio
                </label>
                <div className="flex gap-2 mt-2 items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="HH"
                    data-testid="slot-form-hour"
                    className="w-20 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal text-center focus:border-blush focus:outline-none transition-colors"
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
                  <span className="text-charcoal/50 text-xl font-bold">:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="MM"
                    data-testid="slot-form-minute"
                    className="w-20 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal text-center focus:border-blush focus:outline-none transition-colors"
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

              {!editingSlot && (
                <div>
                  <label className="text-charcoal/70 text-sm font-medium">
                    Profesional
                  </label>
                  <select
                    data-testid="slot-form-professional"
                    className="form-input mt-2"
                    value={formData.professionalId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, professionalId: e.target.value }))}
                    required
                  >
                    <option value="">Seleccioná un profesional</option>
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={creating}
                  data-testid="slot-form-submit"
                  variant="primary"
                  className="flex-1"
                >
                  {creating
                    ? "Procesando..."
                    : editingSlot
                    ? "Guardar Cambios"
                    : "Crear Turno"}
                </Button>

                {editingSlot && (
                  <Button type="button" onClick={cancelEditing} variant="secondary">
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* COLUMNA DERECHA: Lista Estilo Imagen */}
          <div className="bg-ivory border border-mauve/5 rounded-xl p-6 flex flex-col h-[70vh] md:h-[700px]">
            {/* Header de la lista */}
            <div className="flex justify-between items-center mb-4 px-1">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredSlots.length && filteredSlots.length > 0}
                  onChange={selectAll}
                  className="w-4 h-4 accent-green-500 cursor-pointer"
                  title="Seleccionar todos"
                />
                <h2 className="text-xl font-bold text-charcoal">
                  Turnos Creados{" "}
                  <span className="text-charcoal/60 text-lg font-normal">
                    ({statusFilter === "all" ? slots.length : `${filteredSlots.length}/${slots.length}`})
                  </span>
                </h2>
              </div>
              {selectedIds.length > 0 && (
                <span className="text-sm text-charcoal/50">
                  {selectedIds.length} seleccionado(s)
                </span>
              )}
            </div>

            {/* Filtro por estado */}
            <div className="flex gap-1.5 mb-3 px-1 flex-wrap">
              {(
                [
                  { key: "all", label: "Todos" },
                  { key: "available", label: "Habilitado" },
                  { key: "pending", label: "Reservado" },
                  { key: "confirmed", label: "Confirmado" },
                  { key: "expired", label: "Expirado" },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleFilterChange(key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                    statusFilter === key
                      ? "bg-white text-black"
                      : "bg-porcelain/10 text-charcoal/50 hover:bg-porcelain/20 hover:text-charcoal"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Filtro por profesional */}
            {professionals.length > 0 && (
              <div className="mb-3 px-1">
                <select
                  data-testid="slot-list-professional-filter"
                  className="w-full bg-porcelain/10 border border-mauve/10 rounded-lg px-3 py-1.5 text-xs text-charcoal focus:outline-none focus:border-blush"
                  value={professionalFilter}
                  onChange={(e) => { setProfessionalFilter(e.target.value); setCurrentPage(1); }}
                >
                  <option value="all">Todos los profesionales</option>
                  {professionals.map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Acciones en lote */}
            {selectedIds.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2 mb-4 px-1">
                <button
                  onClick={bulkRelease}
                  disabled={bulkAction}
                  className="flex-1 bg-green-600/20 border border-green-600/50 text-green-700 hover:bg-green-600/30 py-2 px-4 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {bulkAction ? "Procesando..." : "Habilitar seleccionados"}
                </button>
                <button
                  onClick={bulkDelete}
                  disabled={bulkAction}
                  className="flex-1 bg-red-600/20 border border-red-600/50 text-red-600 hover:bg-red-600/30 py-2 px-4 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {bulkAction ? "Procesando..." : "Eliminar seleccionados"}
                </button>
              </div>
            )}

            {/* Contenedor de Scroll y Lista */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {slots.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-charcoal/30 border border-dashed border-mauve/10 rounded-lg">
                  <p>No hay turnos disponibles</p>
                </div>
              ) : (
                currentSlots.map((slot) => {
                  const expired = isExpired(slot.startDateTime);
                  return (
                  <div
                    key={slot.id}
                    data-testid="slot-item"
                    data-slot-professional={slot.professionalName ?? ""}
                    className={`
                      group relative p-4 rounded-lg border transition-all duration-200
                      ${
                        expired
                          ? "bg-porcelain/[0.02] border-mauve/10 opacity-60"
                          : slot.isAvailable
                          ? "bg-green-50 border-green-200 hover:border-green-300"
                          : slot.booking?.status === "Confirmed"
                          ? "bg-blue-50 border-blue-200 hover:border-blue-300"
                          : "bg-orange-50 border-orange-200 hover:border-orange-300"
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
                          <p className={`font-medium text-[15px] tracking-wide ${expired ? "text-charcoal/50 line-through" : "text-charcoal"}`}>
                            {formatDateFriendly(slot.startDateTime)}
                          </p>

                          {/* Estado */}
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                expired
                                  ? "bg-porcelain/30"
                                  : slot.isAvailable
                                  ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                                  : slot.booking?.status === "Confirmed"
                                  ? "bg-blue-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                                  : "bg-orange-500"
                              }`}
                            ></span>
                            <span
                              className={`text-xs font-bold tracking-wider ${
                                expired
                                  ? "text-charcoal/40"
                                  : slot.isAvailable
                                  ? "text-green-500"
                                  : slot.booking?.status === "Confirmed"
                                  ? "text-blue-700"
                                  : "text-orange-500"
                              }`}
                            >
                              {expired
                                ? "EXPIRADO"
                                : slot.isAvailable
                                ? "HABILITADO"
                                : slot.booking?.status === "Confirmed"
                                ? "CONFIRMADO"
                                : "RESERVADO"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Botones de Acción */}
                      <div className="flex flex-col items-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        {expired ? (
                          <button
                            onClick={() => deleteSlot(slot.id)}
                            className="text-red-600 hover:text-red-600 text-xs font-medium uppercase tracking-wide transition"
                          >
                            Eliminar
                          </button>
                        ) : slot.isAvailable ? (
                          <>
                            <button
                              onClick={() => startEditing(slot)}
                              className="text-blushdark hover:text-blush text-xs font-medium uppercase tracking-wide transition"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => deleteSlot(slot.id)}
                              data-testid="slot-delete-button"
                              className="text-red-600 hover:text-red-600 text-xs font-medium uppercase tracking-wide transition"
                            >
                              Eliminar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setDetailSlot(slot)}
                              className="text-blushdark hover:text-blush text-xs font-medium uppercase tracking-wide transition"
                            >
                              Ver detalle
                            </button>
                            <button
                              onClick={() => habilitarTurno(slot.id)}
                              className="text-green-700 hover:text-green-700 text-xs font-medium uppercase tracking-wide transition"
                            >
                              Liberar
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Profesional dueño del turno, aunque todavía no esté reservado */}
                    {slot.isAvailable && slot.professionalName && (
                      <div className="mt-3 pt-3 border-t border-mauve/5 text-xs text-charcoal/50">
                        👤 {slot.professionalName}
                      </div>
                    )}

                    {/* Información Extra si está reservado */}
                    {!slot.isAvailable && slot.booking && (
                      <div className="mt-3 pt-3 border-t border-mauve/5 text-xs text-charcoal/60">
                        <div className="flex items-center justify-between">
                          <span>
                            {slot.booking?.status === "Confirmed" ? "Confirmado por:" : "Reservado por:"}{" "}
                            <span className="text-charcoal">
                              {slot.booking.customerName}
                            </span>
                            {slot.booking.professionalName && (
                              <span className="text-charcoal/40"> · 👤 {slot.booking.professionalName}</span>
                            )}
                          </span>
                          {slot.booking.paymentStatus === "Approved" && (
                            <span className="inline-flex items-center gap-1 bg-green-500/20 text-green-700 border border-green-500/30 rounded-full px-2 py-0.5 text-[10px] font-medium">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              Pagado
                            </span>
                          )}
                          {slot.booking.paymentStatus === "Pending" && (
                            <span className="inline-flex items-center gap-1 bg-yellow-500/20 text-yellow-700 border border-yellow-500/30 rounded-full px-2 py-0.5 text-[10px] font-medium">
                              Pago pendiente
                            </span>
                          )}
                          {!slot.booking.paymentStatus && (
                            <span className="inline-flex items-center gap-1 bg-porcelain/5 text-charcoal/30 border border-mauve/10 rounded-full px-2 py-0.5 text-[10px]">
                              Sin pago
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })
              )}
            </div>

            {/* --- Footer / Paginación --- */}
            {slots.length > 0 && (
              <div className="pt-6 mt-2 flex flex-wrap justify-center items-center gap-3 border-t border-mauve/5">
                {/* Flecha Izquierda */}
                <button
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                  className="p-2 text-charcoal/70 hover:text-charcoal disabled:opacity-30 disabled:cursor-not-allowed transition"
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

                {/* Números de Página (con elipsis si hay muchas) */}
                <div className="flex flex-wrap justify-center items-center gap-2">
                  {getPaginationRange(currentPage, totalPages).map((page, idx) =>
                    page === "..." ? (
                      <span
                        key={`dots-${idx}`}
                        className="w-8 h-8 flex items-center justify-center text-charcoal/30 text-sm select-none"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                        ${
                          currentPage === page
                            ? "bg-white text-black scale-110 shadow-lg"
                            : "bg-porcelain/10 text-charcoal hover:bg-porcelain/20"
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
                  className="p-2 text-charcoal/70 hover:text-charcoal disabled:opacity-30 disabled:cursor-not-allowed transition"
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
      {detailSlot && detailSlot.booking && (() => {
        const slotExpired = isExpired(detailSlot.startDateTime);
        return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setDetailSlot(null)}
        >
          <div
            className="bg-ivory border border-mauve/10 rounded-2xl w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-mauve/5">
              <div>
                <h2 className="text-charcoal font-semibold text-lg">Detalle de reserva</h2>
                <p className="text-charcoal/40 text-xs mt-0.5">{formatDateFriendly(detailSlot.startDateTime)}</p>
              </div>
              <button onClick={() => setDetailSlot(null)} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <Row label="Cliente" value={detailSlot.booking.customerName} />
              <Row label="Teléfono" value={
                <a href={`tel:${detailSlot.booking.customerPhone}`} className="text-blue-700 hover:underline">
                  {detailSlot.booking.customerPhone}
                </a>
              } />
              <Row label="Trabajo" value={detailSlot.booking.subject || "—"} />
              <Row label="Servicio" value={detailSlot.booking.service || "—"} />
              {detailSlot.booking.professionalName && (
                <Row label="Especialista" value={detailSlot.booking.professionalName} />
              )}
              {detailSlot.booking.customFieldsJson && (() => {
                try {
                  const fields = JSON.parse(detailSlot.booking.customFieldsJson!) as Record<string, string>;
                  const entries = Object.entries(fields);
                  if (entries.length === 0) return null;
                  return (
                    <div>
                      <p className="text-charcoal/40 text-xs uppercase tracking-wider mb-2">Campos adicionales</p>
                      <div className="flex flex-wrap gap-2">
                        {entries.map(([k, v]) => (
                          <span key={k} className="text-xs bg-porcelain/5 border border-mauve/10 rounded-full px-3 py-1 text-charcoal/70">
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}
              {detailSlot.booking.message && (
                <Row label="Mensaje" value={detailSlot.booking.message} />
              )}
              <Row label="Estado" value={
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  slotExpired
                    ? "bg-porcelain/10 text-charcoal/40"
                    : detailSlot.booking.status === "Confirmed"
                    ? "bg-green-500/20 text-green-700"
                    : detailSlot.booking.status === "Cancelled"
                    ? "bg-red-500/20 text-red-600"
                    : "bg-orange-500/20 text-orange-700"
                }`}>
                  {slotExpired ? "Expirado"
                    : detailSlot.booking.status === "Confirmed" ? "Confirmado"
                    : detailSlot.booking.status === "Cancelled" ? "Cancelado"
                    : "Pendiente"}
                </span>
              } />
              <Row label="Pago" value={
                detailSlot.booking.paymentStatus === "Approved"
                  ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-700">
                      Pagado{detailSlot.booking.paymentAmount ? ` — $${detailSlot.booking.paymentAmount.toLocaleString("es-AR")}` : ""}
                    </span>
                  : detailSlot.booking.paymentStatus === "Pending"
                  ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-700">Pago pendiente</span>
                  : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-porcelain/10 text-charcoal/40">Sin pago</span>
              } />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-mauve/5 flex flex-col gap-2">
              {slotExpired ? (
                <Button
                  onClick={() => { setDetailSlot(null); deleteSlot(detailSlot.id); }}
                  variant="danger"
                  className="w-full"
                >
                  Eliminar turno expirado
                </Button>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => confirmarYEnviarWhatsApp(detailSlot)}
                      className="flex-1 text-center bg-green-600 hover:bg-green-500 text-charcoal py-2.5 rounded-lg text-sm font-semibold transition"
                    >
                      Confirmar + WhatsApp
                    </button>
                    {detailSlot.booking.status !== "Confirmed" && (
                      <Button
                        onClick={() => confirmarTurno(detailSlot.booking!.id, detailSlot.booking!, detailSlot.startDateTime)}
                        variant="primary"
                        className="flex-1"
                      >
                        Confirmar
                      </Button>
                    )}
                  </div>
                  <Button
                    onClick={() => { setDetailSlot(null); habilitarTurno(detailSlot.id, detailSlot.booking!.status === "Confirmed"); }}
                    variant="danger"
                    className="w-full"
                  >
                    {detailSlot.booking.status === "Confirmed" ? "Cancelar turno" : "Liberar turno"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-charcoal/40 text-sm shrink-0">{label}</span>
      <span className="text-charcoal text-sm text-right">{value}</span>
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

// Genera los números de página a mostrar, colapsando el resto en "..."
// para que la lista no crezca sin límite con muchos turnos.
function getPaginationRange(current: number, total: number, siblingCount = 1): (number | "...")[] {
  const totalVisible = siblingCount * 2 + 5; // primera + última + actual + vecinos + 2 elipsis
  if (total <= totalVisible) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);
  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < total - 1;

  if (!showLeftDots && showRightDots) {
    const leftItemCount = 3 + siblingCount * 2;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, "...", total];
  }

  if (showLeftDots && !showRightDots) {
    const rightItemCount = 3 + siblingCount * 2;
    const rightRange = Array.from({ length: rightItemCount }, (_, i) => total - rightItemCount + i + 1);
    return [1, "...", ...rightRange];
  }

  const middleRange = Array.from(
    { length: rightSibling - leftSibling + 1 },
    (_, i) => leftSibling + i
  );
  return [1, "...", ...middleRange, "...", total];
}

// Retorna true si el turno ya pasó su horario de inicio
function isExpired(isoString: string): boolean {
  const cleanString = isoString.replace("Z", "");
  const [datePart, timePart] = cleanString.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  const slotDate = new Date(year, month - 1, day, hours, minutes);
  return slotDate < new Date();
}
