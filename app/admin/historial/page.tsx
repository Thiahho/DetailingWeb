"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "../../../src/lib/auth";

interface BookingRecord {
  id: number;
  customerName: string;
  customerPhone: string;
  email?: string;
  subject?: string;
  service: string;
  message?: string;
  status: string;
  startDateTime: string;
  createdAt: string;
  notificationStatus?: string;
  paymentStatus?: string;
  paymentAmount?: number;
  paymentPaidAt?: string;
  paymentProvider?: string;
}

function formatDateFriendly(isoString: string) {
  const clean = isoString.replace("Z", "");
  const [datePart, timePart] = clean.split("T");
  const [year, month, day] = datePart.split("-");
  const [hours, minutes] = timePart.split(":");
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const days = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  return `${days[date.getDay()]} ${day}/${month}/${year} · ${hours}:${minutes}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Confirmed")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Confirmado</span>;
  if (status === "Cancelled")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Cancelado</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-400"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" />Pendiente</span>;
}

function PaymentBadge({ status, amount, provider }: { status?: string; amount?: number; provider?: string }) {
  if (status === "Approved")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400">
        ✓ Pagado{amount ? ` $${amount.toLocaleString("es-AR")}` : ""}{provider ? ` · ${provider}` : ""}
      </span>
    );
  if (status === "Pending")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400">⏳ Pago pendiente</span>;
  if (status === "Rejected" || status === "Failed")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">✕ Pago rechazado</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white/30">Sin pago</span>;
}

function NotificationBadge({ status }: { status?: string }) {
  if (status === "Sent") return <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Enviado</span>;
  if (status === "Failed") return <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">Fallido</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">Pendiente</span>;
}

type FilterType = "todos" | "Reservado" | "Confirmed" | "Cancelled" | "Pagado" | "SinPago";
const ITEMS_PER_PAGE = 10;

export default function HistorialPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("todos");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<BookingRecord | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/admin/login"); return; }
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setBookings(data); })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => { setPage(1); }, [filter, search]);

  const confirmBooking = async (id: number, booking?: BookingRecord) => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/bookings/${id}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: booking?.email,
          customerName: booking?.customerName,
          subject: booking?.subject,
          service: booking?.service,
          startDateTime: booking?.startDateTime,
        }),
      });
      if (res.ok) {
        setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: "Confirmed" } : b));
        setDetail((prev) => prev?.id === id ? { ...prev, status: "Confirmed" } : prev);
      }
    } finally {
      setConfirming(false);
    }
  };

  const paid = bookings.filter((b) => b.paymentStatus === "Approved").length;
  const totalRevenue = bookings
    .filter((b) => b.paymentStatus === "Approved" && b.paymentAmount)
    .reduce((sum, b) => sum + (b.paymentAmount ?? 0), 0);

  const counts = {
    todos: bookings.length,
    Reservado: bookings.filter((b) => b.status !== "Confirmed" && b.status !== "Cancelled").length,
    Confirmed: bookings.filter((b) => b.status === "Confirmed").length,
    Cancelled: bookings.filter((b) => b.status === "Cancelled").length,
    Pagado: paid,
    SinPago: bookings.filter((b) => !b.paymentStatus || b.paymentStatus === "Pending").length,
  };

  const filterLabels: Record<FilterType, string> = {
    todos: "Todos",
    Reservado: "Pendientes",
    Confirmed: "Confirmados",
    Cancelled: "Cancelados",
    Pagado: "Pagados",
    SinPago: "Sin pago",
  };

  const afterFilter = useMemo(() => {
    if (filter === "todos") return bookings;
    if (filter === "Reservado") return bookings.filter((b) => b.status !== "Confirmed" && b.status !== "Cancelled");
    if (filter === "Pagado") return bookings.filter((b) => b.paymentStatus === "Approved");
    if (filter === "SinPago") return bookings.filter((b) => !b.paymentStatus || b.paymentStatus === "Pending");
    return bookings.filter((b) => b.status === filter);
  }, [bookings, filter]);

  const afterSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return afterFilter;
    return afterFilter.filter((b) =>
      b.customerName.toLowerCase().includes(q) ||
      b.customerPhone.includes(q) ||
      (b.subject ?? "").toLowerCase().includes(q) ||
      b.service.toLowerCase().includes(q)
    );
  }, [afterFilter, search]);

  const totalPages = Math.max(1, Math.ceil(afterSearch.length / ITEMS_PER_PAGE));
  const paginated = afterSearch.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-white">Cargando...</p></div>;

  return (
    <div className="p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-5xl">

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Historial de reservas</h1>
          <p className="text-white/50 text-sm mt-1">Registro completo de todos los turnos</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-[#161b22] border border-white/5 rounded-xl p-3 text-center">
            <p className="text-xl md:text-2xl font-bold text-white">{counts.todos}</p>
            <p className="text-white/40 text-[11px] mt-1">Total</p>
          </div>
          <div className="bg-[#161b22] border border-orange-900/30 rounded-xl p-3 text-center">
            <p className="text-xl md:text-2xl font-bold text-orange-400">{counts.Reservado}</p>
            <p className="text-white/40 text-[11px] mt-1">Pendientes</p>
          </div>
          <div className="bg-[#161b22] border border-green-900/30 rounded-xl p-3 text-center">
            <p className="text-xl md:text-2xl font-bold text-green-400">{counts.Confirmed}</p>
            <p className="text-white/40 text-[11px] mt-1">Confirmados</p>
          </div>
          <div className="bg-[#161b22] border border-emerald-900/30 rounded-xl p-3 text-center">
            <p className="text-xl md:text-2xl font-bold text-emerald-400">{paid}</p>
            <p className="text-white/40 text-[11px] mt-1">Pagados</p>
          </div>
        </div>

        {/* Recaudación */}
        {totalRevenue > 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-5 py-3 mb-5 flex items-center justify-between">
            <span className="text-emerald-400 text-sm font-medium">Total recaudado</span>
            <span className="text-emerald-300 text-xl font-bold">${totalRevenue.toLocaleString("es-AR")}</span>
          </div>
        )}

        {/* Búsqueda + Filtros */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por cliente, teléfono o servicio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#161b22] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition">✕</button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {(Object.keys(filterLabels) as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  filter === f ? "bg-white text-black" : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10"
                }`}
              >
                {filterLabels[f]}
                <span className="ml-1.5 opacity-60">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>

        {afterSearch.length === 0 ? (
          <div className="bg-[#161b22] border border-white/5 rounded-2xl py-16 text-center text-white/30 text-sm">
            {search ? `Sin resultados para "${search}"` : "Sin reservas para mostrar"}
          </div>
        ) : (
          <>
            <p className="text-white/30 text-xs mb-3">
              {afterSearch.length} resultado{afterSearch.length !== 1 ? "s" : ""}
              {search && <> para <span className="text-white/50">"{search}"</span></>}
              {" · "}página {page} de {totalPages}
            </p>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
              {paginated.map((b) => (
                <div
                  key={b.id}
                  className="bg-[#161b22] border border-white/5 rounded-xl p-4 cursor-pointer hover:border-white/10 transition"
                  onClick={() => setDetail(b)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white font-medium text-sm">{b.customerName}</p>
                      <p className="text-white/40 text-xs mt-0.5">{formatDateFriendly(b.startDateTime)}</p>
                      <p className="text-white/40 text-xs mt-0.5">{b.subject}{b.service ? ` · ${b.service}` : ""}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <StatusBadge status={b.status} />
                      <PaymentBadge status={b.paymentStatus} amount={b.paymentAmount} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: tabla */}
            <div className="hidden md:block bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-white/30 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Turno</th>
                    <th className="text-left px-5 py-3 font-medium">Cliente</th>
                    <th className="text-left px-5 py-3 font-medium">Servicio</th>
                    <th className="text-left px-5 py-3 font-medium">Estado</th>
                    <th className="text-left px-5 py-3 font-medium">Pago</th>
                    <th className="text-left px-5 py-3 font-medium">Notif.</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition cursor-pointer"
                      onClick={() => setDetail(b)}
                    >
                      <td className="px-5 py-4 text-white/70 font-mono text-xs whitespace-nowrap">
                        {formatDateFriendly(b.startDateTime)}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-white font-medium">{b.customerName}</p>
                        <p className="text-white/40 text-xs mt-0.5">{b.customerPhone}</p>
                      </td>
                      <td className="px-5 py-4 text-white/60">
                        <p>{b.service || "—"}</p>
                        {b.subject && <p className="text-white/30 text-xs">{b.subject}</p>}
                      </td>
                      <td className="px-5 py-4"><StatusBadge status={b.status} /></td>
                      <td className="px-5 py-4">
                        <PaymentBadge status={b.paymentStatus} amount={b.paymentAmount} provider={b.paymentProvider} />
                      </td>
                      <td className="px-5 py-4">
                        <NotificationBadge status={b.notificationStatus} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        {b.status !== "Confirmed" && b.status !== "Cancelled" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); confirmBooking(b.id, b); }}
                            className="text-xs text-blue-400 hover:text-blue-300 font-medium transition"
                          >
                            Confirmar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="p-2 text-white/50 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                  const isActive = p === page;
                  const isNear = Math.abs(p - page) <= 1 || p === 1 || p === totalPages;
                  if (!isNear) {
                    if (p === 2 || p === totalPages - 1) return <span key={p} className="text-white/20 text-sm">…</span>;
                    return null;
                  }
                  return (
                    <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-full text-sm font-bold transition-all ${isActive ? "bg-white text-black scale-110" : "bg-white/10 text-white hover:bg-white/20"}`}>{p}</button>
                  );
                })}
                <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages} className="p-2 text-white/50 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal detalle */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="bg-[#161b22] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div>
                <h2 className="text-white font-semibold text-lg">Detalle de reserva</h2>
                <p className="text-white/40 text-xs mt-0.5">{formatDateFriendly(detail.startDateTime)}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-white/40 hover:text-white transition text-xl">✕</button>
            </div>

            <div className="px-6 py-5 space-y-3">
              <Row label="Cliente" value={detail.customerName} />
              <Row label="Teléfono" value={<a href={`tel:${detail.customerPhone}`} className="text-blue-400 hover:underline">{detail.customerPhone}</a>} />
              {detail.email && <Row label="Email" value={detail.email} />}
              {detail.subject && <Row label="Trabajo" value={detail.subject} />}
              <Row label="Servicio" value={detail.service || "—"} />
              {detail.message && <Row label="Mensaje" value={detail.message} />}
              <Row label="Reserva" value={<StatusBadge status={detail.status} />} />

              {/* Bloque de pago */}
              <div className="pt-2 border-t border-white/5">
                <p className="text-white/30 text-[11px] uppercase tracking-wider mb-2">Pago</p>
                <div className="flex items-center justify-between">
                  <PaymentBadge status={detail.paymentStatus} amount={detail.paymentAmount} provider={detail.paymentProvider} />
                  {detail.paymentPaidAt && (
                    <span className="text-white/30 text-xs">{formatDateFriendly(detail.paymentPaidAt)}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/5 flex gap-3">
              <a
                href={`https://wa.me/${detail.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                  `Hola ${detail.customerName} 👋\n\nTe confirmamos tu reserva:\n\n📅 *Fecha:* ${formatDateFriendly(detail.startDateTime)}\n🔧 *Servicio:* ${detail.service || "—"}\n\n¡Nos vemos!`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-lg text-sm font-semibold transition"
              >
                WhatsApp
              </a>
              {detail.status !== "Confirmed" && detail.status !== "Cancelled" && (
                <button
                  onClick={() => confirmBooking(detail.id, detail)}
                  disabled={confirming}
                  className="flex-1 bg-blue-600/20 border border-blue-600/50 hover:bg-blue-600/30 text-blue-400 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                  {confirming ? "Confirmando..." : "Confirmar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-white/40 text-sm shrink-0">{label}</span>
      <span className="text-white text-sm text-right">{value}</span>
    </div>
  );
}
