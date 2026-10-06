"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Check, X } from "lucide-react";
import { getWhatsAppLink } from "@/src/lib/siteConfig";
import { groupSlotsByDay, splitSlotLabel } from "@/src/lib/slotLabel";
import PaymentButton from "@/src/components/payments/PaymentButton";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

interface MyBooking {
  id: number;
  status: string;
  service: string | null;
  subject: string | null;
  customFieldsJson: string | null;
  customerName: string;
  startDateTime: string;
  endDateTime: string;
  canCancel: boolean;
  canReschedule: boolean;
  paymentStatus: string | null;
  paymentAmount: number | null;
  paymentPaidAt: string | null;
  paymentCheckoutUrl: string | null;
}

interface TimeSlot {
  id: number;
  label: string;
  startDateTime: string;
}

type Tab = "next" | "past";

const TIME_ZONE = "America/Argentina/Buenos_Aires";

const STATUS_LABELS: Record<string, string> = {
  Pending: "Pendiente",
  Confirmed: "Confirmado",
  Cancelled: "Cancelado",
};

const CHIP_NEUTRAL = "bg-porcelain text-charcoal/80";
const CHIP_BY_STATUS: Record<string, string> = {
  Pending: "bg-[#F1E3C8] text-[#5C4416]",
  Confirmed: "bg-ink text-cream",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

// Partes de la fecha para el bloque de calendario de cada tarjeta.
const dateParts = (iso: string) => {
  const date = new Date(iso);
  const part = (options: Intl.DateTimeFormatOptions) =>
    date.toLocaleString("es-AR", { timeZone: TIME_ZONE, ...options }).replace(".", "");
  return {
    dow: part({ weekday: "short" }),
    day: part({ day: "numeric" }),
    month: part({ month: "short" }),
    time: part({ hour: "2-digit", minute: "2-digit", hour12: false }),
  };
};

// Días de calendario (en la zona del negocio) entre hoy y la fecha del turno.
const daysUntil = (iso: string) => {
  const ymd = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
  return Math.round((Date.parse(ymd(new Date(iso))) - Date.parse(ymd(new Date()))) / 86_400_000);
};

const countdownLabel = (iso: string) => {
  const days = daysUntil(iso);
  return days <= 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`;
};

const calendarLink = (b: MyBooking) => {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: b.service || "Turno",
    dates: `${stamp(b.startDateTime)}/${stamp(b.endDateTime || b.startDateTime)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const parseCustomFields = (json: string | null): Record<string, string> => {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
};

const BTN_DARK =
  "inline-flex min-h-[46px] items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-cream transition hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-40 disabled:hover:translate-y-0";
const BTN_OUTLINE =
  "inline-flex min-h-[46px] items-center justify-center rounded-full border border-mauve/45 px-5 text-sm font-medium text-charcoal transition hover:-translate-y-0.5 hover:border-mauve/80 active:scale-[0.98] disabled:opacity-40 disabled:hover:translate-y-0";
const OPTION_ON = "border-blush bg-blush text-ink";
const OPTION_OFF = "border-cream/20 text-cream hover:border-cream/45";

export default function MisTurnosPage() {
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<MyBooking[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [waNumber, setWaNumber] = useState("");
  const [location, setLocation] = useState("");
  const [tab, setTab] = useState<Tab>("next");
  const [notice, setNotice] = useState("");
  // Turnos cancelados en esta visita: se quedan en la pestaña donde estaban (ya
  // marcados como cancelados) en vez de desaparecer de golpe hacia "Historial".
  const [cancelledNow, setCancelledNow] = useState<number[]>([]);

  // Estado del modal de reprogramación
  const [rescheduleBooking, setRescheduleBooking] = useState<MyBooking | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  useModalHotkeys(!!rescheduleBooking, { onClose: () => !rescheduling && setRescheduleBooking(null) });
  const [rescheduleError, setRescheduleError] = useState("");
  const { confirm, ConfirmDialog } = useConfirm();

  const fetchSiteConfig = async () => {
    try {
      const d = await fetch("/api/siteconfig").then((r) => r.json());
      if (d.whatsAppNumber) setWaNumber(d.whatsAppNumber);
      if (d.location) setLocation(d.location);
    } catch { /* ignorar */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/bookings/by-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "No se pudieron cargar los turnos");
      setItems(Array.isArray(data) ? data : []);
      setTab("next");
      setNotice("");
      setCancelledNow([]);
      fetchSiteConfig();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (id: number) => {
    if (!(await confirm({ message: "¿Confirmás que querés cancelar este turno?", confirmLabel: "Cancelar turno" }))) return;
    const res = await fetch(`/api/bookings/${id}/cancel`, { method: "POST", credentials: "include" });
    if (res.ok) {
      setItems((prev) =>
        prev!.map((item) =>
          item.id === id ? { ...item, status: "Cancelled", canCancel: false, canReschedule: false } : item
        )
      );
      setCancelledNow((prev) => [...prev, id]);
      setNotice("Turno cancelado. Liberamos el horario.");
    } else {
      setNotice("No pudimos cancelar el turno. Probá de nuevo o escribinos por WhatsApp.");
    }
  };

  const openReschedule = async (booking: MyBooking) => {
    setRescheduleBooking(booking);
    setSelectedSlotId(null);
    setPickedDay(null);
    setRescheduleError("");
    setLoadingSlots(true);
    try {
      const res = await fetch("/api/timeslots/available");
      const data = await res.json();
      setAvailableSlots(Array.isArray(data) ? data : []);
    } catch {
      setRescheduleError("No se pudieron cargar los horarios disponibles");
    } finally {
      setLoadingSlots(false);
    }
  };

  const submitReschedule = async () => {
    if (!rescheduleBooking || !selectedSlotId) return;
    setRescheduling(true);
    setRescheduleError("");
    try {
      const res = await fetch(`/api/bookings/${rescheduleBooking.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTimeSlotId: selectedSlotId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "No se pudo reprogramar");

      // Actualizar la lista con la nueva fecha
      setItems((prev) =>
        prev!.map((item) =>
          item.id === rescheduleBooking.id
            ? { ...item, startDateTime: data.newStartDateTime }
            : item
        )
      );
      setRescheduleBooking(null);
      setNotice("Listo: reprogramamos tu turno.");
    } catch (err: unknown) {
      setRescheduleError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setRescheduling(false);
    }
  };

  const slotDays = useMemo(() => groupSlotsByDay(availableSlots), [availableSlots]);
  const activeDay = slotDays.find((d) => d.key === pickedDay) ?? slotDays[0] ?? null;

  // Próximos: turnos que todavía no pasaron y no están cancelados. Historial:
  // el resto, del más reciente al más viejo.
  const now = Date.now();
  const isUpcoming = (b: MyBooking) => new Date(b.startDateTime).getTime() >= now;
  const byDate = (a: MyBooking, b: MyBooking) =>
    new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime();
  const all = items ?? [];
  const upcoming = all
    .filter((b) => isUpcoming(b) && (b.status !== "Cancelled" || cancelledNow.includes(b.id)))
    .sort(byDate);
  const history = all
    .filter((b) => !isUpcoming(b) || (b.status === "Cancelled" && !cancelledNow.includes(b.id)))
    .sort((a, b) => byDate(b, a));
  const shown = tab === "next" ? upcoming : history;
  const nextBooking = upcoming.find((b) => b.status !== "Cancelled") ?? null;
  const nextParts = nextBooking ? dateParts(nextBooking.startDateTime) : null;

  return (
    <main className="min-h-screen bg-cream text-charcoal">
      {ConfirmDialog}

      {/* Ingreso por email */}
      {items === null && (
        <>
          <section className="bg-ink px-6 py-16 text-cream md:py-24">
            <div className="mx-auto flex max-w-3xl animate-rise flex-col gap-6">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-blush">Mis turnos</span>
              <h1 className="text-[2.6rem] font-semibold leading-none tracking-[-0.035em] md:text-7xl">
                Tus reservas, <span className="accent-serif text-blush">a un email de distancia.</span>
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-mist md:text-[17px]">
                Ingresá el email con el que reservaste para ver, reprogramar o cancelar tus turnos.
              </p>
              <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex flex-1 flex-col gap-2 text-xs font-semibold text-mist">
                  Email
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    data-testid="mis-turnos-email-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="min-h-[56px] rounded-full border border-cream/25 bg-inksoft px-5 text-base text-cream placeholder:text-mist/50 focus:border-blush focus:outline-none focus:ring-1 focus:ring-blush/40"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  data-testid="mis-turnos-submit"
                  className="group min-h-[56px] rounded-full bg-blush px-8 text-base font-semibold text-ink transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {loading ? "Buscando..." : (
                    <>
                      Ver mis turnos <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                    </>
                  )}
                </button>
              </form>
              {error && <p role="alert" className="text-sm text-blush">{error}</p>}
            </div>
          </section>

          <section className="mx-auto grid max-w-5xl gap-4 px-6 py-10 md:grid-cols-3 md:gap-5 md:py-16">
            {[
              ["Ver", "Fecha, hora y estado de cada reserva."],
              ["Reprogramar", "Elegí otro horario disponible sin tener que llamar."],
              ["Cancelar", "Si no podés ir, liberá el horario con un toque."],
            ].map(([title, text], i) => (
              <div
                key={title}
                className="flex animate-rise flex-col gap-2.5 rounded-[1.75rem] bg-ivory p-6 md:p-7"
                style={{ animationDelay: `${0.1 + i * 0.1}s` }}
              >
                <span className="font-serif text-3xl italic leading-none text-rosewood md:text-[2.1rem]">{title}</span>
                <p className="text-[15px] leading-relaxed text-charcoal/70">{text}</p>
              </div>
            ))}
          </section>
        </>
      )}

      {/* Lista de turnos */}
      {items !== null && (
        <>
          <section className="bg-ink px-6 pb-32 pt-10 text-cream md:pb-40 md:pt-16">
            <div className="mx-auto flex max-w-5xl animate-rise flex-wrap items-end justify-between gap-5">
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-blush">Mis turnos</span>
                <h1 className="text-[2.6rem] font-semibold leading-none tracking-[-0.035em] md:text-[4.25rem]">
                  Tus turnos, <span className="accent-serif text-blush">al día.</span>
                </h1>
              </div>
              <div className="flex w-full flex-wrap items-center justify-between gap-3 text-sm text-mist md:w-auto md:justify-end">
                <span className="min-w-0 truncate">{email}</span>
                <button
                  type="button"
                  onClick={() => { setItems(null); setError(""); setNotice(""); }}
                  className="min-h-[44px] rounded-full border border-cream/30 px-5 text-sm font-semibold text-cream transition hover:border-cream/60"
                >
                  Cambiar email
                </button>
              </div>
            </div>
          </section>

          <div className="mx-auto -mt-24 flex max-w-5xl flex-col gap-6 px-4 pb-10 md:-mt-28 md:gap-10 md:px-6 md:pb-20">
            {/* Próximo turno destacado */}
            {nextBooking && nextParts && (
              <article className="flex animate-rise flex-col gap-5 rounded-[1.75rem] bg-ivory p-5 shadow-[0_24px_60px_rgba(46,35,40,0.18)] [animation-delay:.12s] md:flex-row md:items-center md:gap-9 md:rounded-[2rem] md:p-8">
                <div className="flex items-center gap-4 md:contents">
                  <div className="flex h-[92px] w-[92px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-3xl bg-ink text-cream md:h-[132px] md:w-[132px]">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-mist md:text-xs">{nextParts.dow}</span>
                    <span className="text-4xl font-semibold leading-none tracking-tight md:text-[3.4rem]">{nextParts.day}</span>
                    <span className="text-xs text-mist md:text-[13px]">{nextParts.month}</span>
                  </div>
                  <div className="min-w-0 space-y-2 md:flex-1">
                    <span className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-rosewood md:text-xs">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-rosewood" />
                      Tu próximo turno · {countdownLabel(nextBooking.startDateTime)}
                    </span>
                    <h2 className="text-2xl font-semibold leading-tight tracking-tight md:text-4xl">
                      {nextBooking.service || "Turno"}
                    </h2>
                    <p className="text-[15px] text-charcoal/70 md:text-base">{nextParts.time} h</p>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  {location && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${BTN_DARK} group min-h-[50px] flex-1 px-6 text-[15px] md:flex-none`}
                    >
                      Cómo llegar <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
                    </a>
                  )}
                  <a
                    href={calendarLink(nextBooking)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${BTN_OUTLINE} min-h-[50px] gap-2 px-5 text-[15px] ${location ? "" : "flex-1 md:flex-none"}`}
                  >
                    <CalendarPlus size={18} strokeWidth={1.8} />
                    <span className={location ? "sr-only md:not-sr-only" : ""}>Agregar al calendario</span>
                  </a>
                </div>
              </article>
            )}

            {notice && (
              <p role="status" className="flex animate-pane items-center gap-3 rounded-2xl bg-ink px-5 py-4 text-sm text-cream md:text-[15px]">
                <Check size={18} strokeWidth={2.4} className="shrink-0 text-blush" />
                {notice}
              </p>
            )}

            {items.length === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-[1.75rem] border border-dashed border-mauve/50 bg-cream p-8 md:p-10">
                <span className="font-serif text-3xl italic text-rosewood">Nada por acá</span>
                <p className="text-[15px] text-charcoal/70">No encontramos turnos para ese email.</p>
                <a href="/reservar#contacto" className={`${BTN_DARK} group mt-2`}>
                  Reservar un turno <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
                </a>
              </div>
            ) : (
              <div className="space-y-4 md:space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex w-full gap-1 rounded-full bg-porcelain p-1 md:w-auto">
                    {([["next", "Próximos", upcoming.length], ["past", "Historial", history.length]] as const).map(
                      ([key, label, count]) => (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={tab === key}
                          onClick={() => setTab(key)}
                          className={`min-h-[44px] flex-1 rounded-full px-5 text-sm font-semibold transition-colors duration-300 md:flex-none ${
                            tab === key ? "bg-ink text-cream" : "text-charcoal/70 hover:text-charcoal"
                          }`}
                        >
                          {label} · {count}
                        </button>
                      )
                    )}
                  </div>
                  <a
                    href="/reservar#contacto"
                    className="group hidden min-h-[44px] items-center gap-2 rounded-full bg-blush px-5 text-sm font-semibold text-ink transition hover:-translate-y-0.5 md:inline-flex"
                  >
                    Reservar otro turno <span className="transition-transform group-hover:translate-x-1">→</span>
                  </a>
                </div>

                {shown.length === 0 && (
                  <div className="flex animate-pane flex-col items-start gap-2 rounded-[1.75rem] border border-dashed border-mauve/50 p-8">
                    <span className="font-serif text-3xl italic text-rosewood">Nada por acá</span>
                    <p className="text-[15px] text-charcoal/70">
                      {tab === "next" ? "No tenés turnos próximos." : "Todavía no hay turnos en tu historial."}
                    </p>
                  </div>
                )}

                {shown.map((b) => {
                  const customFields = parseCustomFields(b.customFieldsJson);
                  const cancelled = b.status === "Cancelled";
                  const past = !isUpcoming(b);
                  const active = !cancelled && !past;
                  const parts = dateParts(b.startDateTime);
                  const statusLabel = past && !cancelled ? "Realizado" : STATUS_LABELS[b.status] || b.status;
                  const chipClass = active ? CHIP_BY_STATUS[b.status] || CHIP_NEUTRAL : CHIP_NEUTRAL;
                  const waLink = waNumber
                    ? getWhatsAppLink(waNumber, `Hola, quiero reprogramar mi turno #${b.id} del ${formatDate(b.startDateTime)}`)
                    : "#";

                  return (
                    <article
                      key={b.id}
                      data-testid="mis-turnos-booking-card"
                      data-booking-subject={b.subject ?? ""}
                      className={`flex animate-pane flex-col gap-4 rounded-3xl bg-ivory p-5 shadow-soft transition duration-500 ease-out md:flex-row md:items-center md:gap-7 md:rounded-[1.75rem] md:p-6 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-elevated ${
                        cancelled ? "opacity-70" : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-4 md:flex-1 md:items-center md:gap-7">
                        <div className="flex h-[72px] w-[68px] shrink-0 flex-col items-center justify-center rounded-[1.1rem] bg-porcelain md:h-[92px] md:w-[92px] md:rounded-[1.4rem]">
                          <span className="text-[10px] uppercase tracking-[0.14em] text-charcoal/70 md:text-[11px]">{parts.dow}</span>
                          <span className="text-[1.65rem] font-semibold leading-tight tracking-tight md:text-[2.1rem]">{parts.day}</span>
                          <span className="text-[11px] text-charcoal/70 md:text-xs">{parts.month}</span>
                        </div>
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                            <h3 className={`text-lg font-semibold tracking-tight md:text-[1.3rem] ${cancelled ? "line-through" : ""}`}>
                              {b.service || "Turno"}
                            </h3>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${chipClass}`}>{statusLabel}</span>
                          </div>
                          {b.subject && <p className="text-sm text-charcoal/70">{b.subject}</p>}
                          <p className="text-[15px] text-charcoal/70">
                            {parts.time} h · {b.customerName}
                          </p>

                          {Object.keys(customFields).length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(customFields).map(([k, v]) => (
                                <span key={k} className="rounded-full border border-mauve/20 px-3 py-1 text-xs text-charcoal/70">
                                  {k}: {v}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Estado del pago */}
                          {b.paymentStatus === "Approved" && (
                            <p className="flex items-center gap-2 text-sm font-medium text-charcoal">
                              <Check size={16} strokeWidth={2.4} className="text-rosewood" />
                              Pagado{b.paymentAmount ? ` — $${b.paymentAmount.toLocaleString("es-AR")}` : ""}
                            </p>
                          )}

                          {b.paymentStatus === "Pending" && !cancelled && b.paymentCheckoutUrl && (
                            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-charcoal/70">
                              Pago pendiente
                              <a
                                href={b.paymentCheckoutUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-rosewood underline-offset-4 hover:underline"
                              >
                                Completar pago →
                              </a>
                            </p>
                          )}

                          {!b.paymentStatus && !cancelled && (
                            <details className="text-sm">
                              <summary className="cursor-pointer list-none font-semibold text-rosewood underline-offset-4 hover:underline">
                                Dejar una seña (opcional) →
                              </summary>
                              <div className="mt-3">
                                <PaymentButton bookingId={b.id} serviceName={b.service || "Servicio"} />
                              </div>
                            </details>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 md:shrink-0 md:justify-end">
                        {/* Reprogramar: Pending → modal horarios | Confirmed → WhatsApp */}
                        {b.canReschedule && b.status === "Pending" && (
                          <button
                            type="button"
                            onClick={() => openReschedule(b)}
                            data-testid="mis-turnos-reschedule-button"
                            className={`${BTN_DARK} flex-[1.4] md:flex-none`}
                          >
                            Reprogramar
                          </button>
                        )}
                        {b.canReschedule && b.status === "Confirmed" && (
                          <a href={waLink} target="_blank" rel="noopener noreferrer" className={`${BTN_DARK} flex-[1.4] text-center md:flex-none`}>
                            Reprogramar por WhatsApp
                          </a>
                        )}
                        {!past && (
                          <button
                            type="button"
                            onClick={() => cancelBooking(b.id)}
                            disabled={!b.canCancel}
                            data-testid="mis-turnos-cancel-button"
                            className={`${BTN_OUTLINE} flex-1 md:flex-none`}
                          >
                            Cancelar
                          </button>
                        )}
                        {!active && (
                          <a href="/reservar#contacto" className={`${BTN_OUTLINE} group flex-1 font-semibold md:flex-none`}>
                            Volver a reservar <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mobile: el CTA queda a mano mientras se recorre la lista */}
          <div
            className="sticky z-30 border-t border-mauve/25 bg-cream/95 px-4 py-3 backdrop-blur md:hidden"
            style={{ bottom: "var(--consent-bar-h, 0px)" }}
          >
            <a
              href="/reservar#contacto"
              className="flex min-h-[52px] items-center justify-center rounded-full bg-blush text-base font-semibold text-ink active:scale-[0.98]"
            >
              Reservar otro turno →
            </a>
          </div>
        </>
      )}

      {/* Reprogramación (solo Pending): hoja desde abajo en mobile, modal en escritorio */}
      {rescheduleBooking && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/75 backdrop-blur-sm md:items-center md:p-4"
          onClick={() => !rescheduling && setRescheduleBooking(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Elegir nuevo horario"
            className="flex max-h-[92vh] w-full max-w-xl animate-rise flex-col gap-5 overflow-y-auto rounded-t-[1.75rem] bg-ink p-5 pb-6 text-cream [animation-duration:.4s] md:rounded-[1.75rem] md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <h2 className="text-[1.65rem] font-semibold leading-tight tracking-tight md:text-[1.75rem]">
                  Elegí el <span className="accent-serif text-blush">nuevo horario</span>
                </h2>
                <p className="text-sm text-mist">
                  Turno actual: <span className="text-cream">{formatDate(rescheduleBooking.startDateTime)}</span>
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setRescheduleBooking(null)}
                disabled={rescheduling}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cream/30 text-cream transition hover:border-cream/60"
              >
                <X size={16} strokeWidth={2.2} />
              </button>
            </div>

            {loadingSlots && <p className="py-8 text-center text-sm text-mist">Cargando horarios...</p>}

            {!loadingSlots && !activeDay && (
              <p className="py-8 text-center text-sm text-mist">No hay horarios disponibles por ahora.</p>
            )}

            {!loadingSlots && activeDay && (
              <>
                <div className="snap-row -mx-5 gap-2 px-5 py-0.5 [scroll-padding-left:1.25rem] md:mx-0 md:flex-wrap md:px-0">
                  {slotDays.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      aria-pressed={d.key === activeDay.key}
                      aria-label={d.key}
                      onClick={() => setPickedDay(d.key)}
                      className={`flex min-h-[78px] w-[62px] flex-col items-center justify-center gap-0.5 rounded-2xl border transition active:scale-[0.97] ${
                        d.key === activeDay.key ? OPTION_ON : OPTION_OFF
                      }`}
                    >
                      <span className="text-[11px] uppercase tracking-widest opacity-80">{d.dow}</span>
                      <span className="text-[1.4rem] font-semibold leading-none">{d.day}</span>
                      <span className="text-[11px] opacity-80">{d.month}</span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {activeDay.slots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      data-testid="mis-turnos-reschedule-slot"
                      aria-pressed={selectedSlotId === slot.id}
                      aria-label={slot.label}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`min-h-[48px] rounded-full border text-[15px] font-semibold transition active:scale-[0.97] ${
                        selectedSlotId === slot.id ? OPTION_ON : OPTION_OFF
                      }`}
                    >
                      {splitSlotLabel(slot.label).time || slot.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {rescheduleError && <p role="alert" className="text-sm text-blush">{rescheduleError}</p>}

            <button
              type="button"
              onClick={submitReschedule}
              disabled={!selectedSlotId || rescheduling}
              data-testid="mis-turnos-reschedule-confirm"
              className="min-h-[52px] rounded-full bg-blush text-base font-semibold text-ink transition hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
            >
              {rescheduling ? "Guardando..." : "Confirmar nuevo horario →"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
