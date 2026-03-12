"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "../../src/lib/auth";

interface Booking {
  id: number;
  customerName: string;
  customerPhone: string;
  vehicle: string;
  service: string;
  message?: string;
  status: string;
}

interface Slot {
  id: number;
  startDateTime: string;
  endDateTime: string;
  isAvailable: boolean;
  booking?: Booking;
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

export default function AdminDashboard() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | "reservados" | "confirmados" | "libres">("todos");

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/admin/login"); return; }
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
  }, [router]);

  const filtered = slots.filter((s) => {
    if (filter === "reservados") return !s.isAvailable && s.booking?.status !== "Confirmed";
    if (filter === "confirmados") return s.booking?.status === "Confirmed";
    if (filter === "libres") return s.isAvailable;
    return true;
  });

  const totalReservados = slots.filter((s) => !s.isAvailable && s.booking?.status !== "Confirmed").length;
  const totalConfirmados = slots.filter((s) => s.booking?.status === "Confirmed").length;
  const totalLibres = slots.filter((s) => s.isAvailable).length;

  const handleLiberar = async (id: number) => {
    if (!confirm("¿Liberar este turno? La reserva será cancelada.")) return;
    const res = await fetch(`/api/timeslots/${id}/release`, { method: "PUT" });
    if (res.ok) {
      setSlots((prev) =>
        prev.map((s) => s.id === id ? { ...s, isAvailable: true, booking: undefined } : s)
      );
    }
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-white">Cargando...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Panel principal</h1>
          <p className="text-white/50 text-sm mt-1">Próximos turnos ordenados por fecha</p>
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-[#161b22] border border-white/5 rounded-xl p-3 md:p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-white">{slots.length}</p>
            <p className="text-white/40 text-[11px] md:text-xs mt-1">Próximos</p>
          </div>
          <div className="bg-[#161b22] border border-orange-900/30 rounded-xl p-3 md:p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-orange-400">{totalReservados}</p>
            <p className="text-white/40 text-[11px] md:text-xs mt-1">Reservados</p>
          </div>
          <div className="bg-[#161b22] border border-blue-900/30 rounded-xl p-3 md:p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-blue-400">{totalConfirmados}</p>
            <p className="text-white/40 text-[11px] md:text-xs mt-1">Confirmados</p>
          </div>
          <div className="bg-[#161b22] border border-green-900/30 rounded-xl p-3 md:p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-green-400">{totalLibres}</p>
            <p className="text-white/40 text-[11px] md:text-xs mt-1">Disponibles</p>
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
                  : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-[#161b22] border border-white/5 rounded-2xl py-16 text-center text-white/30 text-sm">
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
                    className={`bg-[#161b22] border border-white/5 rounded-xl p-4 ${hoy ? "border-white/10" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Fecha + hora */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          {hoy && (
                            <span className="text-[9px] font-bold bg-lux/20 text-lux px-1.5 py-0.5 rounded">HOY</span>
                          )}
                          <span className="text-white/40 text-xs">{day}</span>
                          <span className="text-white font-medium text-sm">{date}</span>
                          <span className="text-white/30 text-xs">·</span>
                          <span className="text-white font-mono text-sm">{time}</span>
                        </div>
                        {/* Estado */}
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          slot.isAvailable
                            ? "bg-green-500/10 text-green-400"
                            : slot.booking?.status === "Confirmed"
                            ? "bg-blue-500/10 text-blue-400"
                            : "bg-orange-500/10 text-orange-400"
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
                          onClick={() => handleLiberar(slot.id)}
                          className="text-xs text-red-400/60 hover:text-red-400 transition font-medium shrink-0"
                        >
                          Liberar
                        </button>
                      )}
                    </div>
                    {/* Booking info */}
                    {slot.booking && (
                      <div className="mt-2.5 pt-2.5 border-t border-white/5">
                        <p className="text-white text-sm font-medium">{slot.booking.customerName}</p>
                        <p className="text-white/40 text-xs mt-0.5">
                          {slot.booking.vehicle}
                          {slot.booking.service && ` · ${slot.booking.service}`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Desktop: tabla ── */}
            <div className="hidden md:block bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-white/30 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Fecha</th>
                    <th className="text-left px-5 py-3 font-medium">Hora</th>
                    <th className="text-left px-5 py-3 font-medium">Estado</th>
                    <th className="text-left px-5 py-3 font-medium">Cliente</th>
                    <th className="text-left px-5 py-3 font-medium">Vehículo</th>
                    <th className="text-left px-5 py-3 font-medium">Servicio</th>
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
                        className={`border-b border-white/5 last:border-0 transition ${
                          hoy ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {hoy && (
                              <span className="text-[10px] font-bold bg-lux/20 text-lux px-1.5 py-0.5 rounded">HOY</span>
                            )}
                            <span className="text-white/40 text-xs">{day}</span>
                            <span className="text-white font-medium">{date}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-white font-mono">{time}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                            slot.isAvailable
                              ? "bg-green-500/10 text-green-400"
                              : slot.booking?.status === "Confirmed"
                              ? "bg-blue-500/10 text-blue-400"
                              : "bg-orange-500/10 text-orange-400"
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
                              <p className="text-white font-medium">{slot.booking.customerName}</p>
                              <p className="text-white/40 text-xs mt-0.5">{slot.booking.customerPhone}</p>
                            </div>
                          ) : (
                            <span className="text-white/20">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-white/60">
                          {slot.booking?.vehicle ?? <span className="text-white/20">—</span>}
                        </td>
                        <td className="px-5 py-4 text-white/60">
                          {slot.booking?.service ?? <span className="text-white/20">—</span>}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {!slot.isAvailable && (
                            <button
                              onClick={() => handleLiberar(slot.id)}
                              className="text-xs text-red-400/60 hover:text-red-400 transition font-medium"
                            >
                              Liberar
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
    </div>
  );
}
