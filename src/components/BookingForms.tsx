"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { logError } from "../lib/logger";

interface TimeSlot {
  id: number;
  startDateTime: string;
  endDateTime: string;
  label: string;
}

interface ServicePack {
  id: number;
  title: string;
  slug: string;
  price: string;
  duration: string;
  customFieldsSchema?: string;
}

interface CustomFieldDef {
  name: string;
  key: string;
  type: "text" | "select" | "number" | "textarea";
  options?: string[];
  required?: boolean;
}

interface BookingFormProps {
  preselectedService?: string;
}

// --- Toast Types ---
type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// --- Toast Component para Cliente ---
function ClientToast({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const duration = toast.duration || 5000;
    const interval = 50;
    const decrement = (interval / duration) * 100;

    const progressTimer = setInterval(() => {
      setProgress((prev) => Math.max(0, prev - decrement));
    }, interval);

    const exitTimer = setTimeout(() => setIsExiting(true), duration - 400);
    const closeTimer = setTimeout(onClose, duration);

    return () => {
      clearInterval(progressTimer);
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
    };
  }, [toast.duration, onClose]);

  const configs = {
    success: {
      bg: "from-green-500/95 to-emerald-600/95",
      border: "border-green-400/50",
      glow: "shadow-[0_0_40px_rgba(34,197,94,0.5),0_0_80px_rgba(34,197,94,0.2)]",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      progressBg: "bg-green-300",
    },
    error: {
      bg: "from-red-500/95 to-rose-600/95",
      border: "border-red-400/50",
      glow: "shadow-[0_0_40px_rgba(239,68,68,0.5),0_0_80px_rgba(239,68,68,0.2)]",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      progressBg: "bg-red-300",
    },
    warning: {
      bg: "from-amber-500/95 to-orange-600/95",
      border: "border-amber-400/50",
      glow: "shadow-[0_0_40px_rgba(245,158,11,0.5),0_0_80px_rgba(245,158,11,0.2)]",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      progressBg: "bg-amber-300",
    },
    info: {
      bg: "from-blue-500/95 to-indigo-600/95",
      border: "border-blue-400/50",
      glow: "shadow-[0_0_40px_rgba(59,130,246,0.5),0_0_80px_rgba(59,130,246,0.2)]",
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      progressBg: "bg-blue-300",
    },
  };

  const config = configs[toast.type];

  return (
    <div
      className={`
        fixed inset-0 z-[9999] flex items-center justify-center p-4
        transition-all duration-400
        ${isExiting ? "opacity-0" : "opacity-100"}
      `}
      style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={() => {
        setIsExiting(true);
        setTimeout(onClose, 400);
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`
          bg-gradient-to-br ${config.bg}
          border-2 ${config.border}
          ${config.glow}
          rounded-2xl p-6 w-full max-w-sm
          transform transition-all duration-400 ease-out
          ${isExiting ? "scale-90 opacity-0" : "scale-100 opacity-100 animate-bounce-in"}
        `}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="bg-white/20 p-4 rounded-full animate-pulse-glow">
            {config.icon}
          </div>
        </div>

        {/* Content */}
        <div className="text-center">
          <h3 className="text-xl font-bold text-white mb-2">{toast.title}</h3>
          {toast.message && (
            <p className="text-white/90 text-sm leading-relaxed">{toast.message}</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-5 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className={`h-full ${config.progressBg} transition-all duration-100 ease-linear rounded-full`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Tap to close hint */}
        <p className="text-center text-white/50 text-xs mt-3">Toca para cerrar</p>
      </div>

      {/* Estilos de animación */}
      <style jsx>{`
        @keyframes bounce-in {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(255,255,255,0.3); }
          50% { box-shadow: 0 0 40px rgba(255,255,255,0.5); }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default function BookingForm({ preselectedService }: BookingFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    whatsapp: "",
    email:"",
    selectedSlotId: null as number | null,
    selectedService: "",
    message: "",
  });

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [services, setServices] = useState<ServicePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  const subjectLabel = process.env.NEXT_PUBLIC_BOOKING_SUBJECT_LABEL?.trim() || "Trabajo";
  const subjectPlaceholder = process.env.NEXT_PUBLIC_BOOKING_SUBJECT_PLACEHOLDER?.trim() || "Describe brevemente";

  const selectedServiceObj = services.find((s) => s.slug === formData.selectedService) ?? null;
  const customFieldDefs: CustomFieldDef[] = (() => {
    if (!selectedServiceObj?.customFieldsSchema) return [];
    try { return JSON.parse(selectedServiceObj.customFieldsSchema); } catch { return []; }
  })();

  // --- Estado de Toast ---
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((type: ToastType, title: string, message?: string, duration?: number) => {
    setToast({ id: Date.now(), type, title, message, duration });
  }, []);

  const closeToast = useCallback(() => setToast(null), []);

  // --- LÓGICA DE PAGINACIÓN ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6; // Ajusta cuántos turnos ver por vez

  const totalPages = Math.ceil(timeSlots.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentSlots = timeSlots.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Cargar turnos y servicios
  useEffect(() => {
    loadAvailableSlots();
    loadServices();
  }, []);
  useEffect(() => {
    if (preselectedService) {
      setFormData((prev) => ({ ...prev, selectedService: preselectedService }));
    }
  }, [preselectedService]);

  // Reset custom field values when service changes
  useEffect(() => {
    setCustomFieldValues({});
  }, [formData.selectedService]);

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

  const loadServices = async () => {
    try {
      const response = await fetch("/api/services");
      if (response.ok) {
        setServices(await response.json());
      }
    } catch (error) {
      logError(error);
    }
  };

  const handleCalendarSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.selectedSlotId) {
      showToast("warning", "Seleccioná un horario", "Por favor elegí un turno disponible para continuar");
      return;
    }

    if (!formData.selectedService) {
      showToast("warning", "Seleccioná un servicio", "Por favor elegí el servicio que necesitás");
      return;
    }

    // Validate required custom fields
    for (const field of customFieldDefs) {
      if (field.required && !customFieldValues[field.key]?.trim()) {
        showToast("warning", "Campo requerido", `Por favor completá el campo "${field.name}"`);
        return;
      }
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
          email: formData.email,
          subject: formData.subject,
          service: formData.selectedService,
          message: formData.message,
          customFieldsJson: customFieldDefs.length > 0 ? JSON.stringify(customFieldValues) : null,
        }),
      });

      const data = await response.json();

      if (data.success || response.ok) {
        showToast(
          "success",
          "¡Turno Reservado!",
          "Tu turno fue agendado exitosamente. Nos pondremos en contacto para confirmar.",
          6000
        );

        // Limpiar formulario
        setFormData({
          name: "",
          subject: "",
          whatsapp: "",
          email:"",
          selectedSlotId: null,
          selectedService: "",
          message: "",
        });
        setCustomFieldValues({});

        // Resetear paginación y recargar turnos
        setCurrentPage(1);
        loadAvailableSlots();
      } else {
        showToast("error", "Error al agendar", data.message || "No se pudo completar la reserva. Intentá nuevamente.");
      }
    } catch (error) {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor. Verificá tu conexión e intentá de nuevo.");
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
    <>
      {/* Toast Notification */}
      {toast && <ClientToast toast={toast} onClose={closeToast} />}

      <form className="glass-card space-y-4 p-6" onSubmit={handleCalendarSubmit}>
      {/* Inputs de Nombre, Asunto y WhatsApp */}
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
          {subjectLabel}
        </label>
        <input
          className="form-input mt-2"
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, subject: e.target.value }))
          }
          placeholder={subjectPlaceholder}
          required
          value={formData.subject}
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
      
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-white/50">
          Email (para recibir confirmación automática)
        </label>
        <input 
          className="form-input mt-2"
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, email: e.target.value }))
          }
          placeholder="tucorreo@gmail.com"
          value={formData.email}
          />
      </div>

      {/* Selector de Servicio (Igual a tu original) */}
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-white/50 mb-3 block">
          Seleccioná el servicio
        </label>
        <div className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-4 md:grid-cols-2">
          {services.map((pack) => (
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
                ${pack.price} · {pack.duration}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Campos dinámicos del servicio */}
      {customFieldDefs.length > 0 && (
        <div className="space-y-3">
          {customFieldDefs.map((field) => (
            <div key={field.key}>
              <label className="text-xs uppercase tracking-[0.2em] text-white/50">
                {field.name}{field.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              {field.type === "select" ? (
                <select
                  className="form-input mt-2"
                  required={field.required}
                  value={customFieldValues[field.key] ?? ""}
                  onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                >
                  <option value="">Seleccioná una opción</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  className="form-input mt-2 min-h-[80px]"
                  required={field.required}
                  value={customFieldValues[field.key] ?? ""}
                  onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.name}
                />
              ) : (
                <input
                  type={field.type === "number" ? "number" : "text"}
                  className="form-input mt-2"
                  required={field.required}
                  value={customFieldValues[field.key] ?? ""}
                  onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.name}
                />
              )}
            </div>
          ))}
        </div>
      )}

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
    </>
  );
}
