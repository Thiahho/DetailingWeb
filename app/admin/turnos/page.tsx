"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, logout, fetchWithAuth } from "../../../src/lib/auth";
import { API_BASE_URL } from "../../../src/lib/config";
import { logError } from "../../../src/lib/logger";

interface Booking {
  id: number;
  customerName: string;
  customerPhone: string;
  vehicle: string;
  service: string;
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

export default function TurnosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [formData, setFormData] = useState({
    date: "",
    time: "",
  });
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/admin/login");
    } else {
      loadSlots();
    }
  }, [router]);

  const loadSlots = async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/timeslots`);
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
      const startDateTime = new Date(`${formData.date}T${formData.time}`);
      const endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60000);

      const response = await fetchWithAuth(`${API_BASE_URL}/api/timeslots`, {
        method: "POST",
        body: JSON.stringify({
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("✅ Turno creado exitosamente");
        setFormData({ date: "", time: "" });
        loadSlots();
      } else {
        alert("❌ " + (data.message || "Error al crear turno"));
      }
    } catch (error) {
      alert("❌ Error de conexión");
      logError(error);
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (slot: TimeSlot) => {
    const date = new Date(slot.startDateTime);
    setEditingSlot(slot);
    setFormData({
      date: date.toISOString().split("T")[0],
      time: date.toTimeString().slice(0, 5),
    });
  };

  const updateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot) return;

    setCreating(true);

    try {
      const startDateTime = new Date(`${formData.date}T${formData.time}`);

      const response = await fetchWithAuth(
        `${API_BASE_URL}/api/timeslots/${editingSlot.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            startDateTime: startDateTime.toISOString(),
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert("✅ Turno actualizado exitosamente");
        setFormData({ date: "", time: "" });
        setEditingSlot(null);
        loadSlots();
      } else {
        alert("❌ " + (data.message || "Error al actualizar turno"));
      }
    } catch (error) {
      alert("❌ Error de conexión");
      logError(error);
    } finally {
      setCreating(false);
    }
  };

  const cancelEditing = () => {
    setEditingSlot(null);
    setFormData({ date: "", time: "" });
  };

  const deleteSlot = async (id: number) => {
    if (!confirm("¿Eliminar este turno?")) return;

    try {
      const response = await fetchWithAuth(
        `${API_BASE_URL}/api/timeslots/${id}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        alert("✅ Turno eliminado");
        loadSlots();
      } else {
        const data = await response.json();
        alert("❌ " + (data.message || "Error al eliminar"));
      }
    } catch (error) {
      logError(error);
    }
  };

  const releaseSlot = async (id: number) => {
    if (!confirm("¿Liberar este turno? La reserva será cancelada.")) return;

    try {
      const response = await fetchWithAuth(
        `${API_BASE_URL}/api/timeslots/${id}/release`,
        {
          method: "PUT",
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert("✅ Turno liberado exitosamente");
        loadSlots();
      } else {
        alert("❌ " + (data.message || "Error al liberar turno"));
      }
    } catch (error) {
      alert("❌ Error de conexión");
      logError(error);
    }
  };

  const updateBookingStatus = async (bookingId: number, status: string) => {
    try {
      const response = await fetchWithAuth(
        `${API_BASE_URL}/api/bookings/${bookingId}/status`,
        {
          method: "PUT",
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert(`✅ Estado actualizado a "${status}"`);
        loadSlots();
      } else {
        alert("❌ " + (data.message || "Error al actualizar estado"));
      }
    } catch (error) {
      alert("❌ Error de conexión");
      logError(error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending":
        return "text-yellow-400";
      case "Confirmed":
        return "text-green-400";
      case "Cancelled":
        return "text-red-400";
      case "Completed":
        return "text-blue-400";
      case "NoShow":
        return "text-orange-400";
      default:
        return "text-white/50";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "Pending":
        return "⏳ Pendiente";
      case "Confirmed":
        return "✅ Confirmado";
      case "Cancelled":
        return "❌ Cancelado";
      case "Completed":
        return "✔️ Completado";
      case "NoShow":
        return "🚫 No asistió";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-midnight">
        <p className="text-white">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-midnight p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Gestión de Turnos</h1>
          <button
            onClick={logout}
            className="rounded-lg border border-red-500/50 px-4 py-2 text-red-400 transition hover:bg-red-500/10"
          >
            Cerrar Sesión
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Formulario crear/editar turno */}
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              {editingSlot ? "Editar Turno" : "Crear Turno Disponible"}
            </h2>
            <form
              onSubmit={editingSlot ? updateSlot : createSlot}
              className="space-y-4"
            >
              <div>
                <label className="text-white/70 text-sm">Fecha</label>
                <input
                  type="date"
                  className="form-input mt-2"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <label className="text-white/70 text-sm">Hora disponible</label>
                <input
                  type="time"
                  className="form-input mt-2"
                  value={formData.time}
                  onChange={(e) =>
                    setFormData({ ...formData, time: e.target.value })
                  }
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-electric text-white py-3 rounded-lg font-semibold transition hover:bg-electric/90 disabled:opacity-50"
                >
                  {creating
                    ? "Guardando..."
                    : editingSlot
                    ? "Guardar Cambios"
                    : "Crear Turno"}
                </button>

                {editingSlot && (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="px-6 bg-white/10 text-white py-3 rounded-lg font-semibold transition hover:bg-white/20"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            {!editingSlot && (
              <div className="mt-6 p-4 bg-white/5 rounded-lg">
                <p className="text-white/70 text-sm mb-2">💡 Ejemplos:</p>
                <ul className="text-white/50 text-xs space-y-1">
                  <li>• Lunes 20/01 a las 10:00</li>
                  <li>• Lunes 20/01 a las 15:45</li>
                  <li>• Martes 21/01 a las 14:00</li>
                  <li>• Miércoles 22/01 a las 09:30</li>
                </ul>
              </div>
            )}
          </div>

          {/* Lista de turnos */}
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Turnos Creados ({slots.length})
            </h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {slots.length === 0 ? (
                <p className="text-white/50 text-sm text-center py-8">
                  No hay turnos creados. Creá el primero ↑
                </p>
              ) : (
                slots.map((slot) => (
                  <div
                    key={slot.id}
                    className={`p-4 rounded-lg border ${
                      editingSlot?.id === slot.id
                        ? "bg-electric/20 border-electric"
                        : slot.isAvailable
                        ? "bg-green-500/10 border-green-500/30"
                        : "bg-red-500/10 border-red-500/30"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-white font-medium">{slot.label}</p>
                        <p className="text-white/50 text-xs mt-1">
                          {slot.isAvailable ? "✅ Disponible" : "🔴 Reservado"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {slot.isAvailable && slot.bookingsCount === 0 && (
                          <>
                            <button
                              onClick={() => startEditing(slot)}
                              className="text-blue-400 hover:text-blue-300 text-sm"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => deleteSlot(slot.id)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                        {!slot.isAvailable && (
                          <button
                            onClick={() => releaseSlot(slot.id)}
                            className="text-yellow-400 hover:text-yellow-300 text-sm font-medium"
                          >
                            Liberar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Info de la reserva */}
                    {slot.booking && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-white/50">Cliente:</span>
                            <span className="text-white ml-1">
                              {slot.booking.customerName}
                            </span>
                          </div>
                          <div>
                            <span className="text-white/50">Tel:</span>
                            <span className="text-white ml-1">
                              {slot.booking.customerPhone}
                            </span>
                          </div>
                          <div>
                            <span className="text-white/50">Vehículo:</span>
                            <span className="text-white ml-1">
                              {slot.booking.vehicle}
                            </span>
                          </div>
                          <div>
                            <span className="text-white/50">Servicio:</span>
                            <span className="text-white ml-1">
                              {slot.booking.service}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <span
                            className={`text-sm font-medium ${getStatusColor(
                              slot.booking.status
                            )}`}
                          >
                            {getStatusLabel(slot.booking.status)}
                          </span>

                          {slot.booking.status === "Pending" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  updateBookingStatus(
                                    slot.booking!.id,
                                    "Confirmed"
                                  )
                                }
                                className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() =>
                                  updateBookingStatus(
                                    slot.booking!.id,
                                    "Cancelled"
                                  )
                                }
                                className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30"
                              >
                                Cancelar
                              </button>
                            </div>
                          )}

                          {slot.booking.status === "Confirmed" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  updateBookingStatus(
                                    slot.booking!.id,
                                    "Completed"
                                  )
                                }
                                className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/30"
                              >
                                Completado
                              </button>
                              <button
                                onClick={() =>
                                  updateBookingStatus(
                                    slot.booking!.id,
                                    "NoShow"
                                  )
                                }
                                className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs hover:bg-orange-500/30"
                              >
                                No asistió
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
