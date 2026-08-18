"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isProfessionalAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

interface Booking {
  id: number;
  customerName: string;
  customerPhone: string;
  subject?: string;
  service?: string;
  message?: string;
  status: string;
}

interface TimeSlot {
  id: number;
  startDateTime: string;
  endDateTime: string;
  isAvailable: boolean;
  label: string;
  booking?: Booking;
}

function isExpired(startDateTime: string) {
  return new Date(startDateTime) < new Date();
}

// Genera los números de página a mostrar, colapsando el resto en "..."
// para que la lista no crezca sin límite con muchos turnos.
function getPaginationRange(current: number, total: number, siblingCount = 1): (number | "...")[] {
  const totalVisible = siblingCount * 2 + 5;
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

  const middleRange = Array.from({ length: rightSibling - leftSibling + 1 }, (_, i) => leftSibling + i);
  return [1, "...", ...middleRange, "...", total];
}

function ProfessionalAgendaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Viene del link del email "nuevo turno agendado" — resalta y hace scroll a ese turno.
  const highlightedBookingId = searchParams.get("bookingId") ? Number(searchParams.get("bookingId")) : null;
  const highlightedRef = useRef<HTMLDivElement | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ date: "", hour: "09", minute: "00" });
  const { toasts, showToast, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [detailSlot, setDetailSlot] = useState<TimeSlot | null>(null);
  useModalHotkeys(!!detailSlot, { onClose: () => setDetailSlot(null) });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState(false);
  type StatusFilter = "all" | "available" | "pending" | "confirmed";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  useEffect(() => {
    if (!isProfessionalAuthenticated()) {
      router.push(getRole() === "Admin" ? "/admin/turnos" : "/profesional/login");
      return;
    }
    loadSlots();
  }, [router]);

  useEffect(() => {
    if (!loading && highlightedBookingId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading, highlightedBookingId]);

  const loadSlots = async () => {
    try {
      const res = await fetch("/api/timeslots/mine");
      if (res.ok) {
        setSlots(await res.json());
      } else if (res.status === 401) {
        router.push("/profesional/login");
      }
    } catch (error) {
      logError("Error cargando agenda:", error);
    } finally {
      setLoading(false);
    }
  };

  const createSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const startDateTime = `${formData.date}T${formData.hour}:${formData.minute}:00`;
      let endHour = parseInt(formData.hour) + 1;
      let endDate = formData.date;
      if (endHour >= 24) {
        endHour -= 24;
        const [y, m, d] = formData.date.split("-").map(Number);
        const nextDay = new Date(y, m - 1, d + 1);
        endDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;
      }
      const endDateTime = `${endDate}T${String(endHour).padStart(2, "0")}:${formData.minute}:00`;

      const res = await fetch("/api/timeslots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDateTime, endDateTime }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", "Turno creado en tu agenda");
        setFormData((prev) => ({ ...prev, date: "" }));
        loadSlots();
      } else {
        showToast("error", data.message || "No se pudo crear el turno");
      }
    } catch (error) {
      showToast("error", "Error de conexión");
      logError(error);
    } finally {
      setCreating(false);
    }
  };

  const confirmBooking = async (bookingId: number) => {
    const res = await fetch(`/api/bookings/${bookingId}/confirm`, { method: "PATCH" });
    const data = await res.json();
    if (res.ok) {
      setDetailSlot(null);
      showToast("success", "Turno confirmado");
      loadSlots();
    } else {
      showToast("error", data.message || "No se pudo confirmar el turno");
    }
  };

  const releaseSlot = async (id: number) => {
    if (!(await confirm({ message: "¿Liberar este turno? Si tenía una reserva, se cancela.", confirmLabel: "Liberar turno" }))) return;
    const res = await fetch(`/api/timeslots/${id}/release`, { method: "PUT" });
    if (res.ok) {
      setDetailSlot(null);
      showToast("success", "Turno liberado");
      loadSlots();
    } else {
      showToast("error", "No se pudo liberar el turno");
    }
  };

  const deleteSlot = async (id: number) => {
    if (!(await confirm({ message: "¿Eliminar este turno de tu agenda?", confirmLabel: "Eliminar turno" }))) return;
    const res = await fetch(`/api/timeslots/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      showToast("success", "Turno eliminado");
      loadSlots();
    } else {
      showToast("error", data.message || "No se pudo eliminar el turno");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando tu agenda...</p>
      </div>
    );
  }

  const upcoming = slots
    .filter((s) => !isExpired(s.startDateTime))
    .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));

  const handleFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  const filteredSlots = upcoming.filter((slot) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "available") return slot.isAvailable;
    if (statusFilter === "pending") return !slot.isAvailable && slot.booking?.status !== "Confirmed";
    if (statusFilter === "confirmed") return !slot.isAvailable && slot.booking?.status === "Confirmed";
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredSlots.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentSlots = filteredSlots.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const goToNextPage = () => { if (currentPage < totalPages) setCurrentPage((p) => p + 1); };
  const goToPrevPage = () => { if (currentPage > 1) setCurrentPage((p) => p - 1); };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const selectAll = () => {
    if (selectedIds.length === filteredSlots.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSlots.map((s) => s.id));
    }
  };

  const bulkDelete = async () => {
    const availableSelected = upcoming.filter((s) => selectedIds.includes(s.id) && s.isAvailable);
    if (availableSelected.length === 0) {
      showToast("warning", "Acción no permitida", "Solo se pueden eliminar turnos libres");
      return;
    }
    if (!(await confirm({ message: `¿Eliminar ${availableSelected.length} turno(s)?`, confirmLabel: "Eliminar" }))) return;

    setBulkAction(true);
    try {
      for (const slot of availableSelected) {
        await fetch(`/api/timeslots/${slot.id}`, { method: "DELETE" });
      }
      setSelectedIds([]);
      showToast("success", "Turnos eliminados", `${availableSelected.length} turno(s) eliminado(s)`);
      loadSlots();
    } catch (error) {
      showToast("error", "Error", "No se pudieron eliminar algunos turnos");
      logError(error);
    } finally {
      setBulkAction(false);
    }
  };

  const bulkRelease = async () => {
    const reservedSelected = upcoming.filter((s) => selectedIds.includes(s.id) && !s.isAvailable);
    if (reservedSelected.length === 0) {
      showToast("warning", "Acción no permitida", "Solo se pueden liberar turnos reservados");
      return;
    }
    if (!(await confirm({ message: `¿Cancelar ${reservedSelected.length} turno(s)? Las reservas quedarán canceladas y las fechas se liberarán.`, confirmLabel: "Cancelar turnos" }))) return;

    setBulkAction(true);
    try {
      for (const slot of reservedSelected) {
        await fetch(`/api/timeslots/${slot.id}/release`, { method: "PUT" });
      }
      setSelectedIds([]);
      showToast("success", "Turnos liberados", `${reservedSelected.length} turno(s) liberado(s)`);
      loadSlots();
    } catch (error) {
      showToast("error", "Error", "No se pudieron liberar algunos turnos");
      logError(error);
    } finally {
      setBulkAction(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {ConfirmDialog}

      <div className="mx-auto max-w-5xl">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Mi Agenda</h1>
          <p className="text-charcoal/50 text-sm mt-1">Administrá tus propios turnos disponibles y reservas</p>
        </div>

        <div className="grid gap-6 md:grid-cols-[320px_1fr]">
          {/* Crear turno */}
          <div className="bg-ivory border border-mauve/10 rounded-xl p-6 h-fit md:sticky md:top-6">
            <h2 className="text-lg font-semibold text-charcoal mb-4">Agregar turno disponible</h2>
            <form onSubmit={createSlot} className="space-y-4">
              <div>
                <label className="text-charcoal/70 text-sm font-medium">Fecha</label>
                <input
                  type="date"
                  data-testid="agenda-form-date"
                  className="w-full mt-2 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition-colors"
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-charcoal/70 text-sm font-medium">Hora inicio</label>
                <div className="flex gap-2 mt-2 items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="HH"
                    data-testid="agenda-form-hour"
                    className="w-20 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal text-center focus:border-green-500 focus:outline-none transition-colors"
                    value={formData.hour}
                    onChange={(e) => setFormData((prev) => ({ ...prev, hour: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
                    onBlur={(e) => setFormData((prev) => ({ ...prev, hour: String(Math.min(23, Math.max(0, parseInt(e.target.value) || 0))).padStart(2, "0") }))}
                    required
                  />
                  <span className="text-charcoal/50 text-xl font-bold">:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="MM"
                    data-testid="agenda-form-minute"
                    className="w-20 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal text-center focus:border-green-500 focus:outline-none transition-colors"
                    value={formData.minute}
                    onChange={(e) => setFormData((prev) => ({ ...prev, minute: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
                    onBlur={(e) => setFormData((prev) => ({ ...prev, minute: String(Math.min(59, Math.max(0, parseInt(e.target.value) || 0))).padStart(2, "0") }))}
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={creating}
                data-testid="agenda-form-submit"
                className="w-full bg-blush hover:bg-blushdark text-cream py-3 rounded-lg font-semibold uppercase tracking-wide shadow-glow transition disabled:opacity-50"
              >
                {creating ? "Creando..." : "Crear turno"}
              </button>
            </form>
          </div>

          {/* Lista de turnos, estilo "Turnos Creados" del admin */}
          <div className="bg-ivory border border-mauve/5 rounded-xl p-6">
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
                  Próximos Turnos{" "}
                  <span className="text-charcoal/60 text-lg font-normal">
                    ({statusFilter === "all" ? upcoming.length : `${filteredSlots.length}/${upcoming.length}`})
                  </span>
                </h2>
              </div>
              {selectedIds.length > 0 && (
                <span className="text-sm text-charcoal/50">{selectedIds.length} seleccionado(s)</span>
              )}
            </div>

            {/* Filtro por estado */}
            <div className="flex gap-1.5 mb-4 px-1 flex-wrap">
              {(
                [
                  { key: "all", label: "Todos" },
                  { key: "available", label: "Habilitado" },
                  { key: "pending", label: "Reservado" },
                  { key: "confirmed", label: "Confirmado" },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleFilterChange(key)}
                  data-testid={`agenda-filter-${key}`}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                    statusFilter === key
                      ? "bg-blush text-cream"
                      : "bg-porcelain/10 text-charcoal/50 hover:bg-porcelain/20 hover:text-charcoal"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Acciones en lote */}
            {selectedIds.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2 mb-4 px-1">
                <button
                  onClick={bulkRelease}
                  disabled={bulkAction}
                  className="flex-1 bg-green-600/20 border border-green-600/50 text-green-400 hover:bg-green-600/30 py-2 px-4 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {bulkAction ? "Procesando..." : "Liberar seleccionados"}
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

            <div className="space-y-3">
              {filteredSlots.length === 0 ? (
                <div className="py-10 flex items-center justify-center text-charcoal/30 border border-dashed border-mauve/10 rounded-lg">
                  <p>No hay turnos en esta categoría</p>
                </div>
              ) : (
                currentSlots.map((slot) => {
                  const isHighlighted = highlightedBookingId != null && slot.booking?.id === highlightedBookingId;
                  return (
                    <div
                      key={slot.id}
                      ref={isHighlighted ? highlightedRef : undefined}
                      data-testid="agenda-slot-item"
                      data-slot-label={slot.label}
                      className={`relative p-4 rounded-lg border transition-all duration-200 ${
                        isHighlighted
                          ? "bg-champagne/10 border-champagne ring-2 ring-champagne/50"
                          : slot.isAvailable
                          ? "bg-green-500/10 border-green-500/30 hover:border-green-500/50"
                          : slot.booking?.status === "Confirmed"
                          ? "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50"
                          : "bg-orange-500/10 border-orange-500/30 hover:border-orange-500/50"
                      } ${selectedIds.includes(slot.id) ? "ring-2 ring-white/30" : ""}`}
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
                            <p className="font-medium text-[15px] tracking-wide text-charcoal">
                              {isHighlighted && (
                                <span className="mr-1.5 text-[9px] font-bold bg-champagne/20 text-champagne px-1.5 py-0.5 rounded align-middle">NUEVO</span>
                              )}
                              {slot.label}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  slot.isAvailable
                                    ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                                    : slot.booking?.status === "Confirmed"
                                    ? "bg-blue-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                                    : "bg-orange-500"
                                }`}
                              ></span>
                              <span
                                className={`text-xs font-bold tracking-wider ${
                                  slot.isAvailable ? "text-green-500" : slot.booking?.status === "Confirmed" ? "text-blue-400" : "text-orange-500"
                                }`}
                              >
                                {slot.isAvailable ? "HABILITADO" : slot.booking?.status === "Confirmed" ? "CONFIRMADO" : "RESERVADO"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {slot.isAvailable ? (
                            <button
                              onClick={() => deleteSlot(slot.id)}
                              data-testid="agenda-slot-delete"
                              className="text-red-600 hover:text-red-400 text-xs font-medium uppercase tracking-wide transition"
                            >
                              Eliminar
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => setDetailSlot(slot)}
                                className="text-blush hover:text-blushdark text-xs font-medium uppercase tracking-wide transition"
                              >
                                Ver detalle
                              </button>
                              <button
                                onClick={() => releaseSlot(slot.id)}
                                data-testid="agenda-slot-release"
                                className="text-green-400 hover:text-green-300 text-xs font-medium uppercase tracking-wide transition"
                              >
                                Liberar
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {!slot.isAvailable && slot.booking && (
                        <div className="mt-3 pt-3 border-t border-mauve/5 text-xs text-charcoal/60">
                          {slot.booking.status === "Confirmed" ? "Confirmado por:" : "Reservado por:"}{" "}
                          <span className="text-charcoal">{slot.booking.customerName}</span>
                          {slot.booking.service && <span className="text-charcoal/40"> · {slot.booking.service}</span>}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Paginación */}
            {filteredSlots.length > 0 && totalPages > 1 && (
              <div className="pt-6 mt-2 flex flex-wrap justify-center items-center gap-3 border-t border-mauve/5">
                <button
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                  data-testid="agenda-page-prev"
                  className="p-2 text-charcoal/70 hover:text-charcoal disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="flex flex-wrap justify-center items-center gap-2">
                  {getPaginationRange(currentPage, totalPages).map((p, idx) =>
                    p === "..." ? (
                      <span key={`dots-${idx}`} className="w-8 h-8 flex items-center justify-center text-charcoal/30 text-sm select-none">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        data-testid="agenda-page-number"
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                          currentPage === p ? "bg-blush text-cream scale-110 shadow-lg" : "bg-porcelain/10 text-charcoal hover:bg-porcelain/20"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                </div>

                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  data-testid="agenda-page-next"
                  className="p-2 text-charcoal/70 hover:text-charcoal disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DETALLE RESERVA */}
      {detailSlot?.booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setDetailSlot(null)}>
          <div data-testid="agenda-detail-modal" className="bg-ivory border border-mauve/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-mauve/5">
              <div>
                <h2 className="text-charcoal font-semibold text-lg">Detalle de reserva</h2>
                <p className="text-charcoal/40 text-xs mt-0.5">{detailSlot.label}</p>
              </div>
              <button onClick={() => setDetailSlot(null)} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <Row label="Cliente" value={detailSlot.booking.customerName} />
              <Row label="Teléfono" value={
                <a href={`tel:${detailSlot.booking.customerPhone}`} className="text-blue-400 hover:underline">
                  {detailSlot.booking.customerPhone}
                </a>
              } />
              {detailSlot.booking.subject && <Row label="Detalle" value={detailSlot.booking.subject} />}
              <Row label="Servicio" value={detailSlot.booking.service || "—"} />
              {detailSlot.booking.message && <Row label="Mensaje" value={detailSlot.booking.message} />}
              <Row label="Estado" value={detailSlot.booking.status === "Confirmed" ? "Confirmado" : "Pendiente"} />
            </div>
            {detailSlot.booking.status !== "Confirmed" && (
              <div className="px-6 pb-1">
                <button
                  data-testid="agenda-detail-confirm"
                  onClick={() => confirmBooking(detailSlot.booking!.id)}
                  className="w-full bg-blush hover:bg-blushdark text-cream py-2.5 rounded-lg text-sm font-semibold uppercase tracking-wide transition"
                >
                  Confirmar turno
                </button>
              </div>
            )}
            <div className="px-6 py-4 border-t border-mauve/5 flex gap-3">
              <a
                href={`https://wa.me/+54${detailSlot.booking.customerPhone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center bg-green-600 hover:bg-green-500 text-charcoal py-2.5 rounded-lg text-sm font-semibold transition"
              >
                WhatsApp
              </a>
              <button
                data-testid="agenda-detail-release"
                onClick={() => releaseSlot(detailSlot.id)}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg text-sm font-semibold transition"
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
      <span className="text-charcoal/40 text-sm shrink-0">{label}</span>
      <span className="text-charcoal text-sm text-right">{value}</span>
    </div>
  );
}

export default function ProfessionalAgendaPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando tu agenda...</p>
      </div>
    }>
      <ProfessionalAgendaContent />
    </Suspense>
  );
}
