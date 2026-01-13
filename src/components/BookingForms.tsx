"use client";

import { useState, useEffect, type FormEvent } from "react";
import { API_BASE_URL } from "../lib/config";
import { logError } from "../lib/logger";

interface TimeSlot {
  id: number;
  startDateTime: string;
  endDateTime: string;
  label: string;
}

export default function BookingForm() {
  const [formData, setFormData] = useState({
    name: "",
    vehicle: "",
    whatsapp: "",
    selectedSlotId: null as number | null,
    message: "",
  });

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [visibleSlots, setVisibleSlots] = useState(2);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Cargar turnos disponibles
  useEffect(() => {
    loadAvailableSlots();
  }, []);

  const loadAvailableSlots = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/timeslots/available`
      );
      if (response.ok) {
        const data = await response.json();
        setTimeSlots(data);
      } else {
        logError("Error cargando turnos");
      }
    } catch (error) {
      logError("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCalendarSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.selectedSlotId) {
      alert("Por favor seleccioná un horario");
      return;
    }

    setSubmitting(true);

    try {
      const selectedSlot = timeSlots.find(
        (s) => s.id === formData.selectedSlotId
      );

      const response = await fetch(`${API_BASE_URL}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeSlotId: formData.selectedSlotId,
          customerName: formData.name,
          customerPhone: formData.whatsapp,
          vehicle: formData.vehicle,
          message: formData.message,
        }),
      });

      const data = await response.json();

      if (data.success || response.ok) {
        alert("✅ Turno agendado exitosamente!");

        // WhatsApp opcional
        const whatsappMsg = `Turno confirmado para ${formData.vehicle} el ${selectedSlot?.label}`;
        window.open(
          `https://wa.me/5491112345678?text=${encodeURIComponent(whatsappMsg)}`,
          "_blank"
        );

        // Limpiar formulario
        setFormData({
          name: "",
          vehicle: "",
          whatsapp: "",
          selectedSlotId: null,
          message: "",
        });

        // Recargar turnos disponibles
        loadAvailableSlots();
      } else {
        alert("❌ Error al agendar: " + (data.message || "Error desconocido"));
      }
    } catch (error) {
      alert("❌ Error de conexión con el servidor");
      logError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const slotsToShow = timeSlots.slice(0, visibleSlots);
  const selectedSlot = timeSlots.find((s) => s.id === formData.selectedSlotId);

  if (loading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center min-h-[400px]">
        <p className="text-white/70">Cargando turnos disponibles...</p>
      </div>
    );
  }

  if (timeSlots.length === 0) {
    return (
      <div className="glass-card p-6">
        <div className="text-center py-8">
          <p className="text-white/70 mb-4">
            No hay turnos disponibles en este momento.
          </p>
          <p className="text-white/50 text-sm">
            Contactanos por WhatsApp para coordinar.
          </p>

          <a
            href="https://wa.me/5491112345678"
            className="mt-4 inline-block rounded-full bg-lux px-6 py-3 text-sm font-semibold text-black"
          >
            Contactar por WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <form className="glass-card space-y-4 p-6" onSubmit={handleCalendarSubmit}>
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-white/50">
          Nombre
        </label>
        <input
          className="form-input mt-2"
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder="Tu nombre"
          required
          value={formData.name}
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-white/50">
          Vehículo
        </label>
        <input
          className="form-input mt-2"
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, vehicle: e.target.value }))
          }
          placeholder="Modelo y año"
          required
          value={formData.vehicle}
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-white/50">
          WhatsApp
        </label>
        <input
          className="form-input mt-2"
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, whatsapp: e.target.value }))
          }
          placeholder="+54 9 11 1234 5678"
          required
          value={formData.whatsapp}
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-white/50 mb-3 block">
          Seleccioná tu turno
        </label>
        <div className="grid max-h-[300px] gap-2 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-4 md:grid-cols-2">
          {slotsToShow.map((slot) => (
            <button
              key={slot.id}
              type="button"
              onClick={() =>
                setFormData((prev) => ({ ...prev, selectedSlotId: slot.id }))
              }
              className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                formData.selectedSlotId === slot.id
                  ? "border-electric bg-electric/20 text-electric"
                  : "border-white/10 text-white/70 hover:border-white/30 hover:bg-white/5"
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>

        {visibleSlots < timeSlots.length && (
          <button
            type="button"
            onClick={() => setVisibleSlots((prev) => prev + 10)}
            className="mt-3 w-full rounded-lg border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/60 transition hover:border-electric/50 hover:text-white"
          >
            Ver más horarios ({timeSlots.length - visibleSlots} más)
          </button>
        )}
      </div>

      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-white/50">
          Consulta
        </label>
        <textarea
          className="form-input mt-2 min-h-[140px]"
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, message: e.target.value }))
          }
          placeholder="¿Qué servicio buscás?"
          required
          value={formData.message}
        />
      </div>

      <button
        className="w-full rounded-full bg-electric px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] disabled:opacity-50"
        type="submit"
        disabled={submitting || !formData.selectedSlotId}
      >
        {submitting ? "Agendando..." : "Agendar turno"}
      </button>

      {selectedSlot && (
        <p className="text-center text-xs text-white/50">
          Turno seleccionado: {selectedSlot.label}
        </p>
      )}
    </form>
  );
}
