"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { Plus, ChevronLeft, Bell, BellOff, Pencil, Trash2, X, Check, Clock, RefreshCw, Cake, Instagram as InstagramIcon, Star, History } from "lucide-react";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import Modal from "./_components/Modal";
import type { Customer } from "./_components/types";
import type { CustomerFormData } from "./_components/CustomerFormModal";

// Los formularios de cliente y de turno/aviso son los bloques más pesados de
// esta página (fetch de catálogos, lógica de slots) y solo hacen falta cuando
// se abre el modal correspondiente: diferirlos evita que entren en el
// compile/bundle inicial de la ruta.
const CustomerFormModal = dynamic(() => import("./_components/CustomerFormModal"), { ssr: false });
const ReminderFormModal = dynamic(() => import("./_components/ReminderFormModal"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────

interface InsumoUsageItem {
  name: string;
  quantity: number;
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
  insumosUsados?: InsumoUsageItem[];
}

interface BookingItemRecord {
  id: number;
  itemType: "Service" | "Product" | "Insumo";
  isSale?: boolean;
  name: string;
  quantity: number;
  unitPrice: number;
}

// Shape de /api/bookings (admin) — más completo que BookingHistoryItem, se usa
// para el modal de detalle del historial de un cliente.
interface BookingFullRecord {
  id: number;
  customerName: string;
  customerPhone: string;
  email?: string | null;
  subject?: string | null;
  service?: string | null;
  professionalName?: string | null;
  message?: string | null;
  status: string;
  startDateTime: string;
  paymentStatus?: string;
  paymentAmount?: number;
  paymentProvider?: string;
  items?: BookingItemRecord[];
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
    Pending:   "bg-amber-500/20 text-amber-400",
    Sent:      "bg-emerald-500/20 text-emerald-400",
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-charcoal/40 text-sm shrink-0">{label}</span>
      <span className="text-charcoal text-sm text-right">{value}</span>
    </div>
  );
}

function BookingStatusBadge({ status }: { status: string }) {
  if (status === "Confirmed")
    return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/20 text-emerald-400">Confirmado</span>;
  if (status === "Cancelled")
    return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-500/20 text-red-600">Cancelado</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-500/20 text-amber-400">Pendiente</span>;
}

// ── Main page ─────────────────────────────────────────────────────

export default function ClientesPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { confirm, ConfirmDialog } = useConfirm();

  // detail view
  const [selected, setSelected] = useState<Customer | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [history, setHistory] = useState<BookingHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [allBookings, setAllBookings] = useState<BookingFullRecord[]>([]);
  const [detailBooking, setDetailBooking] = useState<BookingFullRecord | null>(null);

  // modals
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showReminderForm, setShowReminderForm] = useState(false);
  // "turno" = registrar un turno manual sin forzar un aviso; "aviso" = flujo
  // original (reserva + programa aviso 24hs, aviso tildado por defecto).
  const [reminderFormMode, setReminderFormMode] = useState<"turno" | "aviso">("turno");

  // ── auth ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdminAuthenticated()) { router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login"); return; }
    loadCustomers();
    fetch("/api/bookings").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setAllBookings(d); });
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
    if (!(await confirm({ message: `¿Eliminar a ${c.name}? Se borrarán también sus recordatorios.`, confirmLabel: "Eliminar cliente" }))) return;
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
    if (!(await confirm({ message: "¿Cancelar este recordatorio?", confirmLabel: "Cancelar recordatorio" }))) return;
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
      {ConfirmDialog}
      {/* ── modals ── */}
      {(showCustomerForm || editingCustomer) && (
        <CustomerFormModal
          initial={editingCustomer ?? undefined}
          onSave={saveCustomer}
          onClose={() => { setShowCustomerForm(false); setEditingCustomer(null); }}
        />
      )}

      {showReminderForm && selected && (
        <ReminderFormModal
          customer={selected}
          defaultScheduleReminder={reminderFormMode === "aviso"}
          onSave={saveReminder}
          onBookingCreated={() => loadHistory(selected.id)}
          onClose={() => setShowReminderForm(false)}
        />
      )}

      {detailBooking && (
        <Modal title="Detalle de reserva" onClose={() => setDetailBooking(null)}>
          <div className="space-y-3" data-testid="customer-booking-detail-modal">
            <Row label="Fecha" value={formatDate(detailBooking.startDateTime)} />
            <Row label="Detalle" value={detailBooking.subject || "—"} />
            <Row label="Servicio" value={detailBooking.service || "—"} />
            {detailBooking.professionalName && <Row label="Especialista" value={detailBooking.professionalName} />}
            {detailBooking.message && <Row label="Mensaje" value={detailBooking.message} />}
            <Row label="Estado" value={<BookingStatusBadge status={detailBooking.status} />} />
            {detailBooking.paymentStatus && (
              <Row
                label="Pago"
                value={
                  detailBooking.paymentStatus === "Approved"
                    ? `✓ Pagado${detailBooking.paymentAmount ? ` $${detailBooking.paymentAmount.toLocaleString("es-AR")}` : ""}${detailBooking.paymentProvider ? ` · ${detailBooking.paymentProvider}` : ""}`
                    : detailBooking.paymentStatus === "Pending"
                    ? "Pago pendiente"
                    : "Sin pago"
                }
              />
            )}
            {detailBooking.items && detailBooking.items.length > 0 && (
              <div className="pt-2 border-t border-mauve/15">
                <p className="text-charcoal/30 text-[11px] uppercase tracking-wider mb-2">Productos y servicios utilizados</p>
                <div className="space-y-1.5">
                  {detailBooking.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-charcoal/70">
                        {item.name} <span className="text-charcoal/30 text-xs">×{item.quantity}</span>
                      </span>
                      <span className="text-charcoal/50 text-xs">${(item.unitPrice * item.quantity).toLocaleString("es-AR")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
                    onClick={() => { setReminderFormMode("aviso"); setShowReminderForm(true); }}
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
                    onClick={() => { setReminderFormMode("aviso"); setShowReminderForm(true); }}
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
                              <Check size={16} className="text-emerald-400" />
                            ) : r.status === "Cancelled" ? (
                              <BellOff size={16} className="text-charcoal/20" />
                            ) : r.status === "Failed" ? (
                              <X size={16} className="text-red-600" />
                            ) : (
                              <Clock size={16} className="text-amber-400" />
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
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <History size={15} className="text-charcoal/40" />
                    <h2 className="text-charcoal/70 text-sm font-medium">Historial de turnos</h2>
                  </div>
                  <button
                    onClick={() => { setReminderFormMode("turno"); setShowReminderForm(true); }}
                    data-testid="booking-create-button"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-champagne/20 text-champagne text-xs font-medium rounded-lg hover:bg-champagne/30 transition"
                  >
                    <Plus size={13} />
                    Nuevo turno
                  </button>
                </div>
                {loadingHistory ? (
                  <p className="text-charcoal/30 text-sm py-6 text-center">Cargando...</p>
                ) : history.length === 0 ? (
                  <div className="text-center py-6 border border-mauve/15 rounded-xl">
                    <p className="text-charcoal/30 text-sm">Sin turnos registrados todavía.</p>
                    <button
                      onClick={() => { setReminderFormMode("turno"); setShowReminderForm(true); }}
                      className="mt-3 text-champagne/70 text-xs hover:text-champagne transition"
                    >
                      Registrar el primero
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((h) => (
                      <div
                        key={h.id}
                        data-testid="customer-history-item"
                        onClick={() => setDetailBooking(allBookings.find((b) => b.id === h.id) ?? {
                          id: h.id,
                          customerName: selected!.name,
                          customerPhone: selected!.phone,
                          subject: h.subject,
                          service: h.service,
                          professionalName: h.professionalName,
                          status: h.status,
                          startDateTime: h.startDateTime,
                        })}
                        className="flex items-center justify-between bg-porcelain border border-mauve/15 rounded-xl px-4 py-3 cursor-pointer hover:brightness-95 transition"
                      >
                        <div className="min-w-0">
                          <p className="text-charcoal text-sm font-medium truncate">{h.service || h.subject}</p>
                          <p className="text-charcoal/40 text-xs">
                            {formatDate(h.startDateTime)}{h.professionalName ? ` · ${h.professionalName}` : ""}
                          </p>
                          {h.insumosUsados && h.insumosUsados.length > 0 && (
                            <p className="text-charcoal/30 text-xs mt-0.5 truncate">
                              Insumos usados: {h.insumosUsados.map((i) => `${i.name} x${i.quantity}`).join(", ")}
                            </p>
                          )}
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
