"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { fetchLocalidades, type LocalidadSuggestion } from "@/src/lib/geo/geo";

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

// Georef locality search: debounced, and every new keystroke aborts the
// previous request so a slow answer never overwrites a newer one.
export default function LocalitySearch({
  onPick,
  disabled,
}: {
  onPick: (suggestion: LocalidadSuggestion) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LocalidadSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  // Keyboard-highlighted suggestion; -1 = none (Enter then picks the first one).
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setItems([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      setFailed(false);
      fetchLocalidades(q, controller.signal)
        .then((found) => {
          setItems(Array.isArray(found) ? found : []);
          setActive(-1);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setItems([]);
          setFailed(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const pick = (suggestion: LocalidadSuggestion) => {
    onPick(suggestion);
    setQuery("");
    setItems([]);
    setOpen(false);
  };

  const showList = open && query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-charcoal/40" />
      <input
        className="form-input !pl-11"
        data-testid="coverage-search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (!showList || items.length === 0) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((prev) => (prev + step + items.length) % items.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(items[Math.max(active, 0)]);
          }
        }}
        placeholder="Buscá una localidad, ej. Quilmes"
        aria-label="Buscar localidad"
        autoComplete="off"
        disabled={disabled}
      />
      {showList && (
        <ul
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-mauve/15 bg-ivory py-1 shadow-lg"
          role="listbox"
        >
          {searching && items.length === 0 && <li className="px-4 py-2.5 text-sm text-charcoal/50">Buscando...</li>}
          {!searching && failed && (
            <li className="px-4 py-2.5 text-sm text-red-600">No se pudo buscar. Probá de nuevo en unos segundos.</li>
          )}
          {!searching && !failed && items.length === 0 && (
            <li className="px-4 py-2.5 text-sm text-charcoal/50">No encontramos localidades con ese nombre</li>
          )}
          {items.map((item, index) => (
            <li key={`${item.nombre}|${item.partido}|${item.provincia}`} role="option" aria-selected={index === active}>
              <button
                type="button"
                data-testid="coverage-suggestion"
                // mousedown instead of click: the input blur closes the list before a click lands.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(item);
                }}
                tabIndex={-1}
                className={`w-full px-4 py-2.5 text-left transition hover:bg-blush/10 ${index === active ? "bg-blush/10" : ""}`}
              >
                <span className="block text-sm font-medium text-charcoal">{item.nombre}</span>
                <span className="block text-xs text-charcoal/50">
                  {[item.partido, item.provincia].filter(Boolean).join(", ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
