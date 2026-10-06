import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Selección múltiple para los listados del panel. `ids` son los registros
 * seleccionables que se están mostrando (ya filtrados): "seleccionar todos"
 * actúa sobre esos, y un id que deja de existir (se borró, cambió el filtro)
 * se saca solo de la selección.
 */
export function useBulkSelection(ids: number[]) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Clave estable: `ids` suele ser un array nuevo en cada render.
  const idsKey = ids.join(",");

  useEffect(() => {
    const present = new Set(ids);
    setSelectedIds((prev) => {
      const next = prev.filter((id) => present.has(id));
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const isSelected = useCallback((id: number) => selectedSet.has(id), [selectedSet]);

  const toggle = useCallback((id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const allSelected = ids.length > 0 && ids.every((id) => selectedSet.has(id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    setSelectedIds(allSelected ? [] : [...ids]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSelected, idsKey]);

  const clear = useCallback(() => setSelectedIds([]), []);

  // Tras una acción masiva con errores parciales: deja marcados solo los que fallaron.
  const setSelection = useCallback((next: number[]) => setSelectedIds(next), []);

  return {
    selectedIds,
    count: selectedIds.length,
    isSelected,
    toggle,
    toggleAll,
    allSelected,
    someSelected,
    clear,
    setSelection,
  };
}
