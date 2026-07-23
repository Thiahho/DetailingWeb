"use client";

import type { Dispatch, SetStateAction } from "react";
import { X } from "lucide-react";
import CloudinaryUpload from "@/src/components/forms/CloudinaryUpload";
import { Button } from "@/src/components/shared/Button";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

export interface BookingItemRecord {
  id: number;
  itemType: "Service" | "Product" | "Insumo";
  serviceId?: number | null;
  productId?: number | null;
  insumoId?: number | null;
  isSale?: boolean;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface BookingRecord {
  id: number;
  customerName: string;
  customerPhone: string;
  email?: string;
  subject?: string;
  service?: string;
  professionalId?: number | null;
  professionalName?: string | null;
  message?: string;
  status: string;
  startDateTime: string;
  createdAt: string;
  notificationStatus?: string;
  paymentStatus?: string;
  paymentAmount?: number;
  paymentPaidAt?: string;
  paymentProvider?: string;
  photoUrlsBefore?: string | null;
  photoUrlsAfter?: string | null;
  items?: BookingItemRecord[];
}

interface ServiceOption { id: number; title: string; price: string; }
interface ProductOption { id: number; name: string; price: number; }
interface InsumoOption { id: number; name: string; stock: number; lowStockThreshold: number; }
interface ServiceRecipeItem { insumoId: number; insumoName: string; quantity: number; }
export interface NewItemState { itemType: "Service" | "Product" | "Insumo"; refId: number; quantity: number; unitPrice: number; isSale: boolean; }

function parseServicePrice(raw: string): number {
  const match = raw.replace(/\./g, "").match(/\d+([,.]\d+)?/);
  if (!match) return 0;
  return parseFloat(match[0].replace(",", ".")) || 0;
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
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-600"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Cancelado</span>;
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
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-600">✕ Pago rechazado</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-porcelain/10 text-charcoal/30">Sin pago</span>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-charcoal/40 text-sm shrink-0">{label}</span>
      <span className="text-charcoal text-sm text-right">{value}</span>
    </div>
  );
}

export default function BookingDetailModal({
  detail,
  detailItems,
  setDetailItems,
  newItem,
  setNewItem,
  photosBefore,
  setPhotosBefore,
  photosAfter,
  setPhotosAfter,
  services,
  products,
  insumos,
  confirming,
  savingDetail,
  onClose,
  addItem,
  saveDetail,
  confirmBooking,
}: {
  detail: BookingRecord;
  detailItems: BookingItemRecord[];
  setDetailItems: Dispatch<SetStateAction<BookingItemRecord[]>>;
  newItem: NewItemState;
  setNewItem: Dispatch<SetStateAction<NewItemState>>;
  photosBefore: string[];
  setPhotosBefore: Dispatch<SetStateAction<string[]>>;
  photosAfter: string[];
  setPhotosAfter: Dispatch<SetStateAction<string[]>>;
  services: ServiceOption[];
  products: ProductOption[];
  insumos: InsumoOption[];
  confirming: boolean;
  savingDetail: boolean;
  onClose: () => void;
  addItem: () => Promise<void>;
  saveDetail: () => Promise<void>;
  confirmBooking: (id: number, booking?: BookingRecord) => Promise<void>;
}) {
  useModalHotkeys(true, { onClose });
  const removeItem = (idx: number) => setDetailItems((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div data-testid="historial-detail-modal" className="bg-ivory border border-mauve/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-mauve/5">
          <div>
            <h2 className="text-charcoal font-semibold text-lg">Detalle de reserva</h2>
            <p className="text-charcoal/40 text-xs mt-0.5">{formatDateFriendly(detail.startDateTime)}</p>
          </div>
          <button onClick={onClose} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <Row label="Cliente" value={detail.customerName} />
          <Row label="Teléfono" value={<a href={`tel:${detail.customerPhone}`} className="text-blue-400 hover:underline">{detail.customerPhone}</a>} />
          {detail.email && <Row label="Email" value={detail.email} />}
          {detail.subject && <Row label="Trabajo" value={detail.subject} />}
          <Row label="Servicio" value={detail.service || "—"} />
          {detail.professionalName && <Row label="Especialista" value={detail.professionalName} />}
          {detail.message && <Row label="Mensaje" value={detail.message} />}
          <Row label="Reserva" value={<StatusBadge status={detail.status} />} />

          {/* Bloque de pago */}
          <div className="pt-2 border-t border-mauve/5">
            <p className="text-charcoal/30 text-[11px] uppercase tracking-wider mb-2">Pago</p>
            <div className="flex items-center justify-between">
              <PaymentBadge status={detail.paymentStatus} amount={detail.paymentAmount} provider={detail.paymentProvider} />
              {detail.paymentPaidAt && (
                <span className="text-charcoal/30 text-xs">{formatDateFriendly(detail.paymentPaidAt)}</span>
              )}
            </div>
          </div>

          {/* Productos y servicios utilizados */}
          <div className="pt-2 border-t border-mauve/5">
            <p className="text-charcoal/30 text-[11px] uppercase tracking-wider mb-2">Productos y servicios utilizados</p>
            {detailItems.length > 0 && (
              <div className="space-y-1.5 mb-2" data-testid="historial-item-list">
                {detailItems.map((item, i) => (
                  <div key={i} data-testid="historial-item-row" className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-charcoal/70">
                      {item.name} <span className="text-charcoal/30 text-xs">×{item.quantity}</span>
                      {item.itemType === "Insumo" && (
                        <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${item.isSale ? "bg-emerald-500/20 text-emerald-400" : "bg-porcelain/30 text-charcoal/40"}`}>
                          {item.isSale ? "VENTA" : "USO INTERNO"}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-charcoal/50 text-xs">${(item.unitPrice * item.quantity).toLocaleString("es-AR")}</span>
                      <button type="button" onClick={() => removeItem(i)} data-testid="historial-item-remove" className="text-red-600/60 hover:text-red-600 text-xs">✕</button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-semibold pt-1.5 border-t border-mauve/5">
                  <span className="text-charcoal/50">Total</span>
                  <span className="text-charcoal">${detailItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toLocaleString("es-AR")}</span>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 items-center">
              <select
                value={newItem.itemType}
                onChange={(e) => setNewItem((prev) => ({ ...prev, itemType: e.target.value as "Service" | "Product" | "Insumo", refId: 0, unitPrice: 0, isSale: false }))}
                data-testid="historial-item-type"
                className="bg-cream border border-mauve/10 rounded-lg px-1.5 py-1.5 text-xs text-charcoal focus:outline-none"
              >
                <option value="Service">Servicio</option>
                <option value="Product">Producto</option>
                <option value="Insumo">Insumo</option>
              </select>
              <select
                value={newItem.refId}
                onChange={(e) => {
                  const id = parseInt(e.target.value) || 0;
                  if (newItem.itemType === "Product") {
                    const p = products.find((x) => x.id === id);
                    setNewItem((prev) => ({ ...prev, refId: id, unitPrice: p?.price ?? 0 }));
                  } else if (newItem.itemType === "Service") {
                    const s = services.find((x) => x.id === id);
                    setNewItem((prev) => ({ ...prev, refId: id, unitPrice: s ? parseServicePrice(s.price) : 0 }));
                  } else {
                    setNewItem((prev) => ({ ...prev, refId: id }));
                  }
                }}
                data-testid="historial-item-select"
                className="flex-1 min-w-0 bg-cream border border-mauve/10 rounded-lg px-1.5 py-1.5 text-xs text-charcoal focus:outline-none"
              >
                <option value={0}>Elegir...</option>
                {newItem.itemType === "Service" && services.map((s) => (
                  <option key={s.id} value={s.id}>{s.title} — {s.price}</option>
                ))}
                {newItem.itemType === "Product" && products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                {newItem.itemType === "Insumo" && insumos.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} ({i.stock <= 0 ? "SIN STOCK" : `Stock: ${i.stock}`})</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={newItem.quantity}
                onChange={(e) => setNewItem((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                data-testid="historial-item-quantity"
                className="w-11 bg-cream border border-mauve/10 rounded-lg px-1 py-1.5 text-xs text-charcoal text-center focus:outline-none"
              />
              {newItem.itemType === "Insumo" && (
                <label className="flex items-center gap-1 text-charcoal/60 text-[11px] cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={newItem.isSale}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, isSale: e.target.checked, unitPrice: e.target.checked ? prev.unitPrice : 0 }))}
                    data-testid="historial-item-sale-checkbox"
                    className="accent-emerald-500"
                  />
                  Venta
                </label>
              )}
              {newItem.itemType === "Insumo" && !newItem.isSale ? (
                <span className="w-16 text-center text-[11px] text-charcoal/30 italic shrink-0">Interno</span>
              ) : (
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newItem.unitPrice}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                  placeholder="Precio"
                  data-testid="historial-item-price"
                  className="w-16 bg-cream border border-mauve/10 rounded-lg px-1.5 py-1.5 text-xs text-charcoal focus:outline-none"
                />
              )}
              <Button
                type="button"
                onClick={addItem}
                data-testid="historial-item-add"
                variant="secondary"
                size="sm"
                className="shrink-0"
              >
                +
              </Button>
            </div>
          </div>

          {/* Fotos antes/después */}
          <div className="pt-2 border-t border-mauve/5 grid grid-cols-2 gap-3">
            <div>
              <p className="text-charcoal/30 text-[11px] uppercase tracking-wider mb-2">Fotos antes</p>
              {photosBefore.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-1.5" data-testid="historial-photos-before">
                  {photosBefore.map((url, i) => (
                    <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden border border-mauve/15">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotosBefore((p) => p.filter((_, idx) => idx !== i))}
                        className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-lg p-0.5"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <CloudinaryUpload value="" onChange={(url) => url && setPhotosBefore((p) => [...p, url])} folder="Turneo/historial" hint="" />
            </div>
            <div>
              <p className="text-charcoal/30 text-[11px] uppercase tracking-wider mb-2">Fotos después</p>
              {photosAfter.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-1.5" data-testid="historial-photos-after">
                  {photosAfter.map((url, i) => (
                    <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden border border-mauve/15">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotosAfter((p) => p.filter((_, idx) => idx !== i))}
                        className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-lg p-0.5"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <CloudinaryUpload value="" onChange={(url) => url && setPhotosAfter((p) => [...p, url])} folder="Turneo/historial" hint="" />
            </div>
          </div>

          <Button
            type="button"
            onClick={saveDetail}
            disabled={savingDetail}
            data-testid="historial-save-detail"
            variant="secondary"
            className="w-full"
          >
            {savingDetail ? "Guardando..." : "Guardar detalle"}
          </Button>
        </div>

        <div className="px-6 py-4 border-t border-mauve/5 flex gap-3">
          <a
            href={`https://wa.me/${detail.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
              `Hola ${detail.customerName} 👋\n\nTe confirmamos tu reserva:\n\n📅 *Fecha:* ${formatDateFriendly(detail.startDateTime)}\n🔧 *Servicio:* ${detail.service || "—"}\n\n¡Nos vemos!`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center bg-green-600 hover:bg-green-500 text-charcoal py-2.5 rounded-lg text-sm font-semibold transition"
          >
            WhatsApp
          </a>
          {detail.status !== "Confirmed" && detail.status !== "Cancelled" && (
            <Button
              onClick={() => confirmBooking(detail.id, detail)}
              disabled={confirming}
              variant="primary"
              className="flex-1"
            >
              {confirming ? "Confirmando..." : "Confirmar"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
