"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isProfessionalAuthenticated, getRole } from "../../../src/lib/auth";
import { logError } from "../../../src/lib/logger";

interface Booking {
  id: number;
  customerName: string;
  customerPhone: string;
  service?: string;
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

export default function ProfessionalAgendaPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ date: "", hour: "09", minute: "00" });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isProfessionalAuthenticated()) {
      router.push(getRole() === "Admin" ? "/admin/turnos" : "/profesional/login");
      return;
    }
    loadSlots();
  }, [router]);

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

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
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
        showMessage("success", "Turno creado en tu agenda");
        setFormData((prev) => ({ ...prev, date: "" }));
        loadSlots();
      } else {
        showMessage("error", data.message || "No se pudo crear el turno");
      }
    } catch (error) {
      showMessage("error", "Error de conexión");
      logError(error);
    } finally {
      setCreating(false);
    }
  };

  const releaseSlot = async (id: number) => {
    if (!confirm("¿Liberar este turno? Si tenía una reserva, se cancela.")) return;
    const res = await fetch(`/api/timeslots/${id}/release`, { method: "PUT" });
    if (res.ok) {
      showMessage("success", "Turno liberado");
      loadSlots();
    } else {
      showMessage("error", "No se pudo liberar el turno");
    }
  };

  const deleteSlot = async (id: number) => {
    if (!confirm("¿Eliminar este turno de tu agenda?")) return;
    const res = await fetch(`/api/timeslots/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      showMessage("success", "Turno eliminado");
      loadSlots();
    } else {
      showMessage("error", data.message || "No se pudo eliminar el turno");
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

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      {message && (
        <div className={`fixed top-6 right-6 z-[9999] rounded-lg px-4 py-3 text-sm shadow-lg ${
          message.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {message.text}
        </div>
      )}

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
                className="w-full bg-blush hover:bg-blushdark text-white py-3 rounded-lg font-semibold shadow-glow transition disabled:opacity-50"
              >
                {creating ? "Creando..." : "Crear turno"}
              </button>
            </form>
          </div>

          {/* Lista de turnos */}
          <div className="bg-ivory border border-mauve/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-charcoal mb-4">
              Próximos turnos ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-charcoal/40 text-sm py-8 text-center">No tenés turnos cargados todavía.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((slot) => (
                  <div
                    key={slot.id}
                    className={`p-4 rounded-xl border ${
                      slot.isAvailable
                        ? "border-green-200 bg-green-50"
                        : slot.booking?.status === "Confirmed"
                        ? "border-blue-200 bg-blue-50"
                        : "border-orange-200 bg-orange-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-charcoal font-medium text-sm">{slot.label}</p>
                        {!slot.isAvailable && slot.booking && (
                          <p className="text-charcoal/60 text-xs mt-1">
                            {slot.booking.customerName} · {slot.booking.customerPhone}
                            {slot.booking.service && ` · ${slot.booking.service}`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          slot.isAvailable
                            ? "bg-green-500/20 text-green-700"
                            : slot.booking?.status === "Confirmed"
                            ? "bg-blue-500/20 text-blue-700"
                            : "bg-orange-500/20 text-orange-700"
                        }`}>
                          {slot.isAvailable ? "LIBRE" : slot.booking?.status === "Confirmed" ? "CONFIRMADO" : "RESERVADO"}
                        </span>
                        {slot.isAvailable ? (
                          <button
                            onClick={() => deleteSlot(slot.id)}
                            className="text-red-600 hover:text-red-700 text-xs font-medium uppercase tracking-wide transition"
                          >
                            Eliminar
                          </button>
                        ) : (
                          <button
                            onClick={() => releaseSlot(slot.id)}
                            className="text-green-700 hover:text-green-800 text-xs font-medium uppercase tracking-wide transition"
                          >
                            Liberar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
