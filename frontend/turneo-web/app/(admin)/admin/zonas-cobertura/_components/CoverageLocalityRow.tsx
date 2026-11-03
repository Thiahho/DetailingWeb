"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import {
  formatSurcharge,
  parseSurcharge,
  type CoverageLocality,
  type CoverageLocalityRequest,
} from "@/src/lib/homeService/coverageLocality";

export default function CoverageLocalityRow({
  locality,
  busy,
  onSave,
  onDelete,
}: {
  locality: CoverageLocality;
  busy: boolean;
  onSave: (locality: CoverageLocality, patch: Partial<CoverageLocalityRequest>) => Promise<boolean>;
  onDelete: (locality: CoverageLocality) => void;
}) {
  const [surchargeInput, setSurchargeInput] = useState(() => formatSurcharge(locality.surcharge));
  const [error, setError] = useState("");

  const parsed = parseSurcharge(surchargeInput);
  const dirty = "message" in parsed || parsed.value !== locality.surcharge;

  const saveSurcharge = async () => {
    // `in` narrowing: tsconfig has strict off, so `!parsed.ok` does not narrow the union.
    if ("message" in parsed) {
      setError(parsed.message);
      return;
    }
    setError("");
    if (await onSave(locality, { surcharge: parsed.value })) setSurchargeInput(formatSurcharge(parsed.value));
  };

  return (
    <li
      data-testid="coverage-row"
      data-locality-name={locality.name}
      className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 ${locality.isActive ? "" : "opacity-60"}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-charcoal">{locality.name}</p>
        <p className="truncate text-xs text-charcoal/50">{locality.province}</p>
      </div>

      <form
        className="flex flex-col gap-1 sm:w-64"
        onSubmit={(e) => {
          e.preventDefault();
          saveSurcharge();
        }}
      >
        <label className="sr-only" htmlFor={`surcharge-${locality.id}`}>
          Recargo de {locality.name}
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-charcoal/40">$</span>
            <input
              id={`surcharge-${locality.id}`}
              className="form-input !py-2 !pl-7"
              data-testid="coverage-surcharge"
              inputMode="decimal"
              value={surchargeInput}
              onChange={(e) => {
                setSurchargeInput(e.target.value);
                setError("");
              }}
              placeholder="Sin recargo"
              disabled={busy}
            />
          </div>
          {dirty && (
            <Button type="submit" size="sm" data-testid="coverage-surcharge-save" disabled={busy}>
              Guardar
            </Button>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal/70">
          <input
            type="checkbox"
            className="size-4 accent-blushdark"
            data-testid="coverage-active"
            checked={locality.isActive}
            onChange={(e) => onSave(locality, { isActive: e.target.checked })}
            disabled={busy}
          />
          Activa
        </label>
        <button
          type="button"
          data-testid="coverage-delete"
          onClick={() => onDelete(locality)}
          disabled={busy}
          className="rounded-lg p-2 text-charcoal/40 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          aria-label={`Quitar ${locality.name}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}
