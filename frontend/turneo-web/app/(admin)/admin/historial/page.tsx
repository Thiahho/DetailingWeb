"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import type { BookingItemRecord, BookingRecord, NewItemState } from "./_components/BookingDetailModal";

// El modal de detalle (carga de fotos + productos/servicios usados) es el
// bloque más pesado de la página y solo hace falta al abrir un turno:
// diferirlo evita que entre en el compile/bundle inicial de la ruta.
const BookingDetailModal = dynamic(() => import("./_components/BookingDetailModal"), { ssr: false });

interface ServiceOption { id: number; title: string; price: string; }
interface ProductOption { id: number; name: string; price: number; }
interface InsumoOption { id: number; name: string; stock: number; lowStockThreshold: number; }
interface ServiceRecipeItem { insumoId: number; insumoName: string; quantity: number; }

function parsePhotoUrls(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-700"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Confirmado</span>;
  if (status === "Cancelled")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-600"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Cancelado</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-700"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" />Pendiente</span>;
}

function PaymentBadge({ status, amount, provider }: { status?: string; amount?: number; provider?: string }) {
  if (status === "Approved")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-700">
        ✓ Pagado{amount ? ` $${amount.toLocaleString("es-AR")}` : ""}{provider ? ` · ${provider}` : ""}
      </span>
    );
  if (status === "Pending")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-700">⏳ Pago pendiente</span>;
  if (status === "Rejected" || status === "Failed")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-600">✕ Pago rechazado</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-porcelain/10 text-charcoal/30">Sin pago</span>;
}

function NotificationBadge({ status }: { status?: string }) {
  if (status === "Sent") return <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700">Enviado</span>;
  if (status === "Failed") return <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-600">Fallido</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700">Pendiente</span>;
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
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [insumos, setInsumos] = useState<InsumoOption[]>([]);
  const [detailItems, setDetailItems] = useState<BookingItemRecord[]>([]);
  const [photosBefore, setPhotosBefore] = useState<string[]>([]);
  const [photosAfter, setPhotosAfter] = useState<string[]>([]);
  const [newItem, setNewItem] = useState<NewItemState>({ itemType: "Service", refId: 0, quantity: 1, unitPrice: 0, isSale: false });
  const [savingDetail, setSavingDetail] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) { router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login"); return; }
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setBookings(data); })
      .finally(() => setLoading(false));
    fetch("/api/services/all").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setServices(data); });
    fetch("/api/products").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setProducts(data); });
    fetch("/api/insumos").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setInsumos(data); });
  }, [router]);

  useEffect(() => { setPage(1); }, [filter, search]);

  useEffect(() => {
    if (!detail) return;
    setDetailItems(detail.items ?? []);
    setPhotosBefore(parsePhotoUrls(detail.photoUrlsBefore));
    setPhotosAfter(parsePhotoUrls(detail.photoUrlsAfter));
    setNewItem({ itemType: "Service", refId: 0, quantity: 1, unitPrice: 0, isSale: false });
  }, [detail]);

  const addItem = async () => {
    if (!newItem.refId) return;
    const catalog = newItem.itemType === "Service" ? services : newItem.itemType === "Product" ? products : insumos;
    const found = catalog.find((c) => c.id === newItem.refId);
    if (!found) return;
    const name = newItem.itemType === "Service" ? (found as ServiceOption).title : (found as ProductOption | InsumoOption).name;
    const addedServiceId = newItem.itemType === "Service" ? newItem.refId : null;
    const addedQuantity = newItem.quantity;
    setDetailItems((prev) => [...prev, {
      id: 0,
      itemType: newItem.itemType,
      serviceId: newItem.itemType === "Service" ? newItem.refId : null,
      productId: newItem.itemType === "Product" ? newItem.refId : null,
      insumoId: newItem.itemType === "Insumo" ? newItem.refId : null,
      isSale: newItem.itemType === "Insumo" ? newItem.isSale : undefined,
      name,
      quantity: newItem.quantity,
      // El insumo es costo interno salvo que se marque como venta: ahí sí se cobra al cliente.
      unitPrice: newItem.itemType === "Insumo" && !newItem.isSale ? 0 : newItem.unitPrice,
    }]);
    setNewItem({ itemType: "Service", refId: 0, quantity: 1, unitPrice: 0, isSale: false });

    // Al agregar un servicio, auto-agregar los insumos de su receta (editables/quitables antes de guardar).
    if (addedServiceId) {
      try {
        const res = await fetch(`/api/services/${addedServiceId}/recipe`);
        if (res.ok) {
          const recipeItems: ServiceRecipeItem[] = await res.json();
          if (recipeItems.length > 0) {
            setDetailItems((prev) => [
              ...prev,
              ...recipeItems.map((r) => ({
                id: 0,
                itemType: "Insumo" as const,
                insumoId: r.insumoId,
                isSale: false,
                name: r.insumoName,
                quantity: r.quantity * addedQuantity,
                unitPrice: 0,
              })),
            ]);
          }
        }
      } catch (error) {
        logError("Error cargando receta del servicio:", error);
      }
    }
  };

  const saveDetail = async () => {
    if (!detail) return;
    setSavingDetail(true);
    try {
      const payload = {
        photoUrlsBefore: photosBefore.length > 0 ? JSON.stringify(photosBefore) : null,
        photoUrlsAfter: photosAfter.length > 0 ? JSON.stringify(photosAfter) : null,
        items: detailItems.map((i) => ({
          itemType: i.itemType,
          serviceId: i.serviceId ?? undefined,
          productId: i.productId ?? undefined,
          insumoId: i.insumoId ?? undefined,
          isSale: i.isSale ?? false,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      };
      const res = await fetch(`/api/bookings/${detail.id}/detail`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const merged = { photoUrlsBefore: payload.photoUrlsBefore, photoUrlsAfter: payload.photoUrlsAfter, items: detailItems };
        setBookings((prev) => prev.map((b) => b.id === detail.id ? { ...b, ...merged } : b));
        setDetail((prev) => prev ? { ...prev, ...merged } : prev);
      }
    } finally {
      setSavingDetail(false);
    }
  };

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
      (b.service ?? "").toLowerCase().includes(q)
    );
  }, [afterFilter, search]);

  const totalPages = Math.max(1, Math.ceil(afterSearch.length / ITEMS_PER_PAGE));
  const paginated = afterSearch.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-charcoal">Cargando...</p></div>;

  return (
    <div className="p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-5xl">

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Historial de reservas</h1>
          <p className="text-charcoal/50 text-sm mt-1">Registro completo de todos los turnos</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-ivory border border-mauve/5 rounded-xl p-3 text-center">
            <p className="text-xl md:text-2xl font-bold text-charcoal">{counts.todos}</p>
            <p className="text-charcoal/40 text-[11px] mt-1">Total</p>
          </div>
          <div className="bg-ivory border border-orange-200 rounded-xl p-3 text-center">
            <p className="text-xl md:text-2xl font-bold text-orange-700">{counts.Reservado}</p>
            <p className="text-charcoal/40 text-[11px] mt-1">Pendientes</p>
          </div>
          <div className="bg-ivory border border-green-200 rounded-xl p-3 text-center">
            <p className="text-xl md:text-2xl font-bold text-green-700">{counts.Confirmed}</p>
            <p className="text-charcoal/40 text-[11px] mt-1">Confirmados</p>
          </div>
          <div className="bg-ivory border border-emerald-900/30 rounded-xl p-3 text-center">
            <p className="text-xl md:text-2xl font-bold text-emerald-700">{paid}</p>
            <p className="text-charcoal/40 text-[11px] mt-1">Pagados</p>
          </div>
        </div>

        {/* Recaudación */}
        {totalRevenue > 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-5 py-3 mb-5 flex items-center justify-between">
            <span className="text-emerald-700 text-sm font-medium">Total recaudado</span>
            <span className="text-emerald-700 text-xl font-bold">${totalRevenue.toLocaleString("es-AR")}</span>
          </div>
        )}

        {/* Búsqueda + Filtros */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por cliente, teléfono o servicio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="historial-search"
              className="w-full bg-ivory border border-mauve/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-charcoal placeholder-white/30 focus:outline-none focus:border-mauve/20 transition"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/30 hover:text-charcoal/60 transition">✕</button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {(Object.keys(filterLabels) as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  filter === f ? "bg-blush text-cream" : "bg-porcelain/5 text-charcoal/50 hover:text-charcoal hover:bg-porcelain/10"
                }`}
              >
                {filterLabels[f]}
                <span className="ml-1.5 opacity-60">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>

        {afterSearch.length === 0 ? (
          <div className="bg-ivory border border-mauve/5 rounded-2xl py-16 text-center text-charcoal/30 text-sm">
            {search ? `Sin resultados para "${search}"` : "Sin reservas para mostrar"}
          </div>
        ) : (
          <>
            <p className="text-charcoal/30 text-xs mb-3">
              {afterSearch.length} resultado{afterSearch.length !== 1 ? "s" : ""}
              {search && <> para <span className="text-charcoal/50">"{search}"</span></>}
              {" · "}página {page} de {totalPages}
            </p>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
              {paginated.map((b) => (
                <div
                  key={b.id}
                  className="bg-ivory border border-mauve/5 rounded-xl p-4 cursor-pointer hover:border-mauve/10 transition"
                  onClick={() => setDetail(b)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-charcoal font-medium text-sm">{b.customerName}</p>
                      <p className="text-charcoal/40 text-xs mt-0.5">{formatDateFriendly(b.startDateTime)}</p>
                      <p className="text-charcoal/40 text-xs mt-0.5">{b.subject}{b.service ? ` · ${b.service}` : ""}</p>
                      {b.professionalName && (
                        <p className="text-charcoal/30 text-xs mt-0.5">👤 {b.professionalName}</p>
                      )}
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
            <div className="hidden md:block bg-ivory border border-mauve/5 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mauve/5 text-charcoal/30 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Turno</th>
                    <th className="text-left px-5 py-3 font-medium">Cliente</th>
                    <th className="text-left px-5 py-3 font-medium">Servicio</th>
                    <th className="text-left px-5 py-3 font-medium">Especialista</th>
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
                      data-testid="historial-row"
                      data-customer-name={b.customerName}
                      className="border-b border-mauve/5 last:border-0 hover:bg-porcelain/[0.02] transition cursor-pointer"
                      onClick={() => setDetail(b)}
                    >
                      <td className="px-5 py-4 text-charcoal/70 font-mono text-xs whitespace-nowrap">
                        {formatDateFriendly(b.startDateTime)}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-charcoal font-medium">{b.customerName}</p>
                        <p className="text-charcoal/40 text-xs mt-0.5">{b.customerPhone}</p>
                      </td>
                      <td className="px-5 py-4 text-charcoal/60">
                        <p>{b.service || "—"}</p>
                        {b.subject && <p className="text-charcoal/30 text-xs">{b.subject}</p>}
                      </td>
                      <td className="px-5 py-4 text-charcoal/60">{b.professionalName || "—"}</td>
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
                            data-testid="historial-confirm-button"
                            className="text-xs text-blushdark hover:text-blush font-medium transition"
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
                <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="p-2 text-charcoal/50 hover:text-charcoal disabled:opacity-20 disabled:cursor-not-allowed transition">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                  const isActive = p === page;
                  const isNear = Math.abs(p - page) <= 1 || p === 1 || p === totalPages;
                  if (!isNear) {
                    if (p === 2 || p === totalPages - 1) return <span key={p} className="text-charcoal/20 text-sm">…</span>;
                    return null;
                  }
                  return (
                    <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-full text-sm font-bold transition-all ${isActive ? "bg-blush text-cream scale-110" : "bg-porcelain/10 text-charcoal hover:bg-porcelain/20"}`}>{p}</button>
                  );
                })}
                <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages} className="p-2 text-charcoal/50 hover:text-charcoal disabled:opacity-20 disabled:cursor-not-allowed transition">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {detail && (
        <BookingDetailModal
          detail={detail}
          detailItems={detailItems}
          setDetailItems={setDetailItems}
          newItem={newItem}
          setNewItem={setNewItem}
          photosBefore={photosBefore}
          setPhotosBefore={setPhotosBefore}
          photosAfter={photosAfter}
          setPhotosAfter={setPhotosAfter}
          services={services}
          products={products}
          insumos={insumos}
          confirming={confirming}
          savingDetail={savingDetail}
          onClose={() => setDetail(null)}
          addItem={addItem}
          saveDetail={saveDetail}
          confirmBooking={confirmBooking}
        />
      )}
    </div>
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
