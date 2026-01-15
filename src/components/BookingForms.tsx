"use client";

import { useState, useEffect, type FormEvent } from "react";
import { logError } from "../lib/logger";
import { packs } from "../lib/data";

interface TimeSlot {
  id: number;
  startDateTime: string;
  endDateTime: string;
  label: string;
}

interface BookingFormProps {
  preselectedService?: string;
}

export default function BookingForm({ preselectedService }: BookingFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    vehicle: "",
    whatsapp: "",
    selectedSlotId: null as number | null,
    selectedService: "",
    message: "",
  });

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // --- LÓGICA DE PAGINACIÓN ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6; // Ajusta cuántos turnos ver por vez

  const totalPages = Math.ceil(timeSlots.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentSlots = timeSlots.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Cargar turnos y resto de efectos (igual al original)
  useEffect(() => {
    loadAvailableSlots();
  }, []);
  useEffect(() => {
    if (preselectedService) {
      setFormData((prev) => ({ ...prev, selectedService: preselectedService }));
    }
  }, [preselectedService]);

  const loadAvailableSlots = async () => {
    try {
      const response = await fetch(`/api/timeslots/available`);
      if (response.ok) {
        const data = await response.json();
        setTimeSlots(data);
      }
    } catch (error) {
      logError(error);
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

    if (!formData.selectedService) {
      alert("Por favor seleccioná un servicio");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeSlotId: formData.selectedSlotId,
          customerName: formData.name,
          customerPhone: formData.whatsapp,
          vehicle: formData.vehicle,
          service: formData.selectedService,
          message: formData.message,
        }),
      });

      const data = await response.json();

      if (data.success || response.ok) {
        alert(
          "✅ Turno agendado exitosamente! Nos pondremos en contacto para confirmar."
        );

        // Limpiar formulario
        setFormData({
          name: "",
          vehicle: "",
          whatsapp: "",
          selectedSlotId: null,
          selectedService: "",
          message: "",
        });

        // Resetear paginación y recargar turnos
        setCurrentPage(1);
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

  if (loading)
    return (
      <div className="glass-card p-6 flex items-center justify-center min-h-[400px]">
        <p className="text-white/70">Cargando...</p>
      </div>
    );

  return (
    <form className="glass-card space-y-4 p-6" onSubmit={handleCalendarSubmit}>
      {/* Inputs de Nombre, Vehículo y WhatsApp (Igual a tu original) */}
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
          placeholder="+54 9 11 111 1111"
          required
          value={formData.whatsapp}
        />
      </div>

      {/* Selector de Servicio (Igual a tu original) */}
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-white/50 mb-3 block">
          Seleccioná el servicio
        </label>
        <div className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-4 md:grid-cols-2">
          {packs.map((pack) => (
            <button
              key={pack.slug}
              type="button"
              onClick={() =>
                setFormData((prev) => ({ ...prev, selectedService: pack.slug }))
              }
              className={`rounded-lg border px-4 py-3 text-left transition ${
                formData.selectedService === pack.slug
                  ? "border-lux bg-lux/20 text-lux"
                  : "border-white/10 text-white/70 hover:border-white/30 hover:bg-white/5"
              }`}
            >
              <span className="block text-sm font-medium">{pack.title}</span>
              <span className="block text-xs text-white/50 mt-1">
                {pack.price} · {pack.time}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Selector de Turno con PAGINACIÓN */}
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-white/50 mb-3 block">
          Seleccioná tu turno
        </label>
        <div className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-4 md:grid-cols-2">
          {currentSlots.map((slot) => (
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

        {/* CONTROLES DE PAGINACIÓN (Flechas y números) */}
        {totalPages > 1 && (
          <div className="mt-4 flex justify-center items-center gap-4">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
              className="p-2 text-white/50 hover:text-white disabled:opacity-20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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

            <div className="flex gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      currentPage === page
                        ? "bg-white text-black"
                        : "bg-white/5 text-white/50"
                    }`}
                  >
                    {page}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className="p-2 text-white/50 hover:text-white disabled:opacity-20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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

      {/* Consulta y Botón Final (Igual a tu original) */}
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-white/50">
          Consulta adicional
        </label>
        <textarea
          className="form-input mt-2 min-h-[100px]"
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, message: e.target.value }))
          }
          placeholder="¿Detalles?"
          value={formData.message}
        />
      </div>

      <button
        className="w-full rounded-full bg-electric px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] disabled:opacity-50"
        type="submit"
        disabled={
          submitting || !formData.selectedSlotId || !formData.selectedService
        }
      >
        {submitting ? "Agendando..." : "Agendar turno"}
      </button>
    </form>
  );
}
