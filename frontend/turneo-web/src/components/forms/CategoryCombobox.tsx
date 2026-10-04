"use client";

import { useState } from "react";
import { Button } from "@/src/components/shared/Button";
import Autocomplete, { normalize } from "./Autocomplete";

export { normalize };

/** Valores distintos (case/acento-insensible), ordenados, para usar como sugerencias. */
export function distinctCategories(values: (string | null | undefined)[]): string[] {
  const seen = new Map<string, string>();
  for (const v of values) {
    const t = v?.trim();
    if (t && !seen.has(normalize(t))) seen.set(normalize(t), t);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "es"));
}

export default function CategoryCombobox({
  value,
  onChange,
  suggestions,
  testId,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  testId?: string;
  placeholder?: string;
}) {
  // Categorías agregadas con "Agregar +" en este formulario (aún no guardadas en ningún registro).
  const [added, setAdded] = useState<string[]>([]);
  const options = distinctCategories([...suggestions, ...added]);

  const typed = value.trim();
  const existing = options.find((o) => normalize(o) === normalize(typed));
  const canAdd = typed !== "" && !existing;

  const handleAdd = () => {
    if (!canAdd) return;
    setAdded((prev) => [...prev, typed]);
    onChange(typed);
  };

  return (
    <div className="mt-1.5">
      <Autocomplete
        value={value}
        onChange={onChange}
        options={options.map((o) => ({ value: o }))}
        testId={testId}
        placeholder={placeholder}
      />
      {canAdd && (
        <Button
          type="button"
          onClick={handleAdd}
          data-testid={testId ? `${testId}-add` : undefined}
          variant="secondary"
          size="sm"
          className="mt-1.5"
        >
          Agregar {typed} +
        </Button>
      )}
    </div>
  );
}
