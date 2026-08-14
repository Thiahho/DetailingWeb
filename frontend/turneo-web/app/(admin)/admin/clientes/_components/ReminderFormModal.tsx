"use client";

import { useEffect, useState } from "react";
import { CalendarDays, PenLine } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import Modal from "./Modal";
import type { Customer } from "./types";

interface Service { id: number; title: string; slug: string; }
interface TimeSlot { id: number; startDateTime: string; endDateTime: string; professionalId?: number | null; }
interface Professional {
  id: number;
  firstName: string;
  lastName: string;
  calendarColor: string;
  services?: { id: number; title: string }[];
}

function parseLocalDate(iso: string) {
  const clean = iso.replace("Z", "");
  const [date, time] = clean.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return { y, m, d, h, min, key: date };
}

function slotTime(iso: string) {
  const { h, min } = parseLocalDate(iso);
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function slotDateLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const dow = new Date(y, m - 1, d).getDay();
  return `${days[dow]} ${d} ${months[m - 1]}`;
}

function ReminderForm({
  customer,
  defaultScheduleReminder = false,
  onSave,
  onBookingCreated,
  onClose,
}: {
  customer: Customer;
  defaultScheduleReminder?: boolean;
  onSave: (data: object) => Promise<void>;
  onBookingCreated: () => void;
  onClose: () => void;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [serviceLabel, setServiceLabel] = useState("");
  // Precargado con el profesional favorito del cliente, si tiene uno cargado en su ficha — pero
  // sigue siendo editable, el admin puede cambiarlo o volver a "Sin preferencia" libremente.
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(customer.favoriteProfessionalId ?? null);
  const [detail, setDetail] = useState("");
  const [message, setMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualDate, setManualDate] = useState("");
  const [scheduleReminder, setScheduleReminder] = useState(defaultScheduleReminder);
  const [intervalDays, setIntervalDays] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/professionals").then((r) => r.json()),
    ]).then(([svcData, proData]) => {
      if (Array.isArray(svcData)) setServices(svcData);
      if (Array.isArray(proData)) setProfessionals(proData);
    }).finally(() => setLoadingData(false));
  }, []);

  const selectedServiceObj = services.find((s) => s.title === serviceLabel) ?? null;

  // Sin servicio seleccionado todavía: mostrar todos. Con servicio elegido:
  // priorizar los profesionales que lo ofrecen (mismo criterio que la reserva
  // pública), pero si ninguno tiene el servicio vinculado (falta esa carga en
  // la ficha del profesional, algo muy común) no bloquear al admin — mostrar
  // todos los activos igual, porque acá es el admin asignando el turno, no
  // un cliente autoreservando.
  const professionalsForService = selectedServiceObj
    ? professionals.filter((p) => p.services?.some((s) => s.id === selectedServiceObj.id))
    : professionals;
  const availableProfessionals = professionalsForService.length > 0 ? professionalsForService : professionals;

  function handleServiceChange(title: string) {
    setServiceLabel(title);
    setSelectedProfessionalId(null);
    setSelectedSlot(null);
    setSelectedDate("");
  }

  // Recargar los turnos disponibles cada vez que cambia el profesional elegido
  // ("sin preferencia" = null trae los de todos los profesionales que ofrecen
  // el servicio, igual que en la reserva pública).
  useEffect(() => {
    if (manualMode) return;
    // Guard contra respuestas fuera de orden: si selectedProfessionalId cambia
    // rápido (ej: precargado con el profesional favorito y luego reseteado a
    // null al elegir servicio), una respuesta vieja que llega tarde no debe
    // pisar el resultado de la petición más reciente.
    let ignore = false;
    setLoadingSlots(true);
    const query = selectedProfessionalId ? `?professionalId=${selectedProfessionalId}` : "";
    fetch(`/api/timeslots/available${query}`)
      .then((r) => r.json())
      .then((data) => {
        if (ignore) return;
        if (Array.isArray(data)) {
          const now = new Date();
          setSlots(data.filter((s: TimeSlot) => new Date(s.startDateTime.replace("Z", "")) > now));
        }
      })
      .finally(() => {
        if (!ignore) setLoadingSlots(false);
      });
    return () => {
      ignore = true;
    };
  }, [selectedProfessionalId, manualMode]);

  // GET /api/timeslots/available ya devuelve solo turnos disponibles por
  // definición — no incluye un campo isAvailable, así que no hay nada que
  // re-filtrar acá (antes filtraba por un campo inexistente y vaciaba la
  // lista siempre).
  const slotsByDate = slots
    .reduce<Record<string, TimeSlot[]>>((acc, s) => {
      const { key } = parseLocalDate(s.startDateTime);
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {});

  const sortedDates = Object.keys(slotsByDate).sort();
  const slotsForSelectedDate = selectedDate ? (slotsByDate[selectedDate] ?? []) : [];

  const resolvedDateTime: string | null = manualMode
    ? (manualDate || null)
    : selectedSlot
    ? selectedSlot.startDateTime.replace("Z", "").slice(0, 16)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceLabel.trim()) { setError("Seleccioná un servicio."); return; }
    if (manualMode && !selectedProfessionalId) { setError("Elegí a qué profesional pertenece el turno."); return; }
    if (!resolvedDateTime)    { setError("Seleccioná un turno o ingresá una fecha."); return; }
    setSaving(true);
    setError("");
    try {
      // ── Paso 1: obtener/crear timeslot ──────────────────────────
      let slotId: number;
      let slotStartIso: string;

      if (manualMode) {
        setSavingStep("Creando turno...");
        // Enviar hora local sin conversión UTC (el backend usa hora Argentina)
        const endDateTime = (() => {
          const [datePart, timePart] = resolvedDateTime.split("T");
          const [h, m] = timePart.split(":").map(Number);
          const totalMin = h * 60 + m + 120; // +2 horas
          const endH = String(Math.floor(totalMin / 60) % 24).padStart(2, "0");
          const endM = String(totalMin % 60).padStart(2, "0");
          // Si pasa medianoche, avanzar el día
          const extraDays = Math.floor(totalMin / (60 * 24));
          if (extraDays > 0) {
            const d = new Date(`${datePart}T00:00:00`);
            d.setDate(d.getDate() + extraDays);
            const newDate = d.toISOString().split("T")[0];
            return `${newDate}T${endH}:${endM}:00`;
          }
          return `${datePart}T${endH}:${endM}:00`;
        })();
        const slotRes = await fetch("/api/timeslots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDateTime: `${resolvedDateTime}:00`,
            endDateTime,
            professionalId: selectedProfessionalId,
          }),
        });
        if (!slotRes.ok) {
          const err = await slotRes.json().catch(() => ({}));
          throw new Error(err.message || "No se pudo crear el turno.");
        }
        const slotData = await slotRes.json();
        slotId       = slotData.slot.id;
        slotStartIso = resolvedDateTime;
      } else {
        slotId       = selectedSlot!.id;
        slotStartIso = selectedSlot!.startDateTime.replace("Z", "").slice(0, 16);
      }

      // ── Paso 2: crear booking (dispara notificaciones) ──────────
      setSavingStep("Reservando turno...");
      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeSlotId:     slotId,
          customerName:   customer.name,
          customerPhone:  customer.phone,
          email:          customer.email ?? "",
          subject:        detail,
          service:        serviceLabel,
          professionalId: selectedProfessionalId,
          message:        message || undefined,
          // Reserva creada por el staff a nombre del cliente — no hay checkbox
          // online que tildar, mismo criterio que ReserveSlotModal.
          acceptedTerms:  true,
        }),
      });
      if (!bookingRes.ok) {
        const err = await bookingRes.json().catch(() => ({}));
        throw new Error(err.message || "No se pudo reservar el turno.");
      }
      const bookingData = await bookingRes.json();
      const bookingId: number | undefined = bookingData.booking?.id;

      // ── Paso 3 (opcional): crear reminder (aviso 24h antes) ─────
      if (scheduleReminder) {
        setSavingStep("Programando aviso...");
        await onSave({
          customerProfileId: customer.id,
          bookingId:         bookingId ?? null,
          serviceLabel,
          scheduledFor:      `${slotStartIso}:00`,
          intervalDays:      intervalDays ? parseInt(intervalDays) : null,
          messageTemplate:   reminderMessage || null,
        });
      } else {
        onBookingCreated();
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
      setSavingStep("");
    }
  };

  if (loadingData) return <p className="text-charcoal/40 text-sm text-center py-6">Cargando...</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-red-600 text-xs bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}

      {/* Cliente (solo lectura) */}
      <div className="flex items-center gap-2 bg-porcelain/5 rounded-lg px-3 py-2">
        <span className="text-charcoal/40 text-xs">Cliente:</span>
        <span className="text-charcoal text-xs font-medium">{customer.name}</span>
        <span className="text-charcoal/30 text-xs">{customer.phone}</span>
      </div>

      {/* Servicio */}
      <div>
        <label className="block text-charcoal/50 text-xs mb-1">Servicio *</label>
        {services.length > 0 ? (
          <select data-testid="reminder-form-service" value={serviceLabel} onChange={(e) => handleServiceChange(e.target.value)} className="form-input">
            <option value="">— Seleccioná un servicio —</option>
            {services.map((s) => (
              <option key={s.id} value={s.title}>{s.title}</option>
            ))}
          </select>
        ) : (
          <input value={serviceLabel} onChange={(e) => handleServiceChange(e.target.value)} className="form-input" placeholder="Ej: Corte y color" />
        )}
      </div>

      {/* Profesional */}
      <div>
        <label className="block text-charcoal/50 text-xs mb-1">Profesional</label>
        {availableProfessionals.length === 0 ? (
          <p className="text-charcoal/30 text-xs">
            {professionals.length === 0 ? "No hay profesionales cargados todavía." : "Seleccioná un servicio para ver quién lo ofrece."}
          </p>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => { setSelectedProfessionalId(null); setSelectedSlot(null); }}
              className={`px-2.5 py-1 rounded-lg text-xs transition ${
                selectedProfessionalId === null
                  ? "bg-champagne/20 text-champagne border border-champagne/30"
                  : "bg-porcelain/5 text-charcoal/50 hover:bg-porcelain/10 hover:text-charcoal"
              }`}
            >
              Sin preferencia
            </button>
            {availableProfessionals.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setSelectedProfessionalId(p.id); setSelectedSlot(null); }}
                className={`px-2.5 py-1 rounded-lg text-xs transition ${
                  selectedProfessionalId === p.id
                    ? "bg-champagne/20 text-champagne border border-champagne/30"
                    : "bg-porcelain/5 text-charcoal/50 hover:bg-porcelain/10 hover:text-charcoal"
                }`}
              >
                {p.firstName} {p.lastName}
              </button>
            ))}
          </div>
        )}
        {manualMode && !selectedProfessionalId && (
          <p className="text-amber-700/70 text-[10px] mt-1">Para crear un turno manual hay que elegir a qué profesional pertenece.</p>
        )}
      </div>

      {/* Detalle del turno */}
      <div>
        <label className="block text-charcoal/50 text-xs mb-1">Detalle del turno *</label>
        <input data-testid="reminder-form-detail" value={detail} onChange={(e) => setDetail(e.target.value)} className="form-input" placeholder="Ej: color rubio ceniza, extensiones, uñas gel..." required />
      </div>

      {/* Notas */}
      <div>
        <label className="block text-charcoal/50 text-xs mb-1">Notas <span className="text-charcoal/25">(opcional)</span></label>
        <textarea
          data-testid="reminder-form-notes"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="form-input h-16 resize-none"
          placeholder="Notas internas del turno..."
        />
      </div>

      {/* Fecha/hora */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-charcoal/50 text-xs">Fecha y hora *</label>
          <button
            type="button"
            onClick={() => { setManualMode((v) => !v); setSelectedSlot(null); setSelectedDate(""); setManualDate(""); }}
            className="flex items-center gap-1 text-[11px] text-charcoal/30 hover:text-charcoal/60 transition"
          >
            {manualMode
              ? <><CalendarDays size={12} /> Ver turnos disponibles</>
              : <><PenLine size={12} /> Ingresar fecha manualmente</>}
          </button>
        </div>

        {manualMode ? (
          <div>
            <input type="datetime-local" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="form-input" />
            <p className="text-charcoal/25 text-[10px] mt-1">Se creará el turno automáticamente en esa fecha.</p>
          </div>
        ) : loadingSlots ? (
          <p className="text-charcoal/30 text-xs text-center py-4">Cargando turnos...</p>
        ) : sortedDates.length === 0 ? (
          <div className="rounded-lg border border-mauve/15 bg-cream px-3 py-4 text-center">
            <p className="text-charcoal/30 text-xs mb-2">No hay turnos disponibles.</p>
            <button type="button" onClick={() => setManualMode(true)} className="text-champagne/60 text-xs hover:text-champagne transition">
              Crear turno manualmente
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              {sortedDates.map((dk) => (
                <button
                  key={dk} type="button"
                  data-testid="reminder-form-date"
                  onClick={() => { setSelectedDate(dk); setSelectedSlot(null); }}
                  className={`px-2.5 py-1 rounded-lg text-xs transition ${
                    selectedDate === dk
                      ? "bg-champagne/20 text-champagne border border-champagne/30"
                      : "bg-porcelain/5 text-charcoal/50 hover:bg-porcelain/10 hover:text-charcoal"
                  }`}
                >
                  {slotDateLabel(dk)}
                  <span className="ml-1 text-charcoal/25">{slotsByDate[dk].length}</span>
                </button>
              ))}
            </div>
            {selectedDate && (
              <div className="flex gap-2 flex-wrap">
                {slotsForSelectedDate.map((s) => (
                  <button
                    key={s.id} type="button" data-testid="reminder-form-slot" onClick={() => setSelectedSlot(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition ${
                      selectedSlot?.id === s.id
                        ? "bg-champagne/25 text-champagne border border-champagne/40"
                        : "bg-porcelain/5 text-charcoal/60 hover:bg-porcelain/10 hover:text-charcoal"
                    }`}
                  >
                    {slotTime(s.startDateTime)}
                  </button>
                ))}
              </div>
            )}
            {selectedSlot && (
              <p className="text-emerald-700/70 text-[11px]">
                ✓ {slotDateLabel(parseLocalDate(selectedSlot.startDateTime).key)} · {slotTime(selectedSlot.startDateTime)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Programar aviso (opcional) */}
      <div className="pt-2 border-t border-mauve/5">
        <label className="flex items-center gap-2 text-charcoal/60 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={scheduleReminder}
            onChange={(e) => setScheduleReminder(e.target.checked)}
            data-testid="reminder-form-schedule-checkbox"
            className="accent-champagne"
          />
          También programar un aviso 24hs antes
        </label>
      </div>

      {scheduleReminder && (
        <>
          {/* Repetición del aviso */}
          <div>
            <label className="block text-charcoal/50 text-xs mb-1">Repetir aviso cada (días)</label>
            <input value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} type="number" min="1" className="form-input" placeholder="Ej: 30 — dejar vacío para no repetir" />
          </div>

          {/* Mensaje personalizado del aviso 24h */}
          <div>
            <label className="block text-charcoal/50 text-xs mb-1">Mensaje del aviso 24h <span className="text-charcoal/25">(opcional)</span></label>
            <textarea
              value={reminderMessage} onChange={(e) => setReminderMessage(e.target.value)}
              className="form-input h-16 resize-none"
              placeholder={"Vacío = mensaje por defecto.\nVariables: {nombre} {servicio} {fecha}"}
            />
          </div>
        </>
      )}

      <p className="text-charcoal/25 text-[10px]">
        Se enviará confirmación al cliente y al admin al reservar.
        {scheduleReminder && " El aviso WhatsApp se manda 24 hs antes (5 min en pruebas)."}
      </p>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving} data-testid="reminder-form-submit" variant="primary" className="flex-1">
          {saving ? savingStep || "Procesando..." : scheduleReminder ? "Reservar y programar aviso" : "Reservar turno"}
        </Button>
        <Button type="button" onClick={onClose} variant="secondary">Cancelar</Button>
      </div>
    </form>
  );
}

export default function ReminderFormModal({
  customer,
  defaultScheduleReminder,
  onSave,
  onBookingCreated,
  onClose,
}: {
  customer: Customer;
  defaultScheduleReminder?: boolean;
  onSave: (data: object) => Promise<void>;
  onBookingCreated: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={defaultScheduleReminder ? "Reservar turno y programar aviso" : "Nuevo turno"} onClose={onClose}>
      <ReminderForm
        customer={customer}
        defaultScheduleReminder={defaultScheduleReminder}
        onSave={onSave}
        onBookingCreated={onBookingCreated}
        onClose={onClose}
      />
    </Modal>
  );
}
