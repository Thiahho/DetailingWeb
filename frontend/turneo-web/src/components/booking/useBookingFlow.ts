"use client";

import { useState, useEffect, useCallback, useRef, type FormEvent } from "react";
import { logError } from "@/src/lib/logger";
import { buildAvailableSlotsUrl } from "@/src/lib/bookingRange";
import { slotRangeLabel } from "@/src/lib/slotLabel";
import { normalizeLocationType, type ServiceLocationType } from "@/src/lib/homeService/serviceLocation";
import {
  EMPTY_HOME_ADDRESS,
  buildHomeAddressPayload,
  parseActiveCoverageLocalities,
  type ActiveCoverageLocality,
  type HomeAddressForm,
} from "@/src/lib/homeService/bookingAddress";

export interface TimeSlot {
  id: number;
  startDateTime: string;
  endDateTime: string;
  // End of the range the requested service would occupy (may span several slots).
  bookingEndDateTime?: string | null;
  label: string;
  professionalId?: number | null;
  professionalName?: string | null;
}

export interface ActivePromotion {
  serviceId: number;
  serviceSlug: string;
  promotionName: string;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
}

export interface ServicePack {
  id: number;
  title: string;
  slug: string;
  price: string;
  duration: string;
  customFieldsSchema?: string;
  locationType?: ServiceLocationType | number;
}

export interface Professional {
  id: number;
  firstName: string;
  lastName: string;
  photoUrl: string;
  calendarColor: string;
  specialty?: string;
  services?: { id: number; title: string }[];
}

export interface CustomFieldDef {
  name: string;
  key: string;
  type: "text" | "select" | "number" | "textarea";
  options?: string[];
  required?: boolean;
}

// Entrada "directo con un profesional" desde las cards de Equipo. `key` cambia en
// cada click para que volver a elegir el mismo profesional re-dispare la preselección.
export interface BookingPreselection {
  professionalId: number;
  slotId?: number | null;
  key: number;
}

export interface BookingFormProps {
  preselectedService?: string;
  // Cambia en cada click de "Reservar" de una card de servicio, para que volver
  // a elegir el mismo servicio re-dispare la preselección (igual que preselection.key).
  preselectedServiceKey?: number;
  preselection?: BookingPreselection | null;
  // Presentes cuando el form se embebe en el flujo público de Smart Tag
  // (docs/NFC.md): la página vive en el dominio compartido turneo.app/s/{token},
  // no en el subdominio propio del tenant, así que hay que pasarle el tenant
  // explícito a cada fetch en vez de confiar en el Host real (ver tenantHeader.ts).
  tenantSlugOverride?: string;
  smartTagToken?: string;
  // Canal por el que se abrió el Smart Link (?src= de /s/{token}); viaja con
  // la reserva para atribuirla al chip NFC o al QR de la etiqueta.
  smartTagSource?: SmartTagSource;
  // Tenant WhatsApp (site config), used by the out-of-coverage contact button
  // of at-home services. Without it the button is not shown.
  whatsAppNumber?: string;
}

export type CoverageStatus = "idle" | "loading" | "ready" | "error";

export interface BookingFlowOptions {
  // At-home services only: called when the backend rejects the chosen slot (409: taken or inside the
  // travel buffer of another at-home booking), after the slots are reloaded.
  onSlotConflict?: () => void;
}

export type SmartTagSource = "nfc" | "qr";

// --- Toast Types ---
export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// Estado y reglas del flujo público de reserva (servicios, especialista,
// horarios, envío). La presentación vive aparte: BookingForms.tsx (formulario
// de una sola pantalla, usado en Smart Tag) y BookingWizard.tsx (pasos, /reservar).
export function useBookingFlow(
  { preselectedService, preselectedServiceKey, preselection, tenantSlugOverride, smartTagToken, smartTagSource }: BookingFormProps,
  { onSlotConflict }: BookingFlowOptions = {}
) {
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
  const serviceListRef = useRef<HTMLDivElement>(null);
  // Profesional elegido desde su card: limita los servicios a los suyos hasta que el
  // usuario lo suelte. pendingSlotId es el horario a marcar cuando carguen sus slots.
  const [lockedProfessionalId, setLockedProfessionalId] = useState<number | null>(null);
  const [pendingSlotId, setPendingSlotId] = useState<number | null>(null);
  const [slotsProfessionalId, setSlotsProfessionalId] = useState<number | null>(null);

  const lockedProfessional = lockedProfessionalId
    ? professionals.find((p) => p.id === lockedProfessionalId) ?? null
    : null;
  const visibleServices = lockedProfessional
    ? services.filter((s) => lockedProfessional.services?.some((ps) => ps.id === s.id))
    : services;

  const selectedServiceObj = services.find((s) => s.slug === formData.selectedService) ?? null;
  // At-home services need an address inside the tenant's coverage.
  const isAtHome = normalizeLocationType(selectedServiceObj?.locationType) === "AtHome";
  // Slots are listed for the chosen service, whatever it is: the API only offers
  // starts where the service's whole duration fits (and, at home, the travel buffer).
  const slotsServiceSlug = formData.selectedService;
  const [homeAddress, setHomeAddress] = useState<HomeAddressForm>(EMPTY_HOME_ADDRESS);
  const [coverageLocalities, setCoverageLocalities] = useState<ActiveCoverageLocality[]>([]);
  const [coverageStatus, setCoverageStatus] = useState<CoverageStatus>("idle");
  const selectedCoverageLocality = coverageLocalities.find((l) => l.id === homeAddress.coverageLocalityId) ?? null;
  const onSlotConflictRef = useRef(onSlotConflict);
  onSlotConflictRef.current = onSlotConflict;
  // Only the latest slots request may write the list (professional and
  // service changes can overlap).
  const slotsRequestRef = useRef(0);

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
  }, [preselectedService, preselectedServiceKey]);

  // La grilla de servicios tiene alto acotado con scroll (ver className más
  // abajo) para que no siga estirando la página a medida que el negocio
  // suma servicios — sin esto, un servicio preseleccionado (ej. desde el
  // botón "Presupuestar" de la landing) podría quedar fuera de la vista
  // inicial del box, sin ningún indicio visual de que ya está elegido.
  useEffect(() => {
    if (!formData.selectedService) return;
    const el = serviceListRef.current?.querySelector(
      `[data-service-slug="${formData.selectedService}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [formData.selectedService]);

  // Reset custom field values when service changes
  useEffect(() => {
    setCustomFieldValues({});
  }, [formData.selectedService]);

  // Cambiar de servicio invalida la elección de especialista (puede no ofrecer el nuevo servicio),
  // salvo que venga fijado desde su card: ahí solo se ofrecen servicios que él hace.
  useEffect(() => {
    if (lockedProfessionalId) return;
    setFormData((prev) => ({ ...prev, selectedProfessionalId: null }));
  }, [formData.selectedService]);

  // Click en "Reservar con X" / en un horario de su card (ver AboutSection)
  useEffect(() => {
    if (!preselection) return;
    setLockedProfessionalId(preselection.professionalId);
    setPendingSlotId(preselection.slotId ?? null);
    setFormData((prev) => ({ ...prev, selectedProfessionalId: preselection.professionalId }));
  }, [preselection?.key]);

  // Con profesional fijado: si el servicio actual no es suyo se limpia, y con uno solo se elige directo
  useEffect(() => {
    if (!lockedProfessional) return;
    setFormData((prev) => {
      if (visibleServices.some((s) => s.slug === prev.selectedService)) return prev;
      return { ...prev, selectedService: visibleServices.length === 1 ? visibleServices[0].slug : "" };
    });
  }, [lockedProfessional, services]);

  // Cargar turnos disponibles: de todos los profesionales, o solo del elegido ("sin preferencia" = null)
  useEffect(() => {
    setFormData((prev) => ({ ...prev, selectedSlotId: null }));
    setCurrentPage(1);
    loadAvailableSlots(formData.selectedProfessionalId, slotsServiceSlug);
  }, [formData.selectedProfessionalId, slotsServiceSlug]);

  // Coverage list, fetched once the first at-home service is chosen.
  useEffect(() => {
    if (!isAtHome || coverageStatus !== "idle") return;
    setCoverageStatus("loading");
    fetch(withTenant("/api/home-service/coverage-localities/active"))
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then((data) => {
        setCoverageLocalities(parseActiveCoverageLocalities(data));
        setCoverageStatus("ready");
      })
      .catch((error) => {
        logError(error);
        setCoverageStatus("error");
      });
  }, [isAtHome, coverageStatus, withTenant]);

  const retryCoverage = useCallback(() => setCoverageStatus("idle"), []);

  // Marca el horario elegido en la card una vez cargados los slots de ese profesional
  useEffect(() => {
    if (!pendingSlotId || slotsProfessionalId !== (formData.selectedProfessionalId ?? null)) return;
    const idx = timeSlots.findIndex((s) => s.id === pendingSlotId);
    if (idx >= 0) {
      setFormData((prev) => ({ ...prev, selectedSlotId: pendingSlotId }));
      setCurrentPage(Math.floor(idx / ITEMS_PER_PAGE) + 1);
    }
    setPendingSlotId(null);
  }, [timeSlots, slotsProfessionalId, pendingSlotId]);

  // Promociones vigentes del profesional elegido (o fijado por la ficha): el
  // precio final lo calcula el backend, acá solo se muestra.
  const [promotions, setPromotions] = useState<ActivePromotion[]>([]);
  const promotionProfessionalId = formData.selectedProfessionalId ?? lockedProfessional?.id ?? null;

  useEffect(() => {
    if (!promotionProfessionalId) {
      setPromotions([]);
      return;
    }
    let cancelled = false;
    fetch(withTenant(`/api/professionals/${promotionProfessionalId}/promotions`))
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => { if (!cancelled) setPromotions(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setPromotions([]); });
    return () => { cancelled = true; };
  }, [promotionProfessionalId, withTenant]);

  const selectedPromotion = promotions.find((p) => p.serviceSlug === formData.selectedService) ?? null;

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

  const loadAvailableSlots = async (professionalId?: number | null, serviceSlug?: string) => {
    const requestId = ++slotsRequestRef.current;
    try {
      const response = await fetch(withTenant(buildAvailableSlotsUrl({ professionalId, serviceSlug })));
      if (requestId !== slotsRequestRef.current) return;
      const data = await response.json().catch(() => null);
      if (requestId !== slotsRequestRef.current) return;
      if (response.ok && Array.isArray(data)) {
        // The label shows the real range when the service outlasts the slot.
        setTimeSlots(data.map((slot: TimeSlot) => ({ ...slot, label: slotRangeLabel(slot) })));
        setSlotsProfessionalId(professionalId ?? null);
      } else {
        setTimeSlots([]);
        showToast("error", "No pudimos cargar los horarios", data?.message || "Intentá nuevamente en unos minutos.");
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

    const homeAddressPayload = isAtHome ? buildHomeAddressPayload(homeAddress) : null;
    if (homeAddressPayload && !homeAddressPayload.ok) {
      showToast("warning", "Dirección del servicio", homeAddressPayload.message);
      return;
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
          subject: selectedServiceObj?.title ?? formData.selectedService,
          service: formData.selectedService,
          professionalId: formData.selectedProfessionalId,
          message: formData.message,
          customFieldsJson: customFieldDefs.length > 0 ? JSON.stringify(customFieldValues) : null,
          smartTagToken: smartTagToken ?? null,
          smartTagSource: smartTagSource ?? null,
          acceptedTerms: formData.acceptedTerms,
          ...(homeAddressPayload?.ok ? { homeAddress: homeAddressPayload.value } : {}),
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
          whatsapp: "",
          email:"",
          selectedSlotId: null,
          selectedService: "",
          selectedProfessionalId: null,
          message: "",
          acceptedTerms: false,
        });
        setCustomFieldValues({});
        setLockedProfessionalId(null);
        setHomeAddress(EMPTY_HOME_ADDRESS);

        // Resetear paginación y recargar turnos
        setCurrentPage(1);
        loadAvailableSlots();
      } else if (response.status === 409) {
        // The slot was taken, the service's range now overlaps another booking
        // or no longer fits the agenda, or (at home) it is too close to another
        // at-home booking. Refresh the list and let the user pick another time.
        showToast("error", "Elegí otro horario", data.message || "Ese horario ya no está disponible.");
        setFormData((prev) => ({ ...prev, selectedSlotId: null }));
        setCurrentPage(1);
        loadAvailableSlots(formData.selectedProfessionalId, slotsServiceSlug);
        onSlotConflictRef.current?.();
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

  return {
    formData,
    setFormData,
    timeSlots,
    services,
    loading,
    submitting,
    customFieldValues,
    setCustomFieldValues,
    professionals,
    loadingProfessionals,
    completedBooking,
    setCompletedBooking,
    serviceListRef,
    lockedProfessional,
    setLockedProfessionalId,
    visibleServices,
    selectedServiceObj,
    selectedPromotion,
    customFieldDefs,
    availableProfessionals,
    toast,
    showToast,
    closeToast,
    currentPage,
    setCurrentPage,
    totalPages,
    currentSlots,
    handleCalendarSubmit,
    isAtHome,
    homeAddress,
    setHomeAddress,
    coverageLocalities,
    coverageStatus,
    retryCoverage,
    selectedCoverageLocality,
  };
}
