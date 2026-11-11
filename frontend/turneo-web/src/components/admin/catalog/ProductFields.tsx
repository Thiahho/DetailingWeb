"use client";

import { labelClass } from "./CatalogShell";
import { formatPrice, parsePriceInput } from "@/src/lib/catalog/price";
import { attributesForCategory, toggleId } from "@/src/lib/catalog/ordering";
import type { CatalogAttribute, CatalogCategory } from "@/src/lib/catalog/types";

export interface ProductFormState {
  categoryId: number;
  name: string;
  description: string;
  priceInput: string;
  sortOrder: number;
  isActive: boolean;
  allowedValueIds: number[];
}

// Product fields plus the allowed values per attribute of the chosen category.
// Changing the category drops the values that do not belong to it.
export default function ProductFields({
  form,
  setForm,
  categories,
  attributes,
}: {
  form: ProductFormState;
  setForm: (update: (prev: ProductFormState) => ProductFormState) => void;
  categories: CatalogCategory[];
  attributes: CatalogAttribute[];
}) {
  const category = categories.find((c) => c.id === form.categoryId);
  const categoryAttributes = category ? attributesForCategory(category.attributeIds, attributes) : [];
  const price = parsePriceInput(form.priceInput);

  const changeCategory = (categoryId: number) => {
    const next = categories.find((c) => c.id === categoryId);
    const validIds = new Set(
      next ? attributesForCategory(next.attributeIds, attributes).flatMap((a) => a.values.map((v) => v.id)) : []
    );
    setForm((prev) => ({ ...prev, categoryId, allowedValueIds: prev.allowedValueIds.filter((id) => validIds.has(id)) }));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="product-name">Nombre</label>
          <input
            id="product-name"
            className="form-input mt-1.5"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Remera básica"
            maxLength={160}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="product-category">Categoría</label>
          <select
            id="product-category"
            className="form-input mt-1.5"
            value={form.categoryId || ""}
            onChange={(e) => changeCategory(parseInt(e.target.value) || 0)}
            required
          >
            <option value="">Elegí una categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.isActive ? "" : " (inactiva)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="product-description">Descripción</label>
        <textarea
          id="product-description"
          className="form-input mt-1.5 min-h-[88px]"
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          maxLength={2000}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="product-price">Precio (opcional)</label>
          <input
            id="product-price"
            inputMode="decimal"
            className={`form-input mt-1.5 ${price.ok ? "" : "border-red-400"}`}
            value={form.priceInput}
            onChange={(e) => setForm((prev) => ({ ...prev, priceInput: e.target.value }))}
            placeholder="Vacío = Consultar precio"
            aria-describedby="product-price-hint"
          />
          <p id="product-price-hint" className={`text-[11px] mt-1 ${price.ok ? "text-charcoal/40" : "text-red-600"}`}>
            {price.ok ? `En el sitio: ${formatPrice(price.value)}` : "Ingresá un número válido, ej. 1500 o 1.500,50"}
          </p>
        </div>
        <div>
          <label className={labelClass} htmlFor="product-order">Orden</label>
          <input
            id="product-order"
            type="number"
            min={0}
            className="form-input mt-1.5"
            value={form.sortOrder}
            onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="product-status">Estado</label>
          <select
            id="product-status"
            className="form-input mt-1.5"
            value={form.isActive ? "true" : "false"}
            onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === "true" }))}
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
      </div>

      {category && (
        <fieldset className="rounded-xl border border-mauve/10 p-4">
          <legend className={`${labelClass} px-1`}>Valores disponibles</legend>
          {categoryAttributes.length === 0 ? (
            <p className="text-charcoal/40 text-sm">Esta categoría no tiene atributos: el producto tiene una sola variante.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-charcoal/40 text-xs">
                Las variantes se generan combinando los valores marcados. Un atributo sin valores marcados no se combina.
              </p>
              {categoryAttributes.map((attribute) => (
                <div key={attribute.id}>
                  <p className="text-charcoal text-sm font-medium mb-1.5">{attribute.name}</p>
                  {attribute.values.length === 0 ? (
                    <p className="text-charcoal/40 text-xs">Sin valores cargados.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {attribute.values.map((value) => {
                        const checked = form.allowedValueIds.includes(value.id);
                        return (
                          <label
                            key={value.id}
                            className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition focus-within:ring-2 focus-within:ring-blush/40 ${
                              checked ? "border-blush bg-blush/10 text-blushdark" : "border-mauve/15 text-charcoal/60 hover:border-mauve/30"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              onChange={() => setForm((prev) => ({ ...prev, allowedValueIds: toggleId(prev.allowedValueIds, value.id) }))}
                            />
                            {value.colorHex && (
                              <span className="h-3 w-3 rounded-full border border-mauve/20" style={{ backgroundColor: value.colorHex }} aria-hidden />
                            )}
                            {value.label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}
