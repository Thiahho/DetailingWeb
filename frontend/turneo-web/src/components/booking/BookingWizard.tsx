"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import PaymentButton from "@/src/components/payments/PaymentButton";
import { ClientToast } from "./BookingForms";
import { useBookingFlow, type BookingFormProps } from "./useBookingFlow";
import { groupSlotsByDay, splitSlotLabel } from "@/src/lib/slotLabel";

const STEPS = ["Servicio", "Profesional", "Día y hora", "Tus datos"] as const;

const OPTION = "rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98]";
const OPTION_ON = "border-blush bg-blush text-ink";
const OPTION_OFF = "border-cream/20 text-cream hover:border-cream/45";
const FIELD =
  "mt-2 w-full rounded-2xl border border-cream/20 bg-ink px-4 py-3.5 text-base text-cream placeholder:text-mist/50 focus:border-blush focus:outline-none focus:ring-1 focus:ring-blush/40";
const FIELD_LABEL = "block text-xs font-semibold text-mist";

// Reserva en cuatro pasos para /reservar (sección oscura). Misma lógica que el
// formulario clásico (useBookingFlow); acá solo cambia cómo se recorre.
export default function BookingWizard(props: BookingFormProps) {
  const {
    formData,
    setFormData,
    timeSlots,
    loading,
    submitting,
    customFieldValues,
    setCustomFieldValues,
    loadingProfessionals,
    completedBooking,
    setCompletedBooking,
    serviceListRef,
    lockedProfessional,
    setLockedProfessionalId,
    visibleServices,
    selectedServiceObj,
    customFieldDefs,
    availableProfessionals,
    toast,
    closeToast,
    handleCalendarSubmit,
  } = useBookingFlow(props);

  const [step, setStep] = useState(0);
  const [pickedDay, setPickedDay] = useState<string | null>(null);

  // "Reservar" en una card de servicio: el servicio ya viene elegido.
  useEffect(() => {
    if (props.preselectedService) setStep(1);
  }, [props.preselectedService, props.preselectedServiceKey]);

  // "Reservar con X" desde Equipo: primero se elige cuál de sus servicios.
  useEffect(() => {
    if (props.preselection) setStep(0);
  }, [props.preselection?.key]);

  const days = useMemo(() => groupSlotsByDay(timeSlots), [timeSlots]);

  const selectedSlot = timeSlots.find((s) => s.id === formData.selectedSlotId) ?? null;
  // Día activo: el que tocó el usuario; si no, el del turno ya elegido (p. ej.
  // un horario tocado en la card de un profesional); si no, el primero.
  const activeDay =
    days.find((d) => d.key === pickedDay) ??
    days.find((d) => selectedSlot && d.slots.some((s) => s.id === selectedSlot.id)) ??
    days[0] ??
    null;

  const selectedProfessional =
    availableProfessionals.find((p) => p.id === formData.selectedProfessionalId) ?? lockedProfessional;

  const canContinue = [Boolean(formData.selectedService), true, Boolean(formData.selectedSlotId), true][step];

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[2rem] border border-cream/15 bg-inksoft p-8">
        <p className="text-mist">Cargando...</p>
      </div>
    );
  }

  const summary = (
    <aside
      aria-label="Resumen de tu reserva"
      className="flex flex-col gap-5 rounded-[2rem] bg-cream p-6 text-charcoal md:p-8 lg:flex-1"
    >
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-rosewood">Tu reserva</span>
      <dl className="divide-y divide-mauve/25 border-y border-mauve/25">
        {[
          ["Servicio", selectedServiceObj?.title],
          [
            "Profesional",
            selectedProfessional
              ? `${selectedProfessional.firstName} ${selectedProfessional.lastName}`
              : selectedServiceObj
                ? "Sin preferencia"
                : undefined,
          ],
          ["Día y hora", selectedSlot?.label],
          ["Precio", selectedServiceObj ? `$${selectedServiceObj.price}` : undefined],
        ].map(([term, value]) => (
          <div key={term} className="flex justify-between gap-4 py-4">
            <dt className="text-sm text-charcoal/70">{term}</dt>
            <dd className="text-right text-sm font-semibold">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm leading-relaxed text-charcoal/70">
        No hace falta pagar para reservar. Si querés, podés dejar una seña online al confirmar.
      </p>
    </aside>
  );

  if (completedBooking) {
    return (
      <>
        {toast && <ClientToast toast={toast} onClose={closeToast} />}
        <div
          data-testid="booking-confirmed"
          className="flex animate-pane flex-col items-start gap-5 rounded-[2rem] border border-cream/15 bg-inksoft p-6 md:p-10"
        >
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-blush text-ink">
            <Check size={34} strokeWidth={2.6} />
          </span>
          <h3 className="text-3xl font-semibold tracking-tight text-cream">¡Turno reservado!</h3>
          <p className="max-w-md leading-relaxed text-mist">
            Te vamos a contactar por WhatsApp para confirmar tu turno.
          </p>
          <details className="w-full max-w-md">
            <summary className="cursor-pointer list-none text-sm text-mist transition hover:text-cream">
              ¿Preferís adelantar el pago? <span className="underline">Pagar ahora (opcional)</span>
            </summary>
            <div className="mt-4 rounded-2xl bg-cream p-4 text-charcoal">
              <PaymentButton bookingId={completedBooking.id} serviceName={completedBooking.service} />
            </div>
          </details>
          <button
            type="button"
            onClick={() => {
              setCompletedBooking(null);
              setStep(0);
              setPickedDay(null);
            }}
            className="min-h-[48px] rounded-full border border-cream/30 px-6 text-sm font-semibold text-cream transition hover:border-cream/60"
          >
            Listo
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {toast && <ClientToast toast={toast} onClose={closeToast} />}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <form
          onSubmit={handleCalendarSubmit}
          className="flex min-w-0 flex-col gap-7 rounded-[2rem] border border-cream/15 bg-inksoft p-5 md:p-8 lg:flex-[1.7]"
        >
          {/* Progreso */}
          <div className="space-y-3">
            <ol className="hidden flex-wrap gap-x-6 gap-y-2 text-sm font-semibold sm:flex">
              {STEPS.map((label, i) => (
                <li
                  key={label}
                  aria-current={i === step ? "step" : undefined}
                  className={`flex items-center gap-2 transition-colors ${i <= step ? "text-cream" : "text-mist/70"}`}
                >
                  <span
                    className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-xs transition-colors ${
                      i <= step ? "bg-blush text-ink" : "bg-cream/15 text-mist"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {label}
                </li>
              ))}
            </ol>
            <div className="flex items-baseline justify-between gap-3 sm:hidden">
              <span className="text-sm font-semibold text-cream">{STEPS[step]}</span>
              <span className="text-xs text-mist">
                Paso {step + 1} de {STEPS.length}
              </span>
            </div>
            <div aria-hidden="true" className="h-[3px] overflow-hidden rounded-full bg-cream/15">
              <div
                className="h-full rounded-full bg-blush transition-[width] duration-500 ease-out"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* 1 · Servicio */}
          {step === 0 && (
            <div key="servicio" className="animate-pane space-y-5">
              <h3 className="text-2xl font-semibold tracking-tight text-cream">¿Qué te querés hacer?</h3>
              {lockedProfessional && (
                <div
                  data-testid="booking-locked-professional"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blush/50 bg-blush/10 px-4 py-3 text-sm text-cream"
                >
                  <span>
                    Reservando con{" "}
                    <strong>
                      {lockedProfessional.firstName} {lockedProfessional.lastName}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setLockedProfessionalId(null);
                      setFormData((prev) => ({ ...prev, selectedProfessionalId: null }));
                    }}
                    className="text-xs underline underline-offset-2 hover:text-blush"
                  >
                    Ver todos los servicios
                  </button>
                </div>
              )}
              {visibleServices.length === 0 ? (
                <p className="text-sm text-mist">Todavía no hay servicios cargados.</p>
              ) : (
                <div ref={serviceListRef} className="grid max-h-[26rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                  {visibleServices.map((pack) => (
                    <button
                      key={pack.slug}
                      type="button"
                      data-testid="booking-service-option"
                      data-service-slug={pack.slug}
                      aria-pressed={formData.selectedService === pack.slug}
                      onClick={() => setFormData((prev) => ({ ...prev, selectedService: pack.slug }))}
                      className={`${OPTION} min-h-[76px] ${
                        formData.selectedService === pack.slug ? OPTION_ON : OPTION_OFF
                      }`}
                    >
                      <span className="block text-[15px] font-semibold">{pack.title}</span>
                      <span className="mt-1 block text-xs opacity-80">
                        ${pack.price}
                        {pack.duration ? ` · ${pack.duration}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2 · Profesional */}
          {step === 1 && (
            <div key="profesional" className="animate-pane space-y-5">
              <h3 className="text-2xl font-semibold tracking-tight text-cream">¿Con quién te querés atender?</h3>
              {loadingProfessionals ? (
                <p className="text-sm text-mist">Buscando especialistas disponibles...</p>
              ) : availableProfessionals.length === 0 ? (
                <p className="text-sm leading-relaxed text-mist">
                  No hay especialistas asignados a este servicio todavía, se te asignará uno automáticamente.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={formData.selectedProfessionalId === null}
                    onClick={() => {
                      setLockedProfessionalId(null);
                      setFormData((prev) => ({ ...prev, selectedProfessionalId: null }));
                    }}
                    className={`${OPTION} min-h-[76px] ${
                      formData.selectedProfessionalId === null ? OPTION_ON : OPTION_OFF
                    }`}
                  >
                    <span className="block text-[15px] font-semibold">Sin preferencia</span>
                    <span className="mt-1 block text-xs opacity-80">Ves los horarios de todo el equipo</span>
                  </button>
                  {availableProfessionals.map((pro) => (
                    <button
                      key={pro.id}
                      type="button"
                      aria-pressed={formData.selectedProfessionalId === pro.id}
                      onClick={() => {
                        setLockedProfessionalId(null);
                        setFormData((prev) => ({ ...prev, selectedProfessionalId: pro.id }));
                      }}
                      className={`${OPTION} flex min-h-[76px] items-center gap-3 ${
                        formData.selectedProfessionalId === pro.id ? OPTION_ON : OPTION_OFF
                      }`}
                    >
                      {pro.photoUrl ? (
                        <img
                          src={pro.photoUrl}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: pro.calendarColor || "#9C7C88" }}
                        >
                          {pro.firstName?.[0]}
                          {pro.lastName?.[0]}
                        </span>
                      )}
                      <span>
                        <span className="block text-[15px] font-semibold">
                          {pro.firstName} {pro.lastName}
                        </span>
                        {pro.specialty && <span className="mt-0.5 block text-xs opacity-80">{pro.specialty}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3 · Día y hora */}
          {step === 2 && (
            <div key="horario" className="animate-pane space-y-5">
              <h3 className="text-2xl font-semibold tracking-tight text-cream">Elegí día y horario</h3>
              {!activeDay ? (
                <p className="text-sm leading-relaxed text-mist">
                  No hay horarios disponibles por ahora. Probá con otro profesional o escribinos por WhatsApp.
                </p>
              ) : (
                <>
                  <div className="snap-row -mx-5 gap-2.5 px-5 py-0.5 [scroll-padding-left:1.25rem] md:mx-0 md:flex-wrap md:px-0">
                    {days.map((d) => (
                      <button
                        key={d.key}
                        type="button"
                        aria-pressed={d.key === activeDay.key}
                        aria-label={d.key}
                        onClick={() => setPickedDay(d.key)}
                        className={`flex min-h-[84px] w-[68px] flex-col items-center justify-center gap-0.5 rounded-2xl border transition active:scale-[0.97] ${
                          d.key === activeDay.key ? OPTION_ON : OPTION_OFF
                        }`}
                      >
                        <span className="text-[11px] uppercase tracking-widest opacity-80">{d.dow}</span>
                        <span className="text-2xl font-semibold leading-none">{d.day}</span>
                        <span className="text-[11px] opacity-80">{d.month}</span>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    {activeDay.slots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        data-testid="booking-slot-option"
                        aria-pressed={formData.selectedSlotId === slot.id}
                        aria-label={slot.label}
                        onClick={() => setFormData((prev) => ({ ...prev, selectedSlotId: slot.id }))}
                        className={`flex min-h-[48px] flex-col items-center justify-center rounded-2xl border px-2 py-1.5 transition active:scale-[0.97] ${
                          formData.selectedSlotId === slot.id ? OPTION_ON : OPTION_OFF
                        }`}
                      >
                        <span className="text-[15px] font-semibold">{splitSlotLabel(slot.label).time || slot.label}</span>
                        {!formData.selectedProfessionalId && slot.professionalName && (
                          <span className="max-w-full truncate text-[11px] opacity-80">{slot.professionalName}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 4 · Datos */}
          {step === 3 && (
            <div key="datos" className="animate-pane space-y-5">
              <h3 className="text-2xl font-semibold tracking-tight text-cream">Tus datos</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={FIELD_LABEL}>
                  Nombre
                  <input
                    className={FIELD}
                    data-testid="booking-name-input"
                    autoComplete="name"
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Tu nombre"
                    required
                    value={formData.name}
                  />
                </label>
                <label className={FIELD_LABEL}>
                  WhatsApp
                  <input
                    className={FIELD}
                    data-testid="booking-whatsapp-input"
                    type="tel"
                    autoComplete="tel"
                    onChange={(e) => setFormData((prev) => ({ ...prev, whatsapp: e.target.value }))}
                    placeholder="+54 9 11 111 1111"
                    required
                    value={formData.whatsapp}
                  />
                </label>
                <label className={`${FIELD_LABEL} sm:col-span-2`}>
                  Email (para recibir la confirmación automática)
                  <input
                    className={FIELD}
                    data-testid="booking-email-input"
                    type="email"
                    autoComplete="email"
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="tucorreo@gmail.com"
                    value={formData.email}
                  />
                </label>

                {/* Campos propios del servicio elegido */}
                {customFieldDefs.map((field) => (
                  <label key={field.key} className={`${FIELD_LABEL} sm:col-span-2`}>
                    {field.name}
                    {field.required && <span className="ml-1 text-blush">*</span>}
                    {field.type === "select" ? (
                      <select
                        className={FIELD}
                        required={field.required}
                        value={customFieldValues[field.key] ?? ""}
                        onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      >
                        <option value="">Seleccioná una opción</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        className={`${FIELD} min-h-[80px]`}
                        required={field.required}
                        value={customFieldValues[field.key] ?? ""}
                        onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.name}
                      />
                    ) : (
                      <input
                        type={field.type === "number" ? "number" : "text"}
                        className={FIELD}
                        required={field.required}
                        value={customFieldValues[field.key] ?? ""}
                        onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.name}
                      />
                    )}
                  </label>
                ))}

                <label className={`${FIELD_LABEL} sm:col-span-2`}>
                  Consulta adicional (opcional)
                  <textarea
                    className={`${FIELD} min-h-[90px]`}
                    onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                    placeholder="¿Algo que debamos saber?"
                    value={formData.message}
                  />
                </label>
              </div>

              <label className="flex items-start gap-3 text-sm leading-relaxed text-mist">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-[#D69AA6]"
                  data-testid="booking-accept-terms"
                  checked={formData.acceptedTerms}
                  onChange={(e) => setFormData((prev) => ({ ...prev, acceptedTerms: e.target.checked }))}
                />
                <span>
                  Leí y acepto los{" "}
                  <a href="/terminos" target="_blank" rel="noopener noreferrer" className="font-medium text-blush hover:underline">
                    Términos y Condiciones
                  </a>{" "}
                  y la{" "}
                  <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-medium text-blush hover:underline">
                    Política de Privacidad
                  </a>
                </span>
              </label>
            </div>
          )}

          {/* Navegación */}
          <div className="flex items-center justify-between gap-3 border-t border-cream/15 pt-6">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="min-h-[50px] rounded-full border border-cream/30 px-6 text-[15px] font-medium text-cream transition hover:border-cream/60 disabled:opacity-35"
            >
              ← Atrás
            </button>
            {step < STEPS.length - 1 ? (
              <button
                key="continuar"
                type="button"
                data-testid="booking-next"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canContinue}
                className="group min-h-[50px] flex-1 rounded-full bg-blush px-7 text-[15px] font-semibold text-ink transition hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 sm:flex-none"
              >
                Continuar <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </button>
            ) : (
              <button
                key="confirmar"
                type="submit"
                data-testid="booking-submit"
                disabled={submitting || !formData.selectedSlotId || !formData.selectedService || !formData.acceptedTerms}
                className="min-h-[50px] flex-1 rounded-full bg-blush px-7 text-[15px] font-semibold text-ink transition hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 sm:flex-none"
              >
                {submitting ? "Agendando..." : "Confirmar reserva"}
              </button>
            )}
          </div>
        </form>

        {summary}
      </div>
    </>
  );
}
