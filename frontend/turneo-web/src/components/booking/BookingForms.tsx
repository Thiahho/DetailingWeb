"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { logError } from "@/src/lib/logger";
import PaymentButton from "@/src/components/payments/PaymentButton";

interface TimeSlot {
  id: number;
  startDateTime: string;
  endDateTime: string;
  label: string;
  professionalId?: number | null;
  professionalName?: string | null;
}

interface ServicePack {
  id: number;
  title: string;
  slug: string;
  price: string;
  duration: string;
  customFieldsSchema?: string;
}

interface Professional {
  id: number;
  firstName: string;
  lastName: string;
  photoUrl: string;
  calendarColor: string;
  specialty?: string;
  services?: { id: number; title: string }[];
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
  // Presentes cuando el form se embebe en el flujo público de Smart Tag
  // (docs/NFC.md): la página vive en el dominio compartido turneo.app/s/{token},
  // no en el subdominio propio del tenant, así que hay que pasarle el tenant
  // explícito a cada fetch en vez de confiar en el Host real (ver tenantHeader.ts).
  tenantSlugOverride?: string;
  smartTagToken?: string;
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

export default function BookingForm({ preselectedService, tenantSlugOverride, smartTagToken }: BookingFormProps) {
  const withTenant = useCallback(
    (path: string) => {
      if (!tenantSlugOverride) return path;
      const separator = path.includes("?") ? "&" : "?";
      return `${path}${separator}tenantSlug=${encodeURIComponent(tenantSlugOverride)}`;
    },
    [tenantSlugOverride]
  );

  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    whatsapp: "",
    email:"",
    selectedSlotId: null as number | null,
    selectedService: "",
    selectedProfessionalId: null as number | null,
    message: "",
    acceptedTerms: false,
  });

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [services, setServices] = useState<ServicePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loadingProfessionals, setLoadingProfessionals] = useState(false);
  const [completedBooking, setCompletedBooking] = useState<{ id: number; service: string } | null>(null);

  const subjectLabel = process.env.NEXT_PUBLIC_BOOKING_SUBJECT_LABEL?.trim() || "Trabajo";
  const subjectPlaceholder = process.env.NEXT_PUBLIC_BOOKING_SUBJECT_PLACEHOLDER?.trim() || "Describe brevemente";

  const selectedServiceObj = services.find((s) => s.slug === formData.selectedService) ?? null;
  const customFieldDefs: CustomFieldDef[] = (() => {
    if (!selectedServiceObj?.customFieldsSchema) return [];
    try { return JSON.parse(selectedServiceObj.customFieldsSchema); } catch { return []; }
  })();

  // Profesionales que ofrecen el servicio elegido (filtro en cliente, la lista completa ya viene con sus servicios)
  const availableProfessionals = selectedServiceObj
    ? professionals.filter((p) => p.services?.some((s) => s.id === selectedServiceObj.id))
    : [];

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

  // Cargar servicios y profesionales (una sola vez)
  useEffect(() => {
    loadServices();
    loadProfessionals();
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

  // Cambiar de servicio invalida la elección de especialista (puede no ofrecer el nuevo servicio)
  useEffect(() => {
    setFormData((prev) => ({ ...prev, selectedProfessionalId: null }));
  }, [formData.selectedService]);

  // Cargar turnos disponibles: de todos los profesionales, o solo del elegido ("sin preferencia" = null)
  useEffect(() => {
    setFormData((prev) => ({ ...prev, selectedSlotId: null }));
    setCurrentPage(1);
    loadAvailableSlots(formData.selectedProfessionalId);
  }, [formData.selectedProfessionalId]);

  const loadProfessionals = async () => {
    try {
      const response = await fetch(withTenant("/api/professionals"));
      if (response.ok) {
        setProfessionals(await response.json());
      }
    } catch (error) {
      logError(error);
    } finally {
      setLoadingProfessionals(false);
    }
  };

  const loadAvailableSlots = async (professionalId?: number | null) => {
    try {
      const query = professionalId ? `?professionalId=${professionalId}` : "";
      const response = await fetch(withTenant(`/api/timeslots/available${query}`));
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
      const response = await fetch(withTenant("/api/services"));
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

    if (!formData.acceptedTerms) {
      showToast("warning", "Términos y Condiciones", "Tenés que aceptar los Términos y Condiciones para reservar");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(withTenant(`/api/bookings`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeSlotId: formData.selectedSlotId,
          customerName: formData.name,
          customerPhone: formData.whatsapp,
          email: formData.email,
          subject: formData.subject,
          service: formData.selectedService,
          professionalId: formData.selectedProfessionalId,
          message: formData.message,
          customFieldsJson: customFieldDefs.length > 0 ? JSON.stringify(customFieldValues) : null,
          smartTagToken: smartTagToken ?? null,
          acceptedTerms: formData.acceptedTerms,
        }),
      });

      const data = await response.json();

      if (data.success || response.ok) {
        const bookingId = data.booking?.id;
        const serviceName = formData.selectedService;

        showToast(
          "success",
          "¡Turno Reservado!",
          "Tu turno fue agendado. Te vamos a contactar para confirmarlo.",
          6000
        );

        // Show payment step
        if (bookingId) {
          setCompletedBooking({ id: bookingId, service: serviceName });
        }

        // Limpiar formulario
        setFormData({
          name: "",
          subject: "",
          whatsapp: "",
          email:"",
          selectedSlotId: null,
          selectedService: "",
          selectedProfessionalId: null,
          message: "",
          acceptedTerms: false,
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
        <p className="text-charcoal/70">Cargando...</p>
      </div>
    );

  // If booking was completed, show confirmation step
  if (completedBooking) {
    return (
      <>
        {toast && <ClientToast toast={toast} onClose={closeToast} />}
        <div className="glass-card space-y-6 p-6" data-testid="booking-confirmed">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-2">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-charcoal">¡Turno reservado!</h3>
            <p className="text-charcoal/60 text-sm">
              Te vamos a contactar por WhatsApp para confirmar tu turno.
            </p>
          </div>

          <details className="group">
            <summary className="cursor-pointer text-center text-sm text-charcoal/50 hover:text-charcoal/70 transition list-none">
              ¿Preferís adelantar el pago? <span className="underline">Pagar ahora (opcional)</span>
            </summary>
            <div className="mt-4">
              <PaymentButton
                bookingId={completedBooking.id}
                serviceName={completedBooking.service}
              />
            </div>
          </details>

          <button
            type="button"
            onClick={() => setCompletedBooking(null)}
            className="w-full rounded-full border border-mauve/20 px-6 py-3 text-sm font-medium text-charcoal/70 hover:border-mauve/40 hover:text-charcoal transition"
          >
            Listo
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Toast Notification */}
      {toast && <ClientToast toast={toast} onClose={closeToast} />}

      <form className="glass-card space-y-4 p-6" onSubmit={handleCalendarSubmit}>
      {/* Inputs de Nombre, Asunto y WhatsApp */}
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-charcoal/50">
          Nombre
        </label>
        <input
          className="form-input mt-2"
          data-testid="booking-name-input"
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder="Tu nombre"
          required
          value={formData.name}
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-charcoal/50">
          {subjectLabel}
        </label>
        <input
          className="form-input mt-2"
          data-testid="booking-subject-input"
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, subject: e.target.value }))
          }
          placeholder={subjectPlaceholder}
          required
          value={formData.subject}
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-charcoal/50">
          WhatsApp
        </label>
        <input
          className="form-input mt-2"
          data-testid="booking-whatsapp-input"
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, whatsapp: e.target.value }))
          }
          placeholder="+54 9 11 111 1111"
          required
          value={formData.whatsapp}
        />
      </div>
      
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-charcoal/50">
          Email (para recibir confirmación automática)
        </label>
        <input
          className="form-input mt-2"
          data-testid="booking-email-input"
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, email: e.target.value }))
          }
          placeholder="tucorreo@gmail.com"
          value={formData.email}
          />
      </div>

      {/* Selector de Servicio (Igual a tu original) */}
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-charcoal/50 mb-3 block">
          Seleccioná el servicio
        </label>
        <div className="grid gap-2 rounded-xl border border-mauve/15 bg-white p-4 md:grid-cols-2">
          {services.map((pack) => (
            <button
              key={pack.slug}
              type="button"
              data-testid="booking-service-option"
              data-service-slug={pack.slug}
              onClick={() =>
                setFormData((prev) => ({ ...prev, selectedService: pack.slug }))
              }
              className={`rounded-lg border px-4 py-3 text-left transition ${
                formData.selectedService === pack.slug
                  ? "border-blush bg-blush/15 text-blushdark"
                  : "border-mauve/15 text-charcoal/70 hover:border-mauve/30 hover:bg-porcelain/60"
              }`}
            >
              <span className="block text-sm font-medium">{pack.title}</span>
              <span className="block text-xs text-charcoal/50 mt-1">
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
              <label className="text-xs uppercase tracking-[0.2em] text-charcoal/50">
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

      {/* Selector de Profesional (opcional) — antes de elegir turno, filtra qué horarios se muestran */}
      {selectedServiceObj && (
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-charcoal/50 mb-3 block">
            Especialista (opcional)
          </label>
          {loadingProfessionals ? (
            <p className="text-sm text-charcoal/50">Buscando especialistas disponibles...</p>
          ) : availableProfessionals.length === 0 ? (
            <p className="text-sm text-charcoal/50">
              No hay especialistas asignados a este servicio todavía, se te asignará uno automáticamente.
            </p>
          ) : (
            <div className="grid gap-2 rounded-xl border border-mauve/15 bg-white p-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, selectedProfessionalId: null }))
                }
                className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                  formData.selectedProfessionalId === null
                    ? "border-blush bg-blush/15 text-blushdark"
                    : "border-mauve/15 text-charcoal/70 hover:border-mauve/30 hover:bg-porcelain/60"
                }`}
              >
                <span className="block font-medium">Sin preferencia</span>
                <span className="block text-xs text-charcoal/50 mt-1">
                  Vas a ver los horarios de todos los especialistas disponibles
                </span>
              </button>

              {availableProfessionals.map((pro) => (
                <button
                  key={pro.id}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, selectedProfessionalId: pro.id }))
                  }
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition ${
                    formData.selectedProfessionalId === pro.id
                      ? "border-blush bg-blush/15 text-blushdark"
                      : "border-mauve/15 text-charcoal/70 hover:border-mauve/30 hover:bg-porcelain/60"
                  }`}
                >
                  {pro.photoUrl ? (
                    <img
                      src={pro.photoUrl}
                      alt={`${pro.firstName} ${pro.lastName}`}
                      className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <span
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: pro.calendarColor || "#6366f1" }}
                    >
                      {pro.firstName?.[0]}
                      {pro.lastName?.[0]}
                    </span>
                  )}
                  <span>
                    <span className="block font-medium">
                      {pro.firstName} {pro.lastName}
                    </span>
                    {pro.specialty && (
                      <span className="block text-xs text-charcoal/50 mt-1">{pro.specialty}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selector de Turno con PAGINACIÓN */}
      {selectedServiceObj && (
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-charcoal/50 mb-3 block">
          Seleccioná tu turno
        </label>
        <div className="grid gap-2 rounded-xl border border-mauve/15 bg-white p-4 md:grid-cols-2">
          {currentSlots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              data-testid="booking-slot-option"
              onClick={() =>
                setFormData((prev) => ({ ...prev, selectedSlotId: slot.id }))
              }
              className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                formData.selectedSlotId === slot.id
                  ? "border-lavender bg-lavender/25 text-mauve"
                  : "border-mauve/15 text-charcoal/70 hover:border-mauve/30 hover:bg-porcelain/60"
              }`}
            >
              <span className="block">{slot.label}</span>
              {!formData.selectedProfessionalId && slot.professionalName && (
                <span className="block text-xs text-charcoal/40 mt-0.5">👤 {slot.professionalName}</span>
              )}
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
              className="p-3 text-charcoal/50 hover:text-charcoal disabled:opacity-20"
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
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      currentPage === page
                        ? "bg-blush text-white"
                        : "bg-porcelain text-charcoal/40"
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
              className="p-3 text-charcoal/50 hover:text-charcoal disabled:opacity-20"
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
      )}

      {/* Consulta y Botón Final (Igual a tu original) */}
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-charcoal/50">
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

      <label className="flex items-start gap-2 text-xs text-charcoal/70">
        <input
          type="checkbox"
          className="mt-0.5"
          data-testid="booking-accept-terms"
          checked={formData.acceptedTerms}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, acceptedTerms: e.target.checked }))
          }
        />
        <span>
          Leí y acepto los{" "}
          <a
            href="/terminos"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blush hover:underline"
          >
            Términos y Condiciones
          </a>{" "}
          y la{" "}
          <a
            href="/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blush hover:underline"
          >
            Política de Privacidad
          </a>
        </span>
      </label>

      <button
        className="w-full rounded-full bg-blush px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] disabled:opacity-50"
        type="submit"
        data-testid="booking-submit"
        disabled={
          submitting ||
          !formData.selectedSlotId ||
          !formData.selectedService ||
          !formData.acceptedTerms
        }
      >
        {submitting ? "Agendando..." : "Agendar turno"}
      </button>
    </form>
    </>
  );
}
