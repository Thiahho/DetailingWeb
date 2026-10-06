"use client";

import { useEffect, useRef } from "react";

interface BulkCheckboxProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  indeterminate?: boolean;
  disabled?: boolean;
  "data-testid"?: string;
  className?: string;
}

/**
 * Casilla de selección de un registro (o la de "seleccionar todos"). El área
 * táctil es de 40px aunque la casilla se vea de 18px: en celular se usa con
 * el dedo sobre cards que además tienen otros botones.
 */
export function BulkCheckbox({
  checked,
  onChange,
  label,
  indeterminate = false,
  disabled = false,
  className = "",
  ...rest
}: BulkCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <label
      className={`inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg transition hover:bg-porcelain/60 ${
        disabled ? "cursor-not-allowed opacity-40" : ""
      } ${className}`}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={label}
        data-testid={rest["data-testid"]}
        className="h-[18px] w-[18px] cursor-pointer accent-blushdark"
      />
    </label>
  );
}

export interface BulkAction {
  key: string;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  // Oculta la acción cuando no aplica a nada de lo seleccionado (p. ej.
  // "Activar" si todo lo marcado ya está activo).
  hidden?: boolean;
}

interface BulkActionBarProps {
  // Cantidad seleccionada y total seleccionable (lo que se ve con el filtro actual).
  count: number;
  total: number;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onClear: () => void;
  actions: BulkAction[];
  // Mientras corre una acción: deshabilita todo y muestra el progreso.
  busy?: boolean;
  // "servicio" / "servicios" — para "3 servicios seleccionados".
  singular: string;
  plural: string;
  // Sustantivo femenino ("imagen", "reseña", "solicitud"): cambia la concordancia del texto.
  feminine?: boolean;
  // Prefijo de los data-testid: `${testIdPrefix}-select-all`, `-bulk-count`, `-bulk-${action.key}`.
  testIdPrefix: string;
}

/**
 * Barra de selección múltiple de los listados del panel. Siempre visible
 * arriba del listado (con el "seleccionar todos"); las acciones aparecen
 * recién cuando hay algo marcado. Es `sticky` para que quede a mano al
 * scrollear un listado largo — arriba y no abajo, porque en celular el borde
 * inferior ya lo ocupa la barra fija del panel.
 */
export default function BulkActionBar({
  count,
  total,
  allSelected,
  someSelected,
  onToggleAll,
  onClear,
  actions,
  busy = false,
  singular,
  plural,
  feminine = false,
  testIdPrefix,
}: BulkActionBarProps) {
  if (total === 0) return null;

  const visibleActions = actions.filter((a) => !a.hidden);
  const hasSelection = count > 0;
  const all = feminine ? "todas" : "todos";
  const selected = feminine ? "seleccionada" : "seleccionado";

  return (
    <div
      data-testid={`${testIdPrefix}-bulk-bar`}
      className={`sticky top-14 z-30 mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-2 py-1.5 transition md:top-2 ${
        hasSelection ? "border-blush/50 bg-ivory shadow-soft" : "border-mauve/10 bg-ivory/70"
      }`}
    >
      <BulkCheckbox
        checked={allSelected}
        indeterminate={someSelected}
        onChange={onToggleAll}
        disabled={busy}
        label={allSelected ? `Deseleccionar ${all} ${feminine ? "las" : "los"} ${plural}` : `Seleccionar ${all} ${feminine ? "las" : "los"} ${plural}`}
        data-testid={`${testIdPrefix}-select-all`}
      />

      <span className="text-sm text-charcoal/70" data-testid={`${testIdPrefix}-bulk-count`} aria-live="polite">
        {hasSelection ? (
          <>
            <span className="font-semibold text-charcoal">{count}</span> de {total}{" "}
            {count === 1 ? `${singular} ${selected}` : `${plural} ${selected}s`}
          </>
        ) : (
          `Seleccionar ${all} (${total})`
        )}
      </span>

      {hasSelection && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {busy && <span className="text-xs text-charcoal/50">Procesando…</span>}
          {visibleActions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              disabled={busy}
              data-testid={`${testIdPrefix}-bulk-${action.key}`}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold transition disabled:opacity-50 ${
                action.variant === "danger"
                  ? "bg-red-600 text-white hover:bg-red-500"
                  : "border border-mauve/20 bg-white text-charcoal hover:border-mauve/40"
              }`}
            >
              {action.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            className="min-h-[36px] rounded-lg px-2 text-xs font-medium text-charcoal/50 transition hover:text-charcoal disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
