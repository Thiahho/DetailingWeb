"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { Button } from "@/src/components/shared/Button";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import BulkActionBar, { BulkCheckbox } from "@/src/components/dashboard/BulkActionBar";
import { useBulkSelection } from "@/src/hooks/useBulkSelection";
import { countLabel, runBulk } from "@/src/lib/bulk";

interface Review {
  id: number;
  authorName: string | null;
  rating: number;
  comment: string | null;
  source: "SmartTag" | "PublicForm";
  isApproved: boolean;
  order: number;
  createdAt: string;
}

const SOURCE_LABELS: Record<Review["source"], string> = {
  SmartTag: "Smart Tag",
  PublicForm: "Formulario web",
};

export default function ResenasAdminPage() {
  const router = useRouter();
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const { toasts, showToast, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const bulk = useBulkSelection(items.map((r) => r.id));
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
      return;
    }
    loadItems();
  }, [router]);

  const loadItems = async () => {
    try {
      const res = await fetch("/api/reviews/all");
      if (res.ok) setItems(await res.json());
    } catch (error) {
      logError("Error cargando reseñas:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateReview = async (item: Review, changes: Partial<Pick<Review, "isApproved" | "order">>) => {
    setSavingId(item.id);
    try {
      const res = await fetch(`/api/reviews/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: item.authorName,
          rating: item.rating,
          comment: item.comment,
          isApproved: item.isApproved,
          order: item.order,
          ...changes,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems((prev) => prev.map((r) => (r.id === item.id ? updated : r)));
      } else {
        showToast("error", "No se pudo guardar el cambio");
      }
    } catch {
      showToast("error", "Error de conexión");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("warning", "Reseña eliminada");
        setDeleteConfirmId(null);
        setItems((prev) => prev.filter((r) => r.id !== id));
      } else {
        showToast("error", "No se pudo eliminar");
      }
    } catch {
      showToast("error", "Error de conexión");
    }
  };

  const selectedReviews = items.filter((r) => bulk.isSelected(r.id));

  // Avisa el resultado de una acción masiva y deja marcadas solo las que
  // fallaron, para poder reintentar sin volver a elegirlas.
  const finishBulk = (done: Review[], failed: Review[], doneTitle: string) => {
    bulk.setSelection(failed.map((r) => r.id));
    if (failed.length === 0) {
      showToast("success", doneTitle, countLabel(done.length, "reseña", "reseñas"));
    } else {
      showToast(
        done.length > 0 ? "warning" : "error",
        done.length > 0 ? `${doneTitle} con errores` : "No se pudo completar",
        `${done.length} listas, ${failed.length} con error (quedaron seleccionadas).`
      );
    }
    loadItems();
  };

  // Aprobar/ocultar manda el mismo PUT (y los mismos cinco campos) que el
  // botón de cada reseña en updateReview, con isApproved cambiado.
  const bulkSetApproved = async (isApproved: boolean) => {
    const targets = selectedReviews.filter((r) => r.isApproved !== isApproved);
    if (targets.length === 0) return;
    setBulkBusy(true);
    const { done, failed } = await runBulk(targets, async (r) => {
      const res = await fetch(`/api/reviews/${r.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: r.authorName,
          rating: r.rating,
          comment: r.comment,
          isApproved,
          order: r.order,
        }),
      });
      return res.ok;
    });
    setBulkBusy(false);
    finishBulk(done, failed, isApproved ? "Reseñas aprobadas" : "Reseñas ocultadas");
  };

  const bulkDelete = async () => {
    const targets = selectedReviews;
    if (targets.length === 0) return;
    const ok = await confirm({
      title: "Eliminar reseñas",
      message: `¿Eliminar ${countLabel(targets.length, "reseña", "reseñas")}? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    setBulkBusy(true);
    const { done, failed } = await runBulk(targets, async (r) => {
      const res = await fetch(`/api/reviews/${r.id}`, { method: "DELETE" });
      return res.ok;
    });
    setBulkBusy(false);
    finishBulk(done, failed, "Reseñas eliminadas");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando reseñas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {ConfirmDialog}

      <div className="mx-auto max-w-6xl">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Reseñas</h1>
          <p className="text-charcoal/50 text-sm mt-1">
            Aprobá las reseñas que dejaron tus clientes para que se muestren en tu sitio público.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-mauve/10 rounded-xl">
            <p className="text-charcoal/40 text-lg">Todavía no hay reseñas</p>
          </div>
        ) : (
          <>
          <BulkActionBar
            count={bulk.count}
            total={items.length}
            allSelected={bulk.allSelected}
            someSelected={bulk.someSelected}
            onToggleAll={bulk.toggleAll}
            onClear={bulk.clear}
            busy={bulkBusy}
            singular="reseña"
            plural="reseñas"
            feminine
            testIdPrefix="review"
            actions={[
              { key: "approve", label: "Aprobar", onClick: () => bulkSetApproved(true), hidden: selectedReviews.every((r) => r.isApproved) },
              { key: "hide", label: "Ocultar", onClick: () => bulkSetApproved(false), hidden: selectedReviews.every((r) => !r.isApproved) },
              { key: "delete", label: "Eliminar", onClick: bulkDelete, variant: "danger" },
            ]}
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                data-testid="review-card"
                className={`bg-ivory border rounded-xl p-4 transition ${item.isApproved ? "border-mauve/15" : "border-orange-200 opacity-90"} ${bulk.isSelected(item.id) ? "ring-2 ring-blush" : ""}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <BulkCheckbox
                    checked={bulk.isSelected(item.id)}
                    onChange={() => bulk.toggle(item.id)}
                    disabled={bulkBusy}
                    label={`Seleccionar reseña de ${item.authorName || "Cliente anónimo"}`}
                    data-testid="review-select"
                    className="-ml-2.5 -mt-2.5"
                  />
                  <div className="text-champagne text-lg leading-none flex-1 min-w-0">
                    {"★".repeat(item.rating) + "☆".repeat(5 - item.rating)}
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${item.isApproved ? "bg-green-500/20 text-green-700" : "bg-orange-500/20 text-orange-700"}`}>
                    {item.isApproved ? "APROBADA" : "PENDIENTE"}
                  </span>
                </div>

                {item.comment && (
                  <p className="text-charcoal/80 text-sm mt-2 whitespace-pre-line">{item.comment}</p>
                )}

                <div className="flex items-center justify-between gap-2 mt-3">
                  <p className="text-charcoal/50 text-xs">{item.authorName || "Cliente anónimo"}</p>
                  <p className="text-charcoal/40 text-[10px] uppercase tracking-wider">{SOURCE_LABELS[item.source]}</p>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <label className="text-charcoal/40 text-[10px] uppercase tracking-wider">Orden</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input w-20 py-1 text-sm"
                    value={item.order}
                    onChange={(e) => {
                      const order = parseInt(e.target.value) || 0;
                      setItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, order } : r)));
                    }}
                    onBlur={(e) => updateReview(item, { order: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => updateReview(item, { isApproved: !item.isApproved })}
                    disabled={savingId === item.id}
                    variant={item.isApproved ? "secondary" : "primary"}
                    size="sm"
                    className="flex-1"
                  >
                    {item.isApproved ? "Ocultar" : "Aprobar"}
                  </Button>
                  {deleteConfirmId === item.id ? (
                    <div className="flex gap-1">
                      <Button onClick={() => handleDelete(item.id)} variant="danger" size="sm">
                        Confirmar
                      </Button>
                      <Button onClick={() => setDeleteConfirmId(null)} variant="secondary" size="sm">
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={() => setDeleteConfirmId(item.id)} variant="danger" size="sm">
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
