"use client";

import { useEffect, useId, useRef, useState } from "react";

const DIACRITICS_RE = new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g");
export const normalize = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(DIACRITICS_RE, "");

export interface AutocompleteOption {
  value: string;
  /** Texto secundario a la derecha (ej. "Stock: 4"). */
  hint?: string;
}

const MAX_VISIBLE = 8;

/**
 * Input con lista desplegable propia. Filtra por coincidencia desde el comienzo
 * del texto (ignora mayúsculas y acentos) y resalta la parte escrita.
 */
export default function Autocomplete({
  value,
  onChange,
  options,
  testId,
  placeholder,
  className = "form-input",
}: {
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  testId?: string;
  placeholder?: string;
  className?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const query = normalize(value);
  const filtered = options
    .filter((o) => normalize(o.value).startsWith(query))
    // Si lo escrito coincide exacto con la única opción, no hay nada que sugerir.
    .filter((o, _, arr) => !(arr.length === 1 && normalize(o.value) === query))
    .slice(0, MAX_VISIBLE);
  const visible = open && filtered.length > 0;

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!visible) {
      if (e.key === "ArrowDown") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(filtered[Math.min(active, filtered.length - 1)].value);
    } else if (e.key === "Escape") {
      // Cierra solo la lista, no el modal que la contiene.
      e.stopPropagation();
      setOpen(false);
    }
  };

  const typedLen = value.trim().length;

  return (
    <div ref={rootRef} className="relative">
      <input
        className={className}
        data-testid={testId}
        value={value}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {visible && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-mauve/15 bg-ivory p-1 shadow-lg shadow-charcoal/10"
        >
          {filtered.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                select(o.value);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                i === active ? "bg-blush/15 text-charcoal" : "text-charcoal/70"
              }`}
            >
              <span className="truncate">
                <span className="font-semibold text-blushdark">{o.value.slice(0, typedLen)}</span>
                {o.value.slice(typedLen)}
              </span>
              {o.hint && <span className="shrink-0 text-xs text-charcoal/40">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
