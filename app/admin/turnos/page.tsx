"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, logout, fetchWithAuth } from "../../../src/lib/auth";

interface TimeSlot {
  id: number;
  startDateTime: string;
  endDateTime: string;
  isAvailable: boolean;
  bookingsCount: number;
  label: string;
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
      const response = await fetchWithAuth(
        "http://localhost:5048/api/timeslots"
      );
      if (response.ok) {
        const data = await response.json();
        setSlots(data);
      }
    } catch (error) {
      console.error("Error cargando turnos:", error);
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

      const response = await fetchWithAuth(
        "http://localhost:5048/api/timeslots",
        {
          method: "POST",
          body: JSON.stringify({
            startDateTime: startDateTime.toISOString(),
            endDateTime: endDateTime.toISOString(),
          }),
        }
      );

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
      console.error(error);
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
        `http://localhost:5048/api/timeslots/${editingSlot.id}`,
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
      console.error(error);
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
        `http://localhost:5048/api/timeslots/${id}`,
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
      console.error(error);
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
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
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
                        {slot.bookingsCount > 0 && (
                          <p className="text-white/50 text-xs">
                            {slot.bookingsCount} reserva(s)
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {slot.bookingsCount === 0 && (
                          <button
                            onClick={() => startEditing(slot)}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            Editar
                          </button>
                        )}
                        <button
                          onClick={() => deleteSlot(slot.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                          disabled={slot.bookingsCount > 0}
                        >
                          {slot.bookingsCount > 0 ? "🔒" : "Eliminar"}
                        </button>
                      </div>
                    </div>
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
