"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { Button } from "@/src/components/shared/Button";

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
  paymentStatus?: string | null;
  paymentAmount?: number | null;
}

interface Slot {
  id: number;
  startDateTime: string;
  endDateTime: string;
  isAvailable: boolean;
  booking?: Booking;
}

interface Reminder {
  id: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  serviceLabel: string;
  scheduledFor: string;
  status: string;
}

function parseLocalDate(iso: string) {
  const clean = iso.replace("Z", "");
  const [date, time] = clean.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min);
}

function formatDate(iso: string) {
  const dt = parseLocalDate(iso);
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return {
    day: days[dt.getDay()],
    date: `${dt.getDate()} ${months[dt.getMonth()]}`,
    time: `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`,
    full: dt,
  };
}

function isHoy(iso: string) {
  const now = new Date();
  const dt = parseLocalDate(iso);
  return dt.getDate() === now.getDate() && dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
}

function buildReminderMessage(r: Reminder) {
  const { date, time } = formatDate(r.scheduledFor);
  return `Hola ${r.customerName} 👋, te recordamos que tenés tu turno de ${r.serviceLabel} el ${date} a las ${time}. ¡Te esperamos!`;
}

function buildWhatsAppUrl(r: Reminder) {
  const phone = r.customerPhone.replace(/\D/g, "");
  return `https://wa.me/+54${phone}?text=${encodeURIComponent(buildReminderMessage(r))}`;
}

function buildMailtoUrl(r: Reminder) {
  const subject = encodeURIComponent("Recordatorio de tu turno");
  const body = encodeURIComponent(buildReminderMessage(r));
  return `mailto:${r.customerEmail}?subject=${subject}&body=${body}`;
}

function buildBookingWhatsAppUrl(slot: Slot) {
  const booking = slot.booking;
  if (!booking) return "";
  const { day, date, time } = formatDate(slot.startDateTime);
  const phone = booking.customerPhone.replace(/\D/g, "");
  const message = `Hola ${booking.customerName} 👋\n\nTe confirmamos tu reserva:\n\n📅 *Fecha:* ${day} ${date} · ${time}\n📝 *Detalle:* ${booking.subject || "—"}\n🔧 *Servicio:* ${booking.service || "—"}\n\n¡Nos vemos!`;
  return `https://wa.me/+54${phone}?text=${encodeURIComponent(message)}`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-charcoal/40 text-sm shrink-0">{label}</span>
      <span className="text-charcoal text-sm text-right">{value}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | "reservados" | "confirmados" | "libres">("todos");
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(true);
  const [detailSlot, setDetailSlot] = useState<Slot | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) { router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login"); return; }
    fetch("/api/timeslots")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const now = new Date();
        const upcoming = data
          .filter((s: Slot) => parseLocalDate(s.startDateTime) >= now)
          .sort((a: Slot, b: Slot) => parseLocalDate(a.startDateTime).getTime() - parseLocalDate(b.startDateTime).getTime())
          .slice(0, 30);
        setSlots(upcoming);
      })
      .finally(() => setLoading(false));

    fetch("/api/reminders?status=Pending")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setReminders(data.slice(0, 15));
      })
      .finally(() => setLoadingReminders(false));
  }, [router]);

  const markReminderSent = async (id: number) => {
    if (!confirm("¿Marcar este aviso como enviado? No se volverá a mandar automáticamente.")) return;
    const res = await fetch(`/api/reminders/${id}/mark-sent`, { method: "POST" });
    if (res.ok) setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const filtered = slots.filter((s) => {
    if (filter === "reservados") return !s.isAvailable && s.booking?.status !== "Confirmed";
    if (filter === "confirmados") return s.booking?.status === "Confirmed";
    if (filter === "libres") return s.isAvailable;
    return true;
  });

  const totalReservados = slots.filter((s) => !s.isAvailable && s.booking?.status !== "Confirmed").length;
  const totalConfirmados = slots.filter((s) => s.booking?.status === "Confirmed").length;
  const totalLibres = slots.filter((s) => s.isAvailable).length;

  const handleLiberar = async (id: number, isConfirmed = false) => {
    const msg = isConfirmed
      ? "¿Cancelar este turno? La reserva quedará cancelada y la fecha se liberará."
      : "¿Liberar este turno? La fecha quedará disponible nuevamente.";
    if (!confirm(msg)) return;
    const res = await fetch(`/api/timeslots/${id}/release`, { method: "PUT" });
    if (res.ok) {
      setSlots((prev) =>
        prev.map((s) => s.id === id ? { ...s, isAvailable: true, booking: undefined } : s)
      );
      setDetailSlot((prev) => (prev?.id === id ? null : prev));
    }
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-charcoal">Cargando...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Panel principal</h1>
          <p className="text-charcoal/50 text-sm mt-1">Próximos turnos ordenados por fecha</p>
        </div>

        {/* Próximos avisos programados */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-charcoal font-semibold text-base">Próximos avisos programados</h2>
            <a href="/admin/clientes" className="text-champagne/70 text-xs hover:text-champagne transition">Ver clientes</a>
          </div>
          {loadingReminders ? (
            <p className="text-charcoal/30 text-sm py-4">Cargando...</p>
          ) : reminders.length === 0 ? (
            <div className="bg-ivory border border-mauve/5 rounded-xl py-6 text-center text-charcoal/30 text-sm">
              Sin avisos pendientes
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.map((r) => {
                const { day, date, time } = formatDate(r.scheduledFor);
                return (
                  <div key={r.id} className="bg-ivory border border-mauve/5 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-charcoal text-sm font-medium truncate">{r.customerName}</p>
                      <p className="text-charcoal/40 text-xs mt-0.5">
                        {r.serviceLabel} · {day} {date} · {time}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={buildWhatsAppUrl(r)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-500/10 text-green-700 hover:bg-green-500/20 transition"
                      >
                        WhatsApp
                      </a>
                      {r.customerEmail && (
                        <a
                          href={buildMailtoUrl(r)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 transition"
                        >
                          Email
                        </a>
                      )}
                      <button
                        onClick={() => markReminderSent(r.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-charcoal/40 hover:text-charcoal hover:bg-porcelain/10 transition"
                        title="Marcar como enviado manualmente"
                      >
                        Marcar enviado
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-ivory border border-mauve/5 rounded-xl p-3 md:p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-charcoal">{slots.length}</p>
            <p className="text-charcoal/40 text-[11px] md:text-xs mt-1">Próximos</p>
          </div>
          <div className="bg-ivory border border-orange-200 rounded-xl p-3 md:p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-orange-700">{totalReservados}</p>
            <p className="text-charcoal/40 text-[11px] md:text-xs mt-1">Reservados</p>
          </div>
          <div className="bg-ivory border border-blue-200 rounded-xl p-3 md:p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-blue-700">{totalConfirmados}</p>
            <p className="text-charcoal/40 text-[11px] md:text-xs mt-1">Confirmados</p>
          </div>
          <div className="bg-ivory border border-green-200 rounded-xl p-3 md:p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-green-700">{totalLibres}</p>
            <p className="text-charcoal/40 text-[11px] md:text-xs mt-1">Disponibles</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(["todos", "reservados", "confirmados", "libres"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 md:px-4 py-1.5 rounded-full text-xs md:text-sm font-medium transition capitalize ${
                filter === f
                  ? "bg-white text-black"
                  : "bg-porcelain/5 text-charcoal/50 hover:text-charcoal hover:bg-porcelain/10"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-ivory border border-mauve/5 rounded-2xl py-16 text-center text-charcoal/30 text-sm">
            Sin turnos para mostrar
          </div>
        ) : (
          <>
            {/* ── Mobile: cards ── */}
            <div className="md:hidden space-y-2">
              {filtered.map((slot) => {
                const { day, date, time } = formatDate(slot.startDateTime);
                const hoy = isHoy(slot.startDateTime);
                return (
                  <div
                    key={slot.id}
                    onClick={() => slot.booking && setDetailSlot(slot)}
                    className={`bg-ivory border border-mauve/5 rounded-xl p-4 ${hoy ? "border-mauve/10" : ""} ${slot.booking ? "cursor-pointer hover:border-mauve/20 transition" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Fecha + hora */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          {hoy && (
                            <span className="text-[9px] font-bold bg-champagne/20 text-champagne px-1.5 py-0.5 rounded">HOY</span>
                          )}
                          <span className="text-charcoal/40 text-xs">{day}</span>
                          <span className="text-charcoal font-medium text-sm">{date}</span>
                          <span className="text-charcoal/30 text-xs">·</span>
                          <span className="text-charcoal font-mono text-sm">{time}</span>
                        </div>
                        {/* Estado */}
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          slot.isAvailable
                            ? "bg-green-500/10 text-green-700"
                            : slot.booking?.status === "Confirmed"
                            ? "bg-blue-500/10 text-blue-700"
                            : "bg-orange-500/10 text-orange-700"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            slot.isAvailable ? "bg-green-400"
                            : slot.booking?.status === "Confirmed" ? "bg-blue-400"
                            : "bg-orange-400"
                          }`} />
                          {slot.isAvailable ? "Libre" : slot.booking?.status === "Confirmed" ? "Confirmado" : "Reservado"}
                        </span>
                      </div>
                      {/* Acción */}
                      {!slot.isAvailable && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleLiberar(slot.id, slot.booking?.status === "Confirmed"); }}
                          className="text-xs text-red-600/60 hover:text-red-600 transition font-medium shrink-0"
                        >
                          {slot.booking?.status === "Confirmed" ? "Cancelar" : "Liberar"}
                        </button>
                      )}
                    </div>
                    {/* Booking info */}
                    {slot.booking && (
                      <div className="mt-2.5 pt-2.5 border-t border-mauve/5">
                        <p className="text-charcoal text-sm font-medium">{slot.booking.customerName}</p>
                        <p className="text-charcoal/40 text-xs mt-0.5">
                          {slot.booking.subject}
                          {slot.booking.service && ` · ${slot.booking.service}`}
                        </p>
                        {slot.booking.professionalName && (
                          <p className="text-charcoal/30 text-xs mt-0.5">👤 {slot.booking.professionalName}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Desktop: tabla ── */}
            <div className="hidden md:block bg-ivory border border-mauve/5 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mauve/5 text-charcoal/30 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Fecha</th>
                    <th className="text-left px-5 py-3 font-medium">Hora</th>
                    <th className="text-left px-5 py-3 font-medium">Estado</th>
                    <th className="text-left px-5 py-3 font-medium">Cliente</th>
                    <th className="text-left px-5 py-3 font-medium">Detalle</th>
                    <th className="text-left px-5 py-3 font-medium">Servicio</th>
                    <th className="text-left px-5 py-3 font-medium">Especialista</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((slot) => {
                    const { day, date, time } = formatDate(slot.startDateTime);
                    const hoy = isHoy(slot.startDateTime);
                    return (
                      <tr
                        key={slot.id}
                        onClick={() => slot.booking && setDetailSlot(slot)}
                        className={`border-b border-mauve/5 last:border-0 transition ${
                          hoy ? "bg-porcelain/[0.03]" : "hover:bg-porcelain/[0.02]"
                        } ${slot.booking ? "cursor-pointer" : ""}`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {hoy && (
                              <span className="text-[10px] font-bold bg-champagne/20 text-champagne px-1.5 py-0.5 rounded">HOY</span>
                            )}
                            <span className="text-charcoal/40 text-xs">{day}</span>
                            <span className="text-charcoal font-medium">{date}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-charcoal font-mono">{time}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                            slot.isAvailable
                              ? "bg-green-500/10 text-green-700"
                              : slot.booking?.status === "Confirmed"
                              ? "bg-blue-500/10 text-blue-700"
                              : "bg-orange-500/10 text-orange-700"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              slot.isAvailable ? "bg-green-400"
                              : slot.booking?.status === "Confirmed" ? "bg-blue-400"
                              : "bg-orange-400"
                            }`} />
                            {slot.isAvailable ? "Libre" : slot.booking?.status === "Confirmed" ? "Confirmado" : "Reservado"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {slot.booking ? (
                            <div>
                              <p className="text-charcoal font-medium">{slot.booking.customerName}</p>
                              <p className="text-charcoal/40 text-xs mt-0.5">{slot.booking.customerPhone}</p>
                            </div>
                          ) : (
                            <span className="text-charcoal/20">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-charcoal/60">
                          {slot.booking?.subject ?? <span className="text-charcoal/20">—</span>}
                        </td>
                        <td className="px-5 py-4 text-charcoal/60">
                          {slot.booking?.service ?? <span className="text-charcoal/20">—</span>}
                        </td>
                        <td className="px-5 py-4 text-charcoal/60">
                          {slot.booking?.professionalName ?? <span className="text-charcoal/20">—</span>}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {!slot.isAvailable && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleLiberar(slot.id, slot.booking?.status === "Confirmed"); }}
                              className="text-xs text-red-600/60 hover:text-red-600 transition font-medium"
                            >
                              {slot.booking?.status === "Confirmed" ? "Cancelar" : "Liberar"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal detalle de turno */}
      {detailSlot?.booking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setDetailSlot(null)}
        >
          <div
            className="bg-ivory border border-mauve/10 rounded-2xl w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-mauve/5">
              <div>
                <h2 className="text-charcoal font-semibold text-lg">Detalle de turno</h2>
                <p className="text-charcoal/40 text-xs mt-0.5">
                  {(() => { const { day, date, time } = formatDate(detailSlot.startDateTime); return `${day} ${date} · ${time}`; })()}
                </p>
              </div>
              <button onClick={() => setDetailSlot(null)} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <Row label="Estado" value={
                detailSlot.booking.status === "Confirmed" ? "Confirmado" : "Reservado"
              } />
              <Row label="Cliente" value={detailSlot.booking.customerName} />
              <Row label="Teléfono" value={
                <a href={`tel:${detailSlot.booking.customerPhone}`} className="text-blue-700 hover:underline">
                  {detailSlot.booking.customerPhone}
                </a>
              } />
              <Row label="Detalle" value={detailSlot.booking.subject || "—"} />
              <Row label="Servicio" value={detailSlot.booking.service || "—"} />
              {detailSlot.booking.professionalName && (
                <Row label="Especialista" value={detailSlot.booking.professionalName} />
              )}
              {detailSlot.booking.paymentStatus && (
                <Row label="Pago" value={
                  `${detailSlot.booking.paymentStatus}${detailSlot.booking.paymentAmount ? ` · $${detailSlot.booking.paymentAmount}` : ""}`
                } />
              )}
              {detailSlot.booking.message && (
                <Row label="Mensaje" value={detailSlot.booking.message} />
              )}
            </div>
            <div className="px-6 py-4 border-t border-mauve/5 flex gap-3">
              <a
                href={buildBookingWhatsAppUrl(detailSlot)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center bg-green-600 hover:bg-green-500 text-charcoal py-2.5 rounded-lg text-sm font-semibold transition"
              >
                WhatsApp
              </a>
              <Button
                onClick={() => handleLiberar(detailSlot.id, detailSlot.booking?.status === "Confirmed")}
                variant="danger"
                className="flex-1"
              >
                {detailSlot.booking.status === "Confirmed" ? "Cancelar turno" : "Liberar turno"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
