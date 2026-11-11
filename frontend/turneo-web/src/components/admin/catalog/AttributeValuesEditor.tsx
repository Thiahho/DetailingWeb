"use client";

import { useState } from "react";
import { Button } from "@/src/components/shared/Button";
import type { ConfirmOptions } from "@/src/components/shared/ConfirmDialog";
import { catalogRequest } from "@/src/lib/catalog/api";
import { buildValuePayload, type ValueFormValues } from "@/src/lib/catalog/payloads";
import type { CatalogAttribute, CatalogAttributeValue } from "@/src/lib/catalog/types";

const HEX = /^#[0-9A-Fa-f]{6}$/;

function ValueRow({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ValueFormValues;
  submitLabel: string;
  onSubmit: (values: ValueFormValues) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const colorValid = values.colorHex.trim() === "" || HEX.test(values.colorHex.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colorValid) return;
    setSaving(true);
    const ok = await onSubmit(values);
    setSaving(false);
    if (ok && !onCancel) setValues({ label: "", sortOrder: values.sortOrder + 1, colorHex: "" });
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        className="form-input flex-1 min-w-[8rem]"
        value={values.label}
        onChange={(e) => setValues((prev) => ({ ...prev, label: e.target.value }))}
        placeholder="Etiqueta (ej. Rojo, M)"
        aria-label="Etiqueta"
        maxLength={80}
        required
      />
      <input
        type="number"
        min={0}
        className="form-input w-20"
        value={values.sortOrder}
        onChange={(e) => setValues((prev) => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
        aria-label="Orden"
        title="Orden"
      />
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          className="h-9 w-9 rounded border border-mauve/15 bg-white p-0.5"
          value={HEX.test(values.colorHex) ? values.colorHex : "#000000"}
          onChange={(e) => setValues((prev) => ({ ...prev, colorHex: e.target.value.toUpperCase() }))}
          aria-label="Elegir color"
        />
        <input
          className={`form-input w-28 ${colorValid ? "" : "border-red-400"}`}
          value={values.colorHex}
          onChange={(e) => setValues((prev) => ({ ...prev, colorHex: e.target.value }))}
          placeholder="#RRGGBB"
          aria-label="Color (opcional)"
          title="Color opcional en formato #RRGGBB"
        />
      </div>
      <Button type="submit" size="sm" variant="primary" disabled={saving || !colorValid}>
        {saving ? "..." : submitLabel}
      </Button>
      {onCancel && (
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      )}
    </form>
  );
}

export default function AttributeValuesEditor({
  attribute,
  onChanged,
  onError,
  confirm,
}: {
  attribute: CatalogAttribute;
  onChanged: () => void;
  onError: (message: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);

  const save = async (path: string, method: string, values: ValueFormValues) => {
    const result = await catalogRequest<CatalogAttributeValue>(path, {
      method,
      body: buildValuePayload(values),
      fallback: "No se pudo guardar el valor",
    });
    if (!result.ok) {
      onError(result.message);
      return false;
    }
    setEditingId(null);
    onChanged();
    return true;
  };

  const remove = async (value: CatalogAttributeValue) => {
    const ok = await confirm({ title: "Eliminar valor", message: `¿Eliminar "${value.label}"?`, confirmLabel: "Eliminar" });
    if (!ok) return;
    const result = await catalogRequest(`attribute-values/${value.id}`, { method: "DELETE", fallback: "No se pudo eliminar" });
    if (result.ok) onChanged();
    else onError(result.message);
  };

  return (
    <div className="space-y-2">
      {attribute.values.length === 0 && <p className="text-charcoal/40 text-sm">Todavía no tiene valores.</p>}
      {attribute.values.map((value) =>
        editingId === value.id ? (
          <ValueRow
            key={value.id}
            initial={{ label: value.label, sortOrder: value.sortOrder, colorHex: value.colorHex ?? "" }}
            submitLabel="Guardar"
            onSubmit={(values) => save(`attribute-values/${value.id}`, "PUT", values)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div key={value.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/60 border border-mauve/5 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              {value.colorHex && (
                <span className="h-4 w-4 shrink-0 rounded-full border border-mauve/20" style={{ backgroundColor: value.colorHex }} aria-hidden />
              )}
              <span className="text-charcoal text-sm truncate">{value.label}</span>
              <span className="text-charcoal/30 text-xs">#{value.sortOrder}</span>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="secondary" onClick={() => setEditingId(value.id)}>
                Editar
              </Button>
              <Button size="sm" variant="danger" onClick={() => remove(value)}>
                Eliminar
              </Button>
            </div>
          </div>
        )
      )}
      <div className="pt-2 border-t border-mauve/5">
        <p className="text-charcoal/50 text-xs mb-1.5">Agregar valor</p>
        <ValueRow
          initial={{ label: "", sortOrder: attribute.values.length, colorHex: "" }}
          submitLabel="Agregar"
          onSubmit={(values) => save(`attributes/${attribute.id}/values`, "POST", values)}
        />
      </div>
    </div>
  );
}
