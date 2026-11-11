// Request bodies for the catalog admin endpoints. Slugs are omitted on
// purpose: the backend derives them from the name.

function trimOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function uniqueSorted(ids: number[]): number[] {
  return Array.from(new Set(ids)).sort((a, b) => a - b);
}

// Keeps the first occurrence: the order is meaningful (variant combination order).
function uniqueInOrder(ids: number[]): number[] {
  return Array.from(new Set(ids));
}

export interface ProductFormValues {
  categoryId: number;
  name: string;
  description: string;
  price: number | null;
  sortOrder: number;
  isActive: boolean;
  allowedValueIds: number[];
}

export function buildProductPayload(form: ProductFormValues) {
  return {
    categoryId: form.categoryId,
    name: form.name.trim(),
    description: trimOrNull(form.description),
    price: form.price,
    sortOrder: form.sortOrder,
    isActive: form.isActive,
    allowedValueIds: uniqueSorted(form.allowedValueIds),
  };
}

export interface CategoryFormValues {
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  attributeIds: number[];
}

export function buildCategoryPayload(form: CategoryFormValues) {
  return {
    name: form.name.trim(),
    description: trimOrNull(form.description),
    sortOrder: form.sortOrder,
    isActive: form.isActive,
    attributeIds: uniqueInOrder(form.attributeIds),
  };
}

export interface ValueFormValues {
  label: string;
  sortOrder: number;
  colorHex: string;
}

export function buildValuePayload(form: ValueFormValues) {
  const color = form.colorHex.trim();
  return {
    label: form.label.trim(),
    sortOrder: form.sortOrder,
    colorHex: color === "" ? null : color.toUpperCase(),
  };
}

// Backend errors come as `{ success: false, message }` (404/409/400 from the
// controllers) or as ASP.NET ProblemDetails `{ errors: { Field: [msg] } }`
// (DataAnnotations validation).
export function apiErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const body = data as { message?: unknown; errors?: unknown };
  if (typeof body.message === "string" && body.message.trim() !== "") return body.message;
  if (body.errors && typeof body.errors === "object") {
    for (const messages of Object.values(body.errors as Record<string, unknown>)) {
      if (Array.isArray(messages) && typeof messages[0] === "string") return messages[0];
    }
  }
  return fallback;
}
