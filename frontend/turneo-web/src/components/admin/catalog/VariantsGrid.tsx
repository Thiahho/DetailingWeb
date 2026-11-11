"use client";

import { useState } from "react";
import { Button } from "@/src/components/shared/Button";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import { labelClass } from "./CatalogShell";
import { catalogRequest } from "@/src/lib/catalog/api";
import { AVAILABILITY_OPTIONS, toAvailability } from "@/src/lib/catalog/enums";
import { attributesForCategory, variantLabel } from "@/src/lib/catalog/ordering";
import { buildBulkVariantsPayload, bulkVariantsNotice, type BulkVariantsChange } from "@/src/lib/catalog/payloads";
import type { CatalogAttribute, CatalogAvailability, CatalogVariant } from "@/src/lib/catalog/types";

// Variants of a saved product: availability and active flag per variant, plus
// bulk changes for every variant matching the chosen values (e.g. every "Rojo"
// → A pedido, or every "XL" turned off).
export default function VariantsGrid({
  productId,
  variants,
  allowedValueIds,
  categoryAttributeIds,
  attributes,
  onVariantChange,
  onReload,
  onError,
  onNotice,
}: {
  productId: number;
  variants: CatalogVariant[];
  allowedValueIds: number[];
  categoryAttributeIds: number[];
  attributes: CatalogAttribute[];
  onVariantChange: (variant: CatalogVariant) => void;
  onReload: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const [showInactive, setShowInactive] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkValues, setBulkValues] = useState<Record<number, number>>({});
  const [bulkAvailability, setBulkAvailability] = useState<CatalogAvailability>(1);
  const [bulkBusy, setBulkBusy] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  // Only attributes/values the product actually combines can filter the bulk update.
  const filterAttributes = attributesForCategory(categoryAttributeIds, attributes)
    .map((a) => ({ ...a, values: a.values.filter((v) => allowedValueIds.includes(v.id)) }))
    .filter((a) => a.values.length > 0);

  const inactiveCount = variants.filter((v) => !v.isActive).length;
  const shown = variants.filter((v) => showInactive || v.isActive);

  const patch = async (variant: CatalogVariant, body: { availability?: CatalogAvailability; isActive?: boolean }) => {
    setBusyId(variant.id);
    const result = await catalogRequest<CatalogVariant>(`variants/${variant.id}`, {
      method: "PATCH",
      body,
      fallback: "No se pudo actualizar la variante",
    });
    setBusyId(null);
    if (result.ok) onVariantChange(result.data);
    else onError(result.message);
  };

  const applyBulk = async (change: BulkVariantsChange) => {
    setBulkBusy(true);
    const result = await catalogRequest<{ updated: number }>("variants/bulk", {
      method: "PATCH",
      body: buildBulkVariantsPayload(productId, bulkValues, change),
      fallback: "No se pudo aplicar el cambio",
    });
    setBulkBusy(false);
    if (!result.ok) {
      onError(result.message);
      return;
    }
    onNotice(bulkVariantsNotice(change, result.data.updated));
    onReload();
  };

  // Without a chosen value the change reaches every active variant, which
  // takes the product off the public catalog: ask first.
  const deactivateBulk = async () => {
    const activeCount = variants.length - inactiveCount;
    if (Object.keys(bulkValues).length === 0 && activeCount > 0) {
      const ok = await confirm({
        title: "Desactivar todas las variantes",
        message:
          activeCount === 1
            ? "No elegiste ningún valor: se va a desactivar la única variante activa del producto. ¿Continuar?"
            : `No elegiste ningún valor: se van a desactivar las ${activeCount} variantes activas del producto. ¿Continuar?`,
        confirmLabel: "Desactivar todas",
      });
      if (!ok) return;
    }
    await applyBulk({ isActive: false });
  };

  if (variants.length === 0) {
    return <p className="text-charcoal/40 text-sm">No hay variantes. Se generan al guardar el producto.</p>;
  }

  return (
    <div className="space-y-4">
      {ConfirmDialog}
      <div className="rounded-xl border border-mauve/10 bg-white/60 p-4">
        <p className={`${labelClass} mb-2`}>Cambios masivos</p>
        <div className="flex flex-wrap items-end gap-2">
          {filterAttributes.map((attribute) => (
            <select
              key={attribute.id}
              className="form-input w-auto"
              value={bulkValues[attribute.id] ?? ""}
              onChange={(e) => {
                const id = parseInt(e.target.value);
                setBulkValues((prev) => {
                  const next = { ...prev };
                  if (id) next[attribute.id] = id;
                  else delete next[attribute.id];
                  return next;
                });
              }}
              aria-label={attribute.name}
            >
              <option value="">{attribute.name}: todos</option>
              {attribute.values.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          ))}
          <select
            className="form-input w-auto"
            value={bulkAvailability}
            onChange={(e) => setBulkAvailability(toAvailability(e.target.value) ?? 0)}
            aria-label="Disponibilidad"
          >
            {AVAILABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => applyBulk({ availability: bulkAvailability })}
            disabled={bulkBusy}
          >
            {bulkBusy ? "Aplicando..." : "Aplicar a las activas"}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-mauve/10 pt-3">
          <Button type="button" size="sm" variant="secondary" onClick={deactivateBulk} disabled={bulkBusy}>
            Desactivar
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => applyBulk({ isActive: true })} disabled={bulkBusy}>
            Activar las desactivadas a mano
          </Button>
        </div>
        <p className="mt-2 text-charcoal/40 text-xs">
          Los cambios alcanzan a las variantes que tienen los valores elegidos. Sin valores elegidos, a todas.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-mauve/5 bg-ivory">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mauve/5 text-charcoal/30 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-2.5 font-medium">Variante</th>
              <th className="text-left px-4 py-2.5 font-medium">SKU</th>
              <th className="text-left px-4 py-2.5 font-medium">Disponibilidad</th>
              <th className="text-left px-4 py-2.5 font-medium">Activa</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((variant) => (
              <tr key={variant.id} className={`border-b border-mauve/5 last:border-0 ${variant.isActive ? "" : "opacity-60"}`}>
                <td className="px-4 py-2 text-charcoal">{variantLabel(variant.valueIds, categoryAttributeIds, attributes)}</td>
                <td className="px-4 py-2 font-mono text-xs text-charcoal/50">{variant.sku}</td>
                <td className="px-4 py-2">
                  <select
                    className="form-input w-auto py-1 text-xs"
                    value={variant.availability}
                    onChange={(e) => {
                      const availability = toAvailability(e.target.value);
                      if (availability !== null) patch(variant, { availability });
                    }}
                    disabled={busyId === variant.id}
                    aria-label="Disponibilidad"
                  >
                    {AVAILABILITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-blush"
                    checked={variant.isActive}
                    onChange={(e) => patch(variant, { isActive: e.target.checked })}
                    disabled={busyId === variant.id}
                    aria-label="Variante activa"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inactiveCount > 0 && (
        <button type="button" className="text-xs text-blushdark hover:text-blush" onClick={() => setShowInactive((v) => !v)}>
          {showInactive ? "Ocultar inactivas" : `Mostrar inactivas (${inactiveCount})`}
        </button>
      )}
      <p className="text-charcoal/40 text-xs">
        Al guardar el producto se vuelven a generar las combinaciones: las que ya no corresponden se desactivan y vuelven a
        activarse solas si vuelven a corresponder. Una variante que desactivas a mano queda desactivada, aunque edites el
        producto o la categoría, hasta que la vuelvas a activar.
      </p>
    </div>
  );
}
