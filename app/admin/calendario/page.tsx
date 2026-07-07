"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "../../../src/lib/auth";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Service {
  id: number;
  title: string;
  slug: string;
}

interface Booking {
  id: number;
  customerName: string;
  customerPhone: string;
  vehicle: string;
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
  const [reserveSlot, setReserveSlot] = useState<TimeSlot | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [reserveForm, setReserveForm] = useState({ customerName: "", customerPhone: "", vehicle: "", service: "", professionalId: "", message: "" });
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState("");
  const [professionalFilter, setProfessionalFilter] = useState<string>("all");

  const loadSlots = () =>
    fetch("/api/timeslots").then((r) => r.json()).then((data) => setSlots(Array.isArray(data) ? data : []));

  useEffect(() => {
    if (!isAdminAuthenticated()) { router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login"); return; }
    Promise.all([
      loadSlots(),
      fetch("/api/services").then((r) => r.json()).then((d) => setServices(Array.isArray(d) ? d : [])),
      fetch("/api/professionals").then((r) => r.json()).then((d) => setProfessionals(Array.isArray(d) ? d : [])),
    ]).finally(() => setLoading(false));
  }, [router]);

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

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reserveSlot) return;
    setReserving(true);
    setReserveError("");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeSlotId: reserveSlot.id,
          ...reserveForm,
          professionalId: reserveForm.professionalId ? Number(reserveForm.professionalId) : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReserveSlot(null);
        setReserveForm({ customerName: "", customerPhone: "", vehicle: "", service: "", professionalId: "", message: "" });
        await loadSlots();
      } else {
        setReserveError(data.message || "No se pudo crear la reserva");
      }
    } catch {
      setReserveError("Error de conexión");
    } finally {
      setReserving(false);
    }
  };

  const liberarTurno = async (slotId: number, isConfirmed = false) => {
    const msg = isConfirmed
      ? "¿Cancelar este turno? La reserva quedará cancelada y la fecha se liberará."
      : "¿Liberar este turno? La fecha quedará disponible nuevamente.";
    if (!confirm(msg)) return;
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
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Calendario</h1>
          <p className="text-charcoal/50 text-sm mt-1">Vista de turnos por mes</p>
        </div>

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
                  className="bg-porcelain/10 border border-mauve/10 rounded-lg px-3 py-1.5 text-xs text-charcoal focus:outline-none focus:border-green-500"
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
                  <div className="space-y-2">
                    {daySlots
                      .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))
                      .map((slot) => {
                        const { h, min } = parseLocalDate(slot.startDateTime);
                        const time = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
                        return (
                          <div
                            key={slot.id}
                            className={`p-3 rounded-xl border transition ${
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
                                {slot.booking.customerName} · {slot.booking.vehicle}
                                {slot.booking.professionalName && ` · 👤 ${slot.booking.professionalName}`}
                              </p>
                            )}
                            {slot.isAvailable && slot.professionalName && (
                              <p className="text-charcoal/40 text-xs mt-1">👤 {slot.professionalName}</p>
                            )}
                            <div className="mt-2 flex gap-2">
                              {slot.isAvailable ? (
                                <button
                                  onClick={() => { setReserveSlot(slot); setReserveError(""); }}
                                  className="text-xs text-green-700 hover:text-green-700 font-medium transition"
                                >
                                  + Reservar
                                </button>
                              ) : (
                                <button
                                  onClick={() => slot.booking && setDetailBooking({ slot })}
                                  className="text-xs text-blue-700 hover:text-blue-700 font-medium transition"
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
      </div>

      {/* MODAL NUEVA RESERVA (ADMIN) */}
      {reserveSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setReserveSlot(null)}>
          <div className="bg-ivory border border-mauve/10 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-mauve/5">
              <div>
                <h2 className="text-charcoal font-semibold text-lg">Nueva reserva</h2>
                <p className="text-charcoal/40 text-xs mt-0.5">
                  {(() => { const { h, min } = parseLocalDate(reserveSlot.startDateTime); return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}`; })()}
                  {" · "}{selectedDay} de {MONTH_NAMES[current.month - 1]}
                </p>
              </div>
              <button onClick={() => setReserveSlot(null)} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>

            <form onSubmit={handleReserve} className="px-6 py-5 space-y-4">
              <div>
                <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Nombre del cliente</label>
                <input
                  className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition text-sm"
                  value={reserveForm.customerName}
                  onChange={(e) => setReserveForm((p) => ({ ...p, customerName: e.target.value }))}
                  placeholder="Juan García"
                  required
                />
              </div>
              <div>
                <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Teléfono / WhatsApp</label>
                <input
                  className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition text-sm"
                  value={reserveForm.customerPhone}
                  onChange={(e) => setReserveForm((p) => ({ ...p, customerPhone: e.target.value }))}
                  placeholder="1123456789"
                  required
                />
              </div>
              <div>
                <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Vehículo</label>
                <input
                  className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition text-sm"
                  value={reserveForm.vehicle}
                  onChange={(e) => setReserveForm((p) => ({ ...p, vehicle: e.target.value }))}
                  placeholder="Toyota Corolla 2022"
                  required
                />
              </div>
              <div>
                <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Servicio</label>
                <select
                  className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition text-sm"
                  value={reserveForm.service}
                  onChange={(e) => setReserveForm((p) => ({ ...p, service: e.target.value }))}
                  required
                >
                  <option value="">Seleccioná un servicio</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.slug}>{s.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Especialista</label>
                {reserveSlot.professionalName ? (
                  <p className="w-full mt-1.5 bg-porcelain/10 border border-mauve/10 rounded-lg p-3 text-charcoal text-sm">
                    👤 {reserveSlot.professionalName} <span className="text-charcoal/40">(el turno ya es de este profesional)</span>
                  </p>
                ) : (
                  <select
                    className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition text-sm"
                    value={reserveForm.professionalId}
                    onChange={(e) => setReserveForm((p) => ({ ...p, professionalId: e.target.value }))}
                  >
                    <option value="">Sin preferencia</option>
                    {professionals.map((pro) => (
                      <option key={pro.id} value={pro.id}>{pro.firstName} {pro.lastName}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Notas (opcional)</label>
                <textarea
                  className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition text-sm resize-none"
                  rows={2}
                  value={reserveForm.message}
                  onChange={(e) => setReserveForm((p) => ({ ...p, message: e.target.value }))}
                  placeholder="Observaciones..."
                />
              </div>

              {reserveError && <p className="text-red-600 text-sm">{reserveError}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={reserving}
                  className="flex-1 bg-blush hover:bg-blushdark text-white py-3 rounded-lg font-semibold shadow-glow transition disabled:opacity-50 text-sm"
                >
                  {reserving ? "Reservando..." : "Confirmar reserva"}
                </button>
                <button
                  type="button"
                  onClick={() => setReserveSlot(null)}
                  className="px-5 bg-porcelain/5 hover:bg-porcelain/10 text-charcoal py-3 rounded-lg font-semibold transition text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLE RESERVA */}
      {detailBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setDetailBooking(null)}>
          <div className="bg-ivory border border-mauve/10 rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-mauve/5">
              <div>
                <h2 className="text-charcoal font-semibold text-lg">Detalle de reserva</h2>
                <p className="text-charcoal/40 text-xs mt-0.5">
                  {(() => { const { h, min } = parseLocalDate(detailBooking.slot.startDateTime); return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}`; })()}
                  {" · "}{selectedDay} de {MONTH_NAMES[current.month - 1]}
                </p>
              </div>
              <button onClick={() => setDetailBooking(null)} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <Row label="Cliente" value={detailBooking.slot.booking!.customerName} />
              <Row label="Teléfono" value={
                <a href={`tel:${detailBooking.slot.booking!.customerPhone}`} className="text-blue-700 hover:underline">
                  {detailBooking.slot.booking!.customerPhone}
                </a>
              } />
              <Row label="Vehículo" value={detailBooking.slot.booking!.vehicle} />
              <Row label="Servicio" value={detailBooking.slot.booking!.service || "—"} />
              {detailBooking.slot.booking!.professionalName && (
                <Row label="Especialista" value={detailBooking.slot.booking!.professionalName!} />
              )}
              {detailBooking.slot.booking!.message && (
                <Row label="Mensaje" value={detailBooking.slot.booking!.message!} />
              )}
            </div>
            <div className="px-6 py-4 border-t border-mauve/5 flex gap-3">
              <a
                href={`https://wa.me/+54${detailBooking.slot.booking!.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                  `Hola ${detailBooking.slot.booking!.customerName} 👋\n\nTe confirmamos tu reserva en *AutoDetail Studio*:\n\n📅 *Fecha:* ${selectedDay} de ${MONTH_NAMES[current.month - 1]} ${current.year}\n🚗 *Vehículo:* ${detailBooking.slot.booking!.vehicle}\n🔧 *Servicio:* ${detailBooking.slot.booking!.service || "—"}\n\n¡Nos vemos!`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center bg-green-600 hover:bg-green-500 text-charcoal py-2.5 rounded-lg text-sm font-semibold transition"
              >
                WhatsApp
              </a>
              <button
                onClick={() => liberarTurno(detailBooking.slot.id, detailBooking.slot.booking?.status === "Confirmed")}
                className="flex-1 bg-porcelain/5 hover:bg-red-500/10 text-charcoal/60 hover:text-red-600 border border-mauve/5 hover:border-red-500/30 py-2.5 rounded-lg text-sm font-semibold transition"
              >
                {detailBooking.slot.booking?.status === "Confirmed" ? "Cancelar turno" : "Liberar turno"}
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
