"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/src/components/shared/Button";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function parseLocalDate(iso: string) {
  const clean = iso.replace("Z", "");
  const [date, time] = clean.split("T");
  const [, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return { m, d, h, min };
}

interface ReserveSlot {
  id: number;
  startDateTime: string;
  professionalId?: number | null;
  professionalName?: string | null;
}

interface Service {
  id: number;
  title: string;
  slug: string;
}

interface Professional {
  id: number;
  firstName: string;
  lastName: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
}

interface ReserveSlotModalProps {
  slot: ReserveSlot;
  onClose: () => void;
  onReserved: () => void;
}

export default function ReserveSlotModal({ slot, onClose, onReserved }: ReserveSlotModalProps) {
  const [loadingData, setLoadingData] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [service, setService] = useState("");
  const [subject, setSubject] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [message, setMessage] = useState("");

  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useModalHotkeys(true, { onClose, onSubmit: () => formRef.current?.requestSubmit() });

  useEffect(() => {
    Promise.all([
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/professionals").then((r) => r.json()),
      fetch("/api/reminders/customers").then((r) => r.json()),
    ])
      .then(([svcData, proData, custData]) => {
        if (Array.isArray(svcData)) setServices(svcData);
        if (Array.isArray(proData)) setProfessionals(proData);
        if (Array.isArray(custData)) setCustomers(custData);
      })
      .finally(() => setLoadingData(false));
  }, []);

  const filteredCustomers = customerSearch.trim()
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
          c.phone.includes(customerSearch) ||
          (c.email ?? "").toLowerCase().includes(customerSearch.toLowerCase())
      )
    : customers;

  const { d, m, h, min } = parseLocalDate(slot.startDateTime);
  const timeLabel = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")} · ${d} de ${MONTH_NAMES[m - 1]}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "existing" && !selectedCustomer) {
      setError("Elegí un cliente registrado o pasá a \"Cliente nuevo\".");
      return;
    }
    if (mode === "new" && (!newName.trim() || newPhone.trim().length < 6)) {
      setError("Completá nombre y teléfono (mínimo 6 dígitos) del cliente nuevo.");
      return;
    }
    if (!service) {
      setError("Seleccioná un servicio.");
      return;
    }
    if (!subject.trim()) {
      setError("Completá el detalle del turno.");
      return;
    }

    setReserving(true);
    try {
      const customerName = mode === "existing" ? selectedCustomer!.name : newName.trim();
      const customerPhone = mode === "existing" ? selectedCustomer!.phone : newPhone.trim();
      const email = mode === "existing" ? (selectedCustomer!.email ?? "") : newEmail.trim();

      if (mode === "new") {
        const custRes = await fetch("/api/reminders/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: customerPhone, name: customerName, email: email || undefined }),
        });
        if (!custRes.ok) {
          const err = await custRes.json().catch(() => ({}));
          throw new Error(err.error || err.message || "No se pudo registrar el cliente.");
        }
      }

      const bookingRes = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeSlotId: slot.id,
          customerName,
          customerPhone,
          email,
          service,
          subject: subject.trim(),
          professionalId: slot.professionalId ?? (professionalId ? Number(professionalId) : null),
          message: message || undefined,
          // Reserva creada por el staff a nombre del cliente (turno telefónico/presencial) —
          // no hay checkbox online que tildar, el negocio ya tiene el vínculo comercial.
          acceptedTerms: true,
        }),
      });
      const data = await bookingRes.json().catch(() => ({}));
      if (!bookingRes.ok) throw new Error(data.message || "No se pudo crear la reserva.");

      onReserved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setReserving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        data-testid="calendario-reserve-modal"
        className="bg-ivory border border-mauve/10 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-mauve/5">
          <div>
            <h2 className="text-charcoal font-semibold text-lg">Nueva reserva</h2>
            <p className="text-charcoal/40 text-xs mt-0.5">{timeLabel}</p>
          </div>
          <button onClick={onClose} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
        </div>

        {loadingData ? (
          <p className="text-charcoal/40 text-sm text-center py-8">Cargando...</p>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="flex gap-1 bg-porcelain/10 rounded-lg p-1">
              <button
                type="button"
                data-testid="reserve-mode-existing"
                onClick={() => setMode("existing")}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  mode === "existing" ? "bg-blush text-white shadow-glow" : "text-charcoal/60 hover:text-charcoal"
                }`}
              >
                Cliente registrado
              </button>
              <button
                type="button"
                data-testid="reserve-mode-new"
                onClick={() => setMode("new")}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  mode === "new" ? "bg-blush text-white shadow-glow" : "text-charcoal/60 hover:text-charcoal"
                }`}
              >
                Cliente nuevo
              </button>
            </div>

            {mode === "existing" ? (
              selectedCustomer ? (
                <div className="flex items-center justify-between bg-porcelain/10 border border-mauve/10 rounded-lg p-3">
                  <div>
                    <p className="text-charcoal text-sm font-medium">{selectedCustomer.name}</p>
                    <p className="text-charcoal/40 text-xs mt-0.5">
                      {selectedCustomer.phone}
                      {selectedCustomer.email && ` · ${selectedCustomer.email}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="text-xs text-blushdark hover:text-blush font-medium transition shrink-0"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <div>
                  <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Buscar cliente</label>
                  <input
                    data-testid="reserve-customer-search"
                    className="form-input mt-1.5"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Nombre, teléfono o email..."
                  />
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-mauve/10 divide-y divide-mauve/5">
                    {filteredCustomers.length === 0 ? (
                      <p className="text-charcoal/30 text-xs p-3">Sin resultados.</p>
                    ) : (
                      filteredCustomers.slice(0, 20).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          data-testid="reserve-customer-option"
                          onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }}
                          className="w-full text-left px-3 py-2 hover:bg-porcelain/10 transition"
                        >
                          <p className="text-charcoal text-sm">{c.name}</p>
                          <p className="text-charcoal/40 text-xs">{c.phone}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )
            ) : (
              <>
                <div>
                  <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Nombre del cliente</label>
                  <input
                    data-testid="calendario-reserve-name"
                    className="form-input mt-1.5"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Juan García"
                    required
                  />
                </div>
                <div>
                  <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Teléfono / WhatsApp</label>
                  <input
                    data-testid="calendario-reserve-phone"
                    className="form-input mt-1.5"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="1123456789"
                    required
                  />
                </div>
                <div>
                  <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Email (opcional)</label>
                  <input
                    type="email"
                    className="form-input mt-1.5"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="juan@email.com"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Servicio</label>
              <select
                data-testid="calendario-reserve-service"
                className="form-input mt-1.5"
                value={service}
                onChange={(e) => setService(e.target.value)}
                required
              >
                <option value="">Seleccioná un servicio</option>
                {services.map((s) => (
                  <option key={s.id} value={s.slug}>{s.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Detalle del turno *</label>
              <input
                data-testid="calendario-reserve-subject"
                className="form-input mt-1.5"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ej: lavado completo, corte y color..."
                required
              />
            </div>
            <div>
              <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Especialista</label>
              {slot.professionalId ? (
                <p className="w-full mt-1.5 bg-porcelain/10 border border-mauve/10 rounded-lg p-3 text-charcoal text-sm">
                  👤 {slot.professionalName} <span className="text-charcoal/40">(el turno ya es de este profesional)</span>
                </p>
              ) : (
                <select
                  className="form-input mt-1.5"
                  value={professionalId}
                  onChange={(e) => setProfessionalId(e.target.value)}
                >
                  <option value="">Sin preferencia</option>
                  {professionals.map((pro) => (
                    <option key={pro.id} value={pro.id}>{pro.firstName} {pro.lastName}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">Notas (opcional)</label>
              <textarea
                className="form-input mt-1.5 resize-none"
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Observaciones..."
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3 pt-1">
              <Button data-testid="calendario-reserve-submit" type="submit" disabled={reserving} variant="primary" className="flex-1">
                {reserving ? "Reservando..." : "Confirmar reserva"}
              </Button>
              <Button type="button" onClick={onClose} variant="secondary">
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
