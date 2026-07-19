"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import { Button } from "@/src/components/shared/Button";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

// react-big-calendar y el modal de reserva solo hacen falta cuando se
// cambia a vista semana/día o se abre "Reservar": diferirlos evita que su
// peso (lib de calendario + CSS) entre en el compile/bundle inicial de la
// página, que por defecto arranca en vista mes.
const AgendaCalendar = dynamic(() => import("@/src/components/calendar/AgendaCalendar"), {
  ssr: false,
  loading: () => <div className="h-96 flex items-center justify-center text-charcoal/30 text-sm">Cargando agenda...</div>,
});
const ReserveSlotModal = dynamic(() => import("@/src/components/calendar/ReserveSlotModal"), { ssr: false });

interface Booking {
  id: number;
  customerName: string;
  customerPhone: string;
  subject: string;
  service: string;
  professionalId?: number | null;
  professionalName?: string | null;
  message?: string;
  status: string;
}

interface Professional {
  id: number;
  firstName: string;
  lastName: string;
  calendarColor?: string;
  schedule?: string | null;
}

interface TimeSlot {
  id: number;
  startDateTime: string;
  endDateTime: string;
  isAvailable: boolean;
  booking?: Booking;
  professionalId?: number | null;
  professionalName?: string | null;
}

interface BookingItemRecord {
  id: number;
  itemType: "Service" | "Product" | "Insumo";
  serviceId?: number | null;
  productId?: number | null;
  insumoId?: number | null;
  isSale?: boolean;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface BookingFullRecord {
  id: number;
  items?: BookingItemRecord[];
  photoUrlsBefore?: string | null;
  photoUrlsAfter?: string | null;
}

interface ServiceOption { id: number; title: string; slug: string; price: string; }
interface ProductOption { id: number; name: string; price: number; }
interface InsumoOption { id: number; name: string; stock: number; lowStockThreshold: number; }
interface ServiceRecipeItem { insumoId: number; insumoName: string; quantity: number; }

function parseServicePrice(raw: string): number {
  const match = raw.replace(/\./g, "").match(/\d+([,.]\d+)?/);
  if (!match) return 0;
  return parseFloat(match[0].replace(",", ".")) || 0;
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function parseLocalDate(iso: string) {
  const clean = iso.replace("Z", "");
  const [date, time] = clean.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return { y, m, d, h, min };
}

export default function CalendarioPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(new Date());
  const [current, setCurrent] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [detailBooking, setDetailBooking] = useState<{ slot: TimeSlot } | null>(null);
  useModalHotkeys(!!detailBooking, { onClose: () => setDetailBooking(null) });
  const [editingBooking, setEditingBooking] = useState<TimeSlot | null>(null);
  const [editForm, setEditForm] = useState({ customerName: "", customerPhone: "", subject: "", service: "", message: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const editFormRef = useRef<HTMLFormElement>(null);
  const closeEdit = () => { if (editingBooking) setDetailBooking({ slot: editingBooking }); setEditingBooking(null); };
  useModalHotkeys(!!editingBooking, { onClose: closeEdit, onSubmit: () => editFormRef.current?.requestSubmit() });
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [insumos, setInsumos] = useState<InsumoOption[]>([]);
  const [bookingsFull, setBookingsFull] = useState<BookingFullRecord[]>([]);
  const [detailItems, setDetailItems] = useState<BookingItemRecord[]>([]);
  const [newItem, setNewItem] = useState({ itemType: "Service" as "Service" | "Product" | "Insumo", refId: 0, quantity: 1, unitPrice: 0, isSale: false });
  const [savingDetail, setSavingDetail] = useState(false);
  const [reserveSlot, setReserveSlot] = useState<TimeSlot | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [professionalFilter, setProfessionalFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [agendaDate, setAgendaDate] = useState(new Date());
  const { toasts, showToast, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const loadSlots = () =>
    fetch("/api/timeslots").then((r) => r.json()).then((data) => setSlots(Array.isArray(data) ? data : []));

  useEffect(() => {
    if (!isAdminAuthenticated()) { router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login"); return; }
    Promise.all([
      loadSlots(),
      fetch("/api/professionals").then((r) => r.json()).then((d) => setProfessionals(Array.isArray(d) ? d : [])),
      fetch("/api/services/all").then((r) => r.json()).then((d) => setServices(Array.isArray(d) ? d : [])),
      fetch("/api/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])),
      fetch("/api/insumos").then((r) => r.json()).then((d) => setInsumos(Array.isArray(d) ? d : [])),
      fetch("/api/bookings").then((r) => r.json()).then((d) => setBookingsFull(Array.isArray(d) ? d : [])),
    ]).finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!detailBooking?.slot.booking) return;
    const full = bookingsFull.find((b) => b.id === detailBooking.slot.booking!.id);
    setDetailItems(full?.items ?? []);
    setNewItem({ itemType: "Service", refId: 0, quantity: 1, unitPrice: 0, isSale: false });
  }, [detailBooking, bookingsFull]);

  const prevMonth = () => setCurrent((c) => {
    if (c.month === 1) return { year: c.year - 1, month: 12 };
    return { ...c, month: c.month - 1 };
  });

  const nextMonth = () => setCurrent((c) => {
    if (c.month === 12) return { year: c.year + 1, month: 1 };
    return { ...c, month: c.month + 1 };
  });

  // Slots del mes actual
  const monthSlots = slots.filter((s) => {
    const { y, m } = parseLocalDate(s.startDateTime);
    if (y !== current.year || m !== current.month) return false;
    if (professionalFilter !== "all" && String(s.professionalId ?? "") !== professionalFilter) return false;
    return true;
  });

  const professionalColor = (id?: number | null) =>
    professionals.find((p) => p.id === id)?.calendarColor || "#7c3aed";

  // Agrupar por día
  const slotsByDay = monthSlots.reduce<Record<number, TimeSlot[]>>((acc, s) => {
    const { d } = parseLocalDate(s.startDateTime);
    if (!acc[d]) acc[d] = [];
    acc[d].push(s);
    return acc;
  }, {});

  // Slots del día seleccionado
  const daySlots = selectedDay ? (slotsByDay[selectedDay] ?? []) : [];

  // Construcción del grid del mes
  const firstDayOfMonth = new Date(current.year, current.month - 1, 1);
  // 0=dom → convertir a lun=0
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(current.year, current.month, 0).getDate();
  const cells = Array.from({ length: startOffset + daysInMonth }, (_, i) =>
    i < startOffset ? null : i - startOffset + 1
  );
  // Completar última fila
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d: number) =>
    d === today.getDate() && current.month === today.getMonth() + 1 && current.year === today.getFullYear();

  const handleReschedule = async (bookingId: number, newTimeSlotId: number, successMessage?: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/admin-reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTimeSlotId }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadSlots();
        showToast("success", "Turno reprogramado", successMessage ?? "Se movió a su nuevo horario.");
      } else {
        showToast("error", "No se pudo reprogramar", data.message);
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor.");
    }
  };

  // Se usa cuando se arrastra un turno a un hueco sin turno libre pero dentro
  // del horario laboral del profesional: crea el turno en ese momento exacto
  // y recién ahí reprograma la reserva sobre él.
  const handleCreateAndReschedule = async (
    bookingId: number,
    professionalId: number,
    startDateTime: string,
    endDateTime: string
  ) => {
    try {
      const slotRes = await fetch("/api/timeslots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDateTime, endDateTime, professionalId }),
      });
      const slotData = await slotRes.json();
      if (!slotRes.ok) {
        showToast("error", "No se pudo crear el turno", slotData.message);
        return;
      }
      await handleReschedule(bookingId, slotData.slot.id, "Se creó un turno nuevo en ese horario y se movió la reserva.");
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor.");
    }
  };

  const addItem = async () => {
    if (!newItem.refId) return;
    const catalog = newItem.itemType === "Service" ? services : newItem.itemType === "Product" ? products : insumos;
    const found = catalog.find((c) => c.id === newItem.refId);
    if (!found) return;
    const name = newItem.itemType === "Service" ? (found as ServiceOption).title : (found as ProductOption | InsumoOption).name;
    const addedServiceId = newItem.itemType === "Service" ? newItem.refId : null;
    const addedQuantity = newItem.quantity;
    setDetailItems((prev) => [...prev, {
      id: 0,
      itemType: newItem.itemType,
      serviceId: newItem.itemType === "Service" ? newItem.refId : null,
      productId: newItem.itemType === "Product" ? newItem.refId : null,
      insumoId: newItem.itemType === "Insumo" ? newItem.refId : null,
      isSale: newItem.itemType === "Insumo" ? newItem.isSale : undefined,
      name,
      quantity: newItem.quantity,
      // El insumo es costo interno salvo que se marque como venta: ahí sí se cobra al cliente.
      unitPrice: newItem.itemType === "Insumo" && !newItem.isSale ? 0 : newItem.unitPrice,
    }]);
    setNewItem({ itemType: "Service", refId: 0, quantity: 1, unitPrice: 0, isSale: false });

    // Al agregar un servicio, auto-agregar los insumos de su receta (editables/quitables antes de guardar).
    if (addedServiceId) {
      try {
        const res = await fetch(`/api/services/${addedServiceId}/recipe`);
        if (res.ok) {
          const recipeItems: ServiceRecipeItem[] = await res.json();
          if (recipeItems.length > 0) {
            setDetailItems((prev) => [
              ...prev,
              ...recipeItems.map((r) => ({
                id: 0,
                itemType: "Insumo" as const,
                insumoId: r.insumoId,
                isSale: false,
                name: r.insumoName,
                quantity: r.quantity * addedQuantity,
                unitPrice: 0,
              })),
            ]);
          }
        }
      } catch (error) {
        logError("Error cargando receta del servicio:", error);
      }
    }
  };

  const removeItem = (idx: number) => setDetailItems((prev) => prev.filter((_, i) => i !== idx));

  const saveDetail = async () => {
    const bookingId = detailBooking?.slot.booking?.id;
    if (!bookingId) return;
    const full = bookingsFull.find((b) => b.id === bookingId);
    setSavingDetail(true);
    try {
      const payload = {
        photoUrlsBefore: full?.photoUrlsBefore ?? null,
        photoUrlsAfter: full?.photoUrlsAfter ?? null,
        items: detailItems.map((i) => ({
          itemType: i.itemType,
          serviceId: i.serviceId ?? undefined,
          productId: i.productId ?? undefined,
          insumoId: i.insumoId ?? undefined,
          isSale: i.isSale ?? false,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      };
      const res = await fetch(`/api/bookings/${bookingId}/detail`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setBookingsFull((prev) => prev.map((b) => (b.id === bookingId ? { ...b, items: detailItems } : b)));
        showToast("success", "Detalle actualizado", "Se guardaron los cambios del turno.");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("error", "No se pudo guardar", data.message);
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor.");
    } finally {
      setSavingDetail(false);
    }
  };

  const openEdit = (slot: TimeSlot) => {
    const b = slot.booking!;
    setEditForm({ customerName: b.customerName, customerPhone: b.customerPhone, subject: b.subject, service: b.service ?? "", message: b.message ?? "" });
    setEditingBooking(slot);
    setDetailBooking(null);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking?.booking) return;
    const bookingId = editingBooking.booking.id;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const updatedSlot: TimeSlot = { ...editingBooking, booking: { ...editingBooking.booking, ...editForm } };
        setSlots((prev) => prev.map((s) => (s.id === updatedSlot.id ? updatedSlot : s)));
        showToast("success", "Turno actualizado", data.message);
        setEditingBooking(null);
        setDetailBooking({ slot: updatedSlot });
      } else {
        showToast("error", "No se pudo actualizar", data.message);
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor.");
    } finally {
      setSavingEdit(false);
    }
  };

  const liberarTurno = async (slotId: number, isConfirmed = false) => {
    const msg = isConfirmed
      ? "¿Cancelar este turno? La reserva quedará cancelada y la fecha se liberará."
      : "¿Liberar este turno? La fecha quedará disponible nuevamente.";
    if (!(await confirm({ message: msg, confirmLabel: isConfirmed ? "Cancelar turno" : "Liberar turno" }))) return;
    const res = await fetch(`/api/timeslots/${slotId}/release`, { method: "PUT" });
    if (res.ok) {
      setDetailBooking(null);
      const data = await fetch("/api/timeslots").then((r) => r.json());
      setSlots(Array.isArray(data) ? data : []);
    }
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-charcoal">Cargando calendario...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 font-sans">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {ConfirmDialog}
      <div className={`mx-auto ${viewMode === "month" ? "max-w-5xl" : "max-w-7xl"}`}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Calendario</h1>
            <p className="text-charcoal/50 text-sm mt-1">
              {viewMode === "month" ? "Vista de turnos por mes" : "Agenda por profesional — arrastrá un turno reservado para reprogramarlo"}
            </p>
          </div>
          <div className="flex gap-1 bg-porcelain/10 rounded-lg p-1" data-testid="calendario-view-tabs">
            {(["month", "week", "day"] as const).map((v) => (
              <button
                key={v}
                data-testid={`calendario-view-${v}`}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  viewMode === v ? "bg-blush text-white shadow-glow" : "text-charcoal/60 hover:text-charcoal"
                }`}
              >
                {v === "month" ? "Mes" : v === "week" ? "Semana" : "Día"}
              </button>
            ))}
          </div>
        </div>

        {viewMode !== "month" && (
          <div className="mb-6">
            <div className="mb-3">
              {professionals.length > 0 && (
                <select
                  data-testid="calendario-agenda-professional-filter"
                  className="bg-porcelain/10 border border-mauve/10 rounded-lg px-3 py-1.5 text-xs text-charcoal focus:outline-none focus:border-blush"
                  value={professionalFilter}
                  onChange={(e) => setProfessionalFilter(e.target.value)}
                >
                  <option value="all">Todos los profesionales</option>
                  {professionals.map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
              )}
            </div>
            <AgendaCalendar
              slots={slots}
              professionals={professionals}
              view={viewMode}
              date={agendaDate}
              onNavigate={setAgendaDate}
              onViewChange={(v) => setViewMode(v)}
              onSelectAvailable={(slotId) => {
                const slot = slots.find((s) => s.id === slotId);
                if (slot) setReserveSlot(slot);
              }}
              onSelectBooking={(slotId) => {
                const slot = slots.find((s) => s.id === slotId);
                if (slot?.booking) setDetailBooking({ slot });
              }}
              onReschedule={handleReschedule}
              onCreateAndReschedule={handleCreateAndReschedule}
              onError={(message) => showToast("warning", "No se pudo mover el turno", message)}
              professionalFilter={professionalFilter === "all" ? "all" : Number(professionalFilter)}
            />
          </div>
        )}

        {viewMode === "month" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* CALENDARIO */}
          <div className="bg-ivory border border-mauve/5 rounded-2xl p-5">
            {/* Navegación mes */}
            <div className="flex items-center justify-between mb-5">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-porcelain/5 text-charcoal/60 hover:text-charcoal transition">
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-charcoal font-semibold text-lg">
                {MONTH_NAMES[current.month - 1]} {current.year}
              </h2>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-porcelain/5 text-charcoal/60 hover:text-charcoal transition">
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Cabecera días */}
            <div className="grid grid-cols-7 mb-2">
              {DAY_NAMES.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-charcoal/30 py-1">{d}</div>
              ))}
            </div>

            {/* Grid días */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} />;
                const dayData = slotsByDay[day] ?? [];
                const hasBooked = dayData.some((s) => !s.isAvailable);
                const availableProfessionalIds = Array.from(
                  new Set(dayData.filter((s) => s.isAvailable).map((s) => s.professionalId ?? 0))
                ).slice(0, 3);
                const isSelected = selectedDay === day;
                const todayCell = isToday(day);

                return (
                  <button
                    key={day}
                    data-testid="calendario-day-cell"
                    data-day={day}
                    data-today={todayCell}
                    data-has-available={dayData.some((s) => s.isAvailable)}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`relative aspect-square flex flex-col items-center justify-center rounded-xl transition-all text-sm font-medium
                      ${isSelected ? "bg-white text-black" : todayCell ? "bg-porcelain/10 text-charcoal ring-1 ring-white/30" : "hover:bg-porcelain/5 text-charcoal/70"}
                    `}
                  >
                    {day}
                    {dayData.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {hasBooked && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-orange-500" : "bg-orange-400"}`} />}
                        {availableProfessionalIds.map((pid) => (
                          <span
                            key={pid}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: pid ? professionalColor(pid) : "#22c55e" }}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Filtro por profesional + leyenda */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
              {professionals.length > 0 && (
                <select
                  className="bg-porcelain/10 border border-mauve/10 rounded-lg px-3 py-1.5 text-xs text-charcoal focus:outline-none focus:border-blush"
                  value={professionalFilter}
                  onChange={(e) => setProfessionalFilter(e.target.value)}
                >
                  <option value="all">Todos los profesionales</option>
                  {professionals.map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
              )}
              <div className="flex gap-4 text-xs text-charcoal/40">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />Disponible (color = profesional)</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400" />Reservado</span>
              </div>
            </div>
          </div>

          {/* PANEL LATERAL */}
          <div className="bg-ivory border border-mauve/5 rounded-2xl p-5">
            {!selectedDay ? (
              <div className="h-full flex flex-col items-center justify-center text-charcoal/20 text-sm text-center gap-2">
                <span className="text-3xl">📅</span>
                Seleccioná un día para ver los turnos
              </div>
            ) : (
              <>
                <h3 className="text-charcoal font-semibold mb-4">
                  {selectedDay} de {MONTH_NAMES[current.month - 1]}
                  <span className="text-charcoal/30 text-sm font-normal ml-2">({daySlots.length} turno{daySlots.length !== 1 ? "s" : ""})</span>
                </h3>
                {daySlots.length === 0 ? (
                  <p className="text-charcoal/30 text-sm">Sin turnos este día</p>
                ) : (
                  <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                    {daySlots
                      .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))
                      .map((slot) => {
                        const { h, min } = parseLocalDate(slot.startDateTime);
                        const time = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
                        return (
                          <div
                            key={slot.id}
                            data-testid="calendario-slot-row"
                            data-available={slot.isAvailable}
                            data-customer-name={slot.booking?.customerName ?? ""}
                            onClick={() => !slot.isAvailable && slot.booking && setDetailBooking({ slot })}
                            className={`p-3 rounded-xl border transition ${!slot.isAvailable ? "cursor-pointer hover:brightness-95" : ""} ${
                              slot.isAvailable
                                ? "border-green-200 bg-green-50"
                                : slot.booking?.status === "Confirmed"
                                ? "border-blue-200 bg-blue-50"
                                : "border-orange-200 bg-orange-50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-charcoal font-medium text-sm">{time}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                slot.isAvailable
                                  ? "bg-green-500/20 text-green-700"
                                  : slot.booking?.status === "Confirmed"
                                  ? "bg-blue-500/20 text-blue-700"
                                  : "bg-orange-500/20 text-orange-700"
                              }`}>
                                {slot.isAvailable ? "LIBRE" : slot.booking?.status === "Confirmed" ? "CONFIRMADO" : "RESERVADO"}
                              </span>
                            </div>
                            {!slot.isAvailable && slot.booking && (
                              <p className="text-charcoal/50 text-xs mt-1">
                                {slot.booking.customerName} · {slot.booking.subject}
                                {slot.booking.professionalName && ` · 👤 ${slot.booking.professionalName}`}
                              </p>
                            )}
                            {slot.isAvailable && slot.professionalName && (
                              <p className="text-charcoal/40 text-xs mt-1">👤 {slot.professionalName}</p>
                            )}
                            <div className="mt-2 flex gap-2">
                              {slot.isAvailable ? (
                                <button
                                  data-testid="calendario-slot-reserve-button"
                                  onClick={() => setReserveSlot(slot)}
                                  className="text-xs text-blushdark hover:text-blush font-medium transition"
                                >
                                  + Reservar
                                </button>
                              ) : (
                                <button
                                  data-testid="calendario-slot-detail-button"
                                  onClick={() => slot.booking && setDetailBooking({ slot })}
                                  className="text-xs text-blushdark hover:text-blush font-medium transition"
                                >
                                  Ver detalle
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        )}
      </div>

      {/* MODAL NUEVA RESERVA (ADMIN) */}
      {reserveSlot && (
        <ReserveSlotModal
          slot={reserveSlot}
          onClose={() => setReserveSlot(null)}
          onReserved={loadSlots}
        />
      )}

      {/* MODAL DETALLE RESERVA */}
      {detailBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setDetailBooking(null)}>
          <div data-testid="calendario-detail-modal" className="bg-ivory border border-mauve/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-mauve/5">
              <div>
                <h2 className="text-charcoal font-semibold text-lg">Detalle de reserva</h2>
                <p className="text-charcoal/40 text-xs mt-0.5">
                  {(() => { const { d, m, h, min } = parseLocalDate(detailBooking.slot.startDateTime); return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")} · ${d} de ${MONTH_NAMES[m - 1]}`; })()}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => openEdit(detailBooking.slot)}
                  data-testid="calendario-edit-button"
                  className="text-blushdark hover:text-blush transition text-xs font-semibold"
                >
                  Editar
                </button>
                <button onClick={() => setDetailBooking(null)} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <Row label="Cliente" value={detailBooking.slot.booking!.customerName} />
              <Row label="Teléfono" value={
                <a href={`tel:${detailBooking.slot.booking!.customerPhone}`} className="text-blue-700 hover:underline">
                  {detailBooking.slot.booking!.customerPhone}
                </a>
              } />
              <Row label="Detalle" value={detailBooking.slot.booking!.subject || "—"} />
              <Row label="Servicio" value={detailBooking.slot.booking!.service || "—"} />
              {detailBooking.slot.booking!.professionalName && (
                <Row label="Especialista" value={detailBooking.slot.booking!.professionalName!} />
              )}
              {detailBooking.slot.booking!.message && (
                <Row label="Mensaje" value={detailBooking.slot.booking!.message!} />
              )}

              {/* Productos y servicios utilizados */}
              <div className="pt-2 border-t border-mauve/5">
                <p className="text-charcoal/30 text-[11px] uppercase tracking-wider mb-2">Productos y servicios utilizados</p>
                {detailItems.length > 0 && (
                  <div className="space-y-1.5 mb-2" data-testid="calendario-item-list">
                    {detailItems.map((item, i) => (
                      <div key={i} data-testid="calendario-item-row" className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-charcoal/70">
                          {item.name} <span className="text-charcoal/30 text-xs">×{item.quantity}</span>
                          {item.itemType === "Insumo" && (
                            <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${item.isSale ? "bg-emerald-500/20 text-emerald-700" : "bg-porcelain/30 text-charcoal/40"}`}>
                              {item.isSale ? "VENTA" : "USO INTERNO"}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-charcoal/50 text-xs">${(item.unitPrice * item.quantity).toLocaleString("es-AR")}</span>
                          <button type="button" onClick={() => removeItem(i)} data-testid="calendario-item-remove" className="text-red-600/60 hover:text-red-600 text-xs">✕</button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-semibold pt-1.5 border-t border-mauve/5">
                      <span className="text-charcoal/50">Total</span>
                      <span className="text-charcoal">${detailItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toLocaleString("es-AR")}</span>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 items-center">
                  <select
                    value={newItem.itemType}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, itemType: e.target.value as "Service" | "Product" | "Insumo", refId: 0, unitPrice: 0, isSale: false }))}
                    data-testid="calendario-item-type"
                    className="bg-cream border border-mauve/10 rounded-lg px-1.5 py-1.5 text-xs text-charcoal focus:outline-none"
                  >
                    <option value="Service">Servicio</option>
                    <option value="Product">Producto</option>
                    <option value="Insumo">Insumo</option>
                  </select>
                  <select
                    value={newItem.refId}
                    onChange={(e) => {
                      const id = parseInt(e.target.value) || 0;
                      if (newItem.itemType === "Product") {
                        const p = products.find((x) => x.id === id);
                        setNewItem((prev) => ({ ...prev, refId: id, unitPrice: p?.price ?? 0 }));
                      } else if (newItem.itemType === "Service") {
                        const s = services.find((x) => x.id === id);
                        setNewItem((prev) => ({ ...prev, refId: id, unitPrice: s ? parseServicePrice(s.price) : 0 }));
                      } else {
                        setNewItem((prev) => ({ ...prev, refId: id }));
                      }
                    }}
                    data-testid="calendario-item-select"
                    className="flex-1 min-w-0 bg-cream border border-mauve/10 rounded-lg px-1.5 py-1.5 text-xs text-charcoal focus:outline-none"
                  >
                    <option value={0}>Elegir...</option>
                    {newItem.itemType === "Service" && services.map((s) => (
                      <option key={s.id} value={s.id}>{s.title} — {s.price}</option>
                    ))}
                    {newItem.itemType === "Product" && products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    {newItem.itemType === "Insumo" && insumos.map((i) => (
                      <option key={i.id} value={i.id}>{i.name} ({i.stock <= 0 ? "SIN STOCK" : `Stock: ${i.stock}`})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={newItem.quantity}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    data-testid="calendario-item-quantity"
                    className="w-11 bg-cream border border-mauve/10 rounded-lg px-1 py-1.5 text-xs text-charcoal text-center focus:outline-none"
                  />
                  {newItem.itemType === "Insumo" && (
                    <label className="flex items-center gap-1 text-charcoal/60 text-[11px] cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={newItem.isSale}
                        onChange={(e) => setNewItem((prev) => ({ ...prev, isSale: e.target.checked, unitPrice: e.target.checked ? prev.unitPrice : 0 }))}
                        data-testid="calendario-item-sale-checkbox"
                        className="accent-emerald-500"
                      />
                      Venta
                    </label>
                  )}
                  {newItem.itemType === "Insumo" && !newItem.isSale ? (
                    <span className="w-16 text-center text-[11px] text-charcoal/30 italic shrink-0">Interno</span>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={newItem.unitPrice}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                      placeholder="Precio"
                      data-testid="calendario-item-price"
                      className="w-16 bg-cream border border-mauve/10 rounded-lg px-1.5 py-1.5 text-xs text-charcoal focus:outline-none"
                    />
                  )}
                  <Button type="button" onClick={addItem} data-testid="calendario-item-add" variant="secondary" size="sm" className="shrink-0">
                    +
                  </Button>
                </div>
                <Button
                  type="button"
                  onClick={saveDetail}
                  disabled={savingDetail}
                  data-testid="calendario-save-detail"
                  variant="secondary"
                  className="w-full mt-3"
                >
                  {savingDetail ? "Guardando..." : "Guardar detalle"}
                </Button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-mauve/5 flex gap-3">
              <a
                href={`https://wa.me/+54${detailBooking.slot.booking!.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                  (() => {
                    const { y, m, d } = parseLocalDate(detailBooking.slot.startDateTime);
                    return `Hola ${detailBooking.slot.booking!.customerName} 👋\n\nTe confirmamos tu reserva en *AutoDetail Studio*:\n\n📅 *Fecha:* ${d} de ${MONTH_NAMES[m - 1]} ${y}\n📝 *Detalle:* ${detailBooking.slot.booking!.subject || "—"}\n🔧 *Servicio:* ${detailBooking.slot.booking!.service || "—"}\n\n¡Nos vemos!`;
                  })()
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center bg-green-600 hover:bg-green-500 text-charcoal py-2.5 rounded-lg text-sm font-semibold transition"
              >
                WhatsApp
              </a>
              <Button
                data-testid="calendario-liberar-button"
                onClick={() => liberarTurno(detailBooking.slot.id, detailBooking.slot.booking?.status === "Confirmed")}
                variant="danger"
                className="flex-1"
              >
                {detailBooking.slot.booking?.status === "Confirmed" ? "Cancelar turno" : "Liberar turno"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR RESERVA */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={closeEdit}>
          <div data-testid="calendario-edit-modal" className="bg-ivory border border-mauve/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-mauve/5">
              <h2 className="text-charcoal font-semibold text-lg">Editar reserva</h2>
              <button onClick={closeEdit} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>
            <form ref={editFormRef} onSubmit={submitEdit} className="px-6 py-5 space-y-4">
              <div>
                <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Cliente</label>
                <input
                  className="form-input mt-1.5"
                  data-testid="calendario-edit-name"
                  value={editForm.customerName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, customerName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Teléfono</label>
                <input
                  className="form-input mt-1.5"
                  data-testid="calendario-edit-phone"
                  value={editForm.customerPhone}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, customerPhone: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Detalle del turno</label>
                <input
                  className="form-input mt-1.5"
                  data-testid="calendario-edit-subject"
                  value={editForm.subject}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, subject: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Servicio</label>
                <select
                  className="form-input mt-1.5"
                  data-testid="calendario-edit-service"
                  value={editForm.service}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, service: e.target.value }))}
                >
                  <option value="">Sin servicio</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.slug}>{s.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Mensaje (opcional)</label>
                <textarea
                  className="form-input mt-1.5 resize-none"
                  rows={2}
                  value={editForm.message}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, message: e.target.value }))}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="submit" data-testid="calendario-edit-submit" disabled={savingEdit} variant="primary" className="flex-1">
                  {savingEdit ? "Guardando..." : "Guardar cambios"}
                </Button>
                <Button type="button" onClick={closeEdit} variant="secondary">
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-charcoal/40 text-sm shrink-0">{label}</span>
      <span className="text-charcoal text-sm text-right">{value}</span>
    </div>
  );
}
