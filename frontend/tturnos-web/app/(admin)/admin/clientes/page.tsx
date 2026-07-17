"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { Plus, ChevronLeft, Bell, BellOff, Pencil, Trash2, X, Check, Clock, RefreshCw, CalendarDays, PenLine, Cake, Instagram as InstagramIcon, Star, History } from "lucide-react";
import CloudinaryUpload from "@/src/components/forms/CloudinaryUpload";
import { Button } from "@/src/components/shared/Button";

// ── Types ─────────────────────────────────────────────────────────

interface Customer {
  id: number;
  phone: string;
  name: string;
  email?: string;
  notes?: string;
  birthday?: string | null;
  instagram?: string | null;
  favoriteProfessionalId?: number | null;
  favoriteProfessionalName?: string | null;
  photoUrls?: string | null;
  createdAt: string;
}

interface ProfessionalOption {
  id: number;
  firstName: string;
  lastName: string;
}

interface BookingHistoryItem {
  id: number;
  status: string;
  service?: string | null;
  subject: string;
  professionalId?: number | null;
  professionalName?: string | null;
  startDateTime: string;
  endDateTime: string;
}

function parsePhotoUrls(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function formatBirthday(iso?: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${parseInt(d)} ${months[parseInt(m) - 1]}${y ? ` ${y}` : ""}`;
}

interface Reminder {
  id: number;
  customerProfileId: number;
  customerName: string;
  customerPhone: string;
  serviceLabel: string;
  scheduledFor: string;
  status: string;
  intervalDays?: number;
  nextReminderDate?: string;
  createdAt: string;
  sentAt?: string;
}

// ── Helpers ───────────────────────────────────────────────────────

function formatDate(iso: string) {
  const clean = iso.replace("Z", "");
  const [datePart, timePart] = clean.split("T");
  const [y, m, d] = datePart.split("-");
  const [h, min] = (timePart ?? "00:00").split(":");
  return `${d}/${m}/${y} ${h}:${min}`;
}

function toLocalInputValue(iso: string) {
  // convierte "2026-03-30T18:00:00" → "2026-03-30T18:00" para <input type="datetime-local">
  return iso.replace("Z", "").slice(0, 16);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending:   "bg-amber-500/20 text-amber-700",
    Sent:      "bg-emerald-500/20 text-emerald-700",
    Failed:    "bg-red-500/20 text-red-600",
    Cancelled: "bg-porcelain/10 text-charcoal/30",
  };
  const labels: Record<string, string> = {
    Pending: "Pendiente", Sent: "Enviado", Failed: "Fallido", Cancelled: "Cancelado",
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-porcelain/5 text-charcoal/40"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function BookingStatusBadge({ status }: { status: string }) {
  if (status === "Confirmed")
    return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/20 text-emerald-700">Confirmado</span>;
  if (status === "Cancelled")
    return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-500/20 text-red-600">Cancelado</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-500/20 text-amber-700">Pendiente</span>;
}

// ── Modal base ────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-porcelain border border-mauve/10 rounded-xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-mauve/15 shrink-0">
          <span className="text-charcoal font-semibold text-sm">{title}</span>
          <button onClick={onClose} className="text-charcoal/40 hover:text-charcoal transition"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ── Customer form ─────────────────────────────────────────────────

interface CustomerFormData {
  phone: string;
  name: string;
  email?: string;
  notes?: string;
  birthday?: string;
  instagram?: string;
  favoriteProfessionalId?: number;
  photoUrls?: string;
}

function CustomerForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<Customer>;
  onSave: (data: CustomerFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    phone: initial?.phone ?? "",
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    notes: initial?.notes ?? "",
    birthday: initial?.birthday ?? "",
    instagram: initial?.instagram ?? "",
    favoriteProfessionalId: initial?.favoriteProfessionalId ?? null as number | null,
  });
  const [photos, setPhotos] = useState<string[]>(parsePhotoUrls(initial?.photoUrls));
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/professionals").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setProfessionals(data);
    });
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const addPhoto = (url: string) => { if (url) setPhotos((p) => [...p, url]); };
  const removePhoto = (idx: number) => setPhotos((p) => p.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.phone.trim() || !form.name.trim()) { setError("Nombre y teléfono son obligatorios."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({
        phone: form.phone,
        name: form.name,
        email: form.email || undefined,
        notes: form.notes || undefined,
        birthday: form.birthday || undefined,
        instagram: form.instagram || undefined,
        favoriteProfessionalId: form.favoriteProfessionalId ?? undefined,
        photoUrls: photos.length > 0 ? JSON.stringify(photos) : undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div>
        <label className="block text-charcoal/50 text-xs mb-1">Nombre *</label>
        <input data-testid="customer-form-name" value={form.name} onChange={set("name")} className="form-input" placeholder="Juan Pérez" />
      </div>
      <div>
        <label className="block text-charcoal/50 text-xs mb-1">Teléfono *</label>
        <input data-testid="customer-form-phone" value={form.phone} onChange={set("phone")} className="form-input" placeholder="5491112345678" />
      </div>
      <div>
        <label className="block text-charcoal/50 text-xs mb-1">Email</label>
        <input value={form.email} onChange={set("email")} className="form-input" placeholder="juan@email.com" type="email" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-charcoal/50 text-xs mb-1">Cumpleaños</label>
          <input data-testid="customer-form-birthday" value={form.birthday} onChange={set("birthday")} className="form-input" type="date" />
        </div>
        <div>
          <label className="block text-charcoal/50 text-xs mb-1">Instagram</label>
          <input data-testid="customer-form-instagram" value={form.instagram} onChange={set("instagram")} className="form-input" placeholder="@usuario" />
        </div>
      </div>
      <div>
        <label className="block text-charcoal/50 text-xs mb-1">Profesional favorito</label>
        <select
          data-testid="customer-form-favorite-professional"
          value={form.favoriteProfessionalId ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, favoriteProfessionalId: e.target.value ? parseInt(e.target.value) : null }))}
          className="form-input"
        >
          <option value="">— Sin preferencia —</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-charcoal/50 text-xs mb-1">Notas</label>
        <textarea data-testid="customer-form-notes" value={form.notes} onChange={set("notes")} className="form-input h-16 resize-none" placeholder="Alergias, preferencias, tratamientos anteriores, etc." />
      </div>
      <div>
        <label className="block text-charcoal/50 text-xs mb-1">Fotos</label>
        {photos.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-2" data-testid="customer-form-photos">
            {photos.map((url, i) => (
              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-mauve/15">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  data-testid="customer-form-photo-remove"
                  className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-lg p-0.5"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <CloudinaryUpload value="" onChange={addPhoto} folder="tturnos/clientes" hint="Antes/después, tratamientos, etc." />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={saving} data-testid="customer-form-submit" variant="primary" className="flex-1">
          {saving ? "Guardando..." : "Guardar"}
        </Button>
        <Button type="button" onClick={onClose} variant="secondary">Cancelar</Button>
      </div>
    </form>
  );
}

// ── Types for ReminderForm ────────────────────────────────────────

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

// ── Reminder form ─────────────────────────────────────────────────

function ReminderForm({
  customer,
  onSave,
  onClose,
}: {
  customer: Customer;
  onSave: (data: object) => Promise<void>;
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
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualDate, setManualDate] = useState("");
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
        }),
      });
      if (!bookingRes.ok) {
        const err = await bookingRes.json().catch(() => ({}));
        throw new Error(err.message || "No se pudo reservar el turno.");
      }
      const bookingData = await bookingRes.json();
      const bookingId: number | undefined = bookingData.booking?.id;

      // ── Paso 3: crear reminder (aviso 24h antes) ────────────────
      setSavingStep("Programando aviso...");
      await onSave({
        customerProfileId: customer.id,
        bookingId:         bookingId ?? null,
        serviceLabel,
        scheduledFor:      `${slotStartIso}:00`,
        intervalDays:      intervalDays ? parseInt(intervalDays) : null,
        messageTemplate:   reminderMessage || null,
      });
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

      <p className="text-charcoal/25 text-[10px]">Se enviará confirmación al cliente y al admin al reservar. El aviso WhatsApp se manda 24 hs antes (5 min en pruebas).</p>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving} data-testid="reminder-form-submit" variant="primary" className="flex-1">
          {saving ? savingStep || "Procesando..." : "Reservar y programar aviso"}
        </Button>
        <Button type="button" onClick={onClose} variant="secondary">Cancelar</Button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────

export default function ClientesPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // detail view
  const [selected, setSelected] = useState<Customer | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [history, setHistory] = useState<BookingHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // modals
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showReminderForm, setShowReminderForm] = useState(false);

  // ── auth ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdminAuthenticated()) { router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login"); return; }
    loadCustomers();
  }, []);

  // ── data fetching ──────────────────────────────────────────────
  async function loadCustomers() {
    setLoading(true);
    try {
      const res = await fetch("/api/reminders/customers");
      const data = await res.json();
      if (Array.isArray(data)) setCustomers(data);
    } finally {
      setLoading(false);
    }
  }

  async function loadReminders(customerId: number) {
    setLoadingReminders(true);
    try {
      const res = await fetch("/api/reminders");
      const data: Reminder[] = await res.json();
      if (Array.isArray(data)) {
        setReminders(data.filter((r) => r.customerProfileId === customerId));
      }
    } finally {
      setLoadingReminders(false);
    }
  }

  async function loadHistory(customerId: number) {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/reminders/customers/${customerId}/history`);
      const data = await res.json();
      if (Array.isArray(data)) setHistory(data);
    } finally {
      setLoadingHistory(false);
    }
  }

  function selectCustomer(c: Customer) {
    setSelected(c);
    loadReminders(c.id);
    loadHistory(c.id);
  }

  // ── customer CRUD ──────────────────────────────────────────────
  async function saveCustomer(data: CustomerFormData) {
    if (editingCustomer) {
      const res = await fetch(`/api/reminders/customers/${editingCustomer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al actualizar.");
      }
      const updated = await res.json();
      setCustomers((prev) => prev.map((c) => (c.id === editingCustomer.id ? updated : c)));
      if (selected?.id === editingCustomer.id) setSelected(updated);
    } else {
      const res = await fetch("/api/reminders/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al crear.");
      }
      const created = await res.json();
      setCustomers((prev) => [created, ...prev]);
    }
    setEditingCustomer(null);
  }

  async function deleteCustomer(c: Customer) {
    if (!confirm(`¿Eliminar a ${c.name}? Se borrarán también sus recordatorios.`)) return;
    const res = await fetch(`/api/reminders/customers/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
      if (selected?.id === c.id) setSelected(null);
    }
  }

  // ── reminder CRUD ──────────────────────────────────────────────
  async function saveReminder(data: object) {
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Error al crear recordatorio.");
    }
    const created = await res.json();
    setReminders((prev) => [...prev, created]);
    // El aviso reserva un turno real de paso — refrescar el historial para que
    // se refleje sin depender de que el admin recargue la página a mano.
    if (selected) loadHistory(selected.id);
  }

  async function cancelReminder(r: Reminder) {
    if (!confirm("¿Cancelar este recordatorio?")) return;
    const res = await fetch(`/api/reminders/${r.id}/cancel`, { method: "POST" });
    if (res.ok) {
      setReminders((prev) => prev.map((x) => x.id === r.id ? { ...x, status: "Cancelled" } : x));
    }
  }

  // ── filtered list ──────────────────────────────────────────────
  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // ── render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream text-charcoal">
      {/* ── modals ── */}
      {(showCustomerForm || editingCustomer) && (
        <Modal
          title={editingCustomer ? "Editar cliente" : "Nuevo cliente"}
          onClose={() => { setShowCustomerForm(false); setEditingCustomer(null); }}
        >
          <CustomerForm
            initial={editingCustomer ?? undefined}
            onSave={saveCustomer}
            onClose={() => { setShowCustomerForm(false); setEditingCustomer(null); }}
          />
        </Modal>
      )}

      {showReminderForm && selected && (
        <Modal title="Reservar turno y programar aviso" onClose={() => setShowReminderForm(false)}>
          <ReminderForm
            customer={selected}
            onSave={saveReminder}
            onClose={() => setShowReminderForm(false)}
          />
        </Modal>
      )}

      {/* ── header ── */}
      <div className="md:pl-56">
        <div className="px-4 pt-20 pb-4 md:pt-8">

          {/* ── detail view ── */}
          {selected ? (
            <div>
              {/* back + header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setSelected(null)}
                    className="mt-0.5 text-charcoal/40 hover:text-charcoal transition"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div>
                    <h1 className="text-charcoal font-semibold text-lg leading-tight">{selected.name}</h1>
                    <p className="text-charcoal/40 text-sm">{selected.phone}{selected.email ? ` · ${selected.email}` : ""}</p>
                    {selected.notes && <p className="text-charcoal/30 text-xs mt-1">{selected.notes}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingCustomer(selected)}
                    data-testid="customer-edit-button"
                    className="p-2 text-charcoal/40 hover:text-charcoal hover:bg-porcelain/5 rounded-lg transition"
                    title="Editar cliente"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => deleteCustomer(selected)}
                    data-testid="customer-delete-button"
                    className="p-2 text-charcoal/40 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition"
                    title="Eliminar cliente"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* ficha extendida: cumpleaños, instagram, profesional favorito, fotos */}
              {(selected.birthday || selected.instagram || selected.favoriteProfessionalName || parsePhotoUrls(selected.photoUrls).length > 0) && (
                <div data-testid="customer-crm-details" className="mb-6 space-y-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {selected.birthday && (
                      <span className="flex items-center gap-1.5 text-charcoal/50 text-xs">
                        <Cake size={13} /> {formatBirthday(selected.birthday)}
                      </span>
                    )}
                    {selected.instagram && (
                      <a
                        href={`https://instagram.com/${selected.instagram.replace(/^@/, "")}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-charcoal/50 hover:text-charcoal text-xs transition"
                      >
                        <InstagramIcon size={13} /> {selected.instagram}
                      </a>
                    )}
                    {selected.favoriteProfessionalName && (
                      <span className="flex items-center gap-1.5 text-charcoal/50 text-xs">
                        <Star size={13} /> {selected.favoriteProfessionalName}
                      </span>
                    )}
                  </div>
                  {parsePhotoUrls(selected.photoUrls).length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {parsePhotoUrls(selected.photoUrls).map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded-lg overflow-hidden border border-mauve/15 block">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* reminders section */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-charcoal/70 text-sm font-medium">Avisos programados</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadReminders(selected.id)}
                    className="p-1.5 text-charcoal/30 hover:text-charcoal transition"
                    title="Actualizar"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    onClick={() => setShowReminderForm(true)}
                    data-testid="reminder-create-button"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-champagne/20 text-champagne text-xs font-medium rounded-lg hover:bg-champagne/30 transition"
                  >
                    <Plus size={13} />
                    Nuevo aviso
                  </button>
                </div>
              </div>

              {loadingReminders ? (
                <p className="text-charcoal/30 text-sm py-8 text-center">Cargando...</p>
              ) : reminders.length === 0 ? (
                <div className="text-center py-12 border border-mauve/15 rounded-xl">
                  <Bell size={24} className="mx-auto text-charcoal/10 mb-3" />
                  <p className="text-charcoal/30 text-sm">Sin avisos programados</p>
                  <button
                    onClick={() => setShowReminderForm(true)}
                    className="mt-3 text-champagne/70 text-xs hover:text-champagne transition"
                  >
                    Programar el primero
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {reminders
                    .slice()
                    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
                    .map((r) => (
                      <div
                        key={r.id}
                        data-testid="reminder-list-item"
                        data-reminder-service={r.serviceLabel}
                        className="flex items-center justify-between bg-porcelain border border-mauve/15 rounded-xl px-4 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0">
                            {r.status === "Sent" ? (
                              <Check size={16} className="text-emerald-700" />
                            ) : r.status === "Cancelled" ? (
                              <BellOff size={16} className="text-charcoal/20" />
                            ) : r.status === "Failed" ? (
                              <X size={16} className="text-red-600" />
                            ) : (
                              <Clock size={16} className="text-amber-700" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-charcoal text-sm font-medium truncate">{r.serviceLabel}</p>
                            <p className="text-charcoal/40 text-xs">{formatDate(r.scheduledFor)}</p>
                            {r.intervalDays && (
                              <p className="text-charcoal/25 text-[10px]">Repite cada {r.intervalDays} días</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <StatusBadge status={r.status} />
                          {r.status === "Pending" && (
                            <button
                              onClick={() => cancelReminder(r)}
                              data-testid="reminder-cancel-button"
                              className="p-1.5 text-charcoal/20 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition"
                              title="Cancelar aviso"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* history section */}
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-3">
                  <History size={15} className="text-charcoal/40" />
                  <h2 className="text-charcoal/70 text-sm font-medium">Historial de turnos</h2>
                </div>
                {loadingHistory ? (
                  <p className="text-charcoal/30 text-sm py-6 text-center">Cargando...</p>
                ) : history.length === 0 ? (
                  <p className="text-charcoal/30 text-sm py-6 text-center border border-mauve/15 rounded-xl">Sin turnos registrados todavía.</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((h) => (
                      <div
                        key={h.id}
                        data-testid="customer-history-item"
                        className="flex items-center justify-between bg-porcelain border border-mauve/15 rounded-xl px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-charcoal text-sm font-medium truncate">{h.service || h.subject}</p>
                          <p className="text-charcoal/40 text-xs">
                            {formatDate(h.startDateTime)}{h.professionalName ? ` · ${h.professionalName}` : ""}
                          </p>
                        </div>
                        <BookingStatusBadge status={h.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── list view ── */
            <div>
              <div className="flex items-center justify-between mb-5">
                <h1 className="text-charcoal font-semibold text-lg">Clientes</h1>
                <button
                  onClick={() => { setEditingCustomer(null); setShowCustomerForm(true); }}
                  data-testid="customer-create-button"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-champagne/20 text-champagne text-xs font-medium rounded-lg hover:bg-champagne/30 transition"
                >
                  <Plus size={13} />
                  Nuevo cliente
                </button>
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, teléfono o email..."
                data-testid="customer-search"
                className="form-input mb-4"
              />

              {loading ? (
                <p className="text-charcoal/30 text-sm py-8 text-center">Cargando...</p>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 border border-mauve/15 rounded-xl">
                  <p className="text-charcoal/30 text-sm">
                    {search ? "Sin resultados." : "No hay clientes aún."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectCustomer(c)}
                      data-testid="customer-list-item"
                      data-customer-name={c.name}
                      className="w-full text-left flex items-center justify-between bg-porcelain border border-mauve/15 hover:border-mauve/30 rounded-xl px-4 py-3 transition group"
                    >
                      <div className="min-w-0">
                        <p className="text-charcoal text-sm font-medium">{c.name}</p>
                        <p className="text-charcoal/40 text-xs">{c.phone}{c.email ? ` · ${c.email}` : ""}</p>
                        {c.notes && <p className="text-charcoal/25 text-xs truncate max-w-xs">{c.notes}</p>}
                      </div>
                      <ChevronLeft size={16} className="text-charcoal/20 group-hover:text-charcoal/50 rotate-180 transition" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
