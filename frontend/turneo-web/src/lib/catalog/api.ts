import { apiErrorMessage } from "./payloads";

// Client-side calls to the catalog proxy (app/api/catalog/[...path]).
// A flat shape instead of a discriminated union: the project compiles with
// `strict: false`, where `ok: true | false` does not narrow.
export interface CatalogResult<T> {
  ok: boolean;
  data: T;
  status: number;
  message: string;
}

export async function catalogRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; fallback?: string } = {}
): Promise<CatalogResult<T>> {
  const { method = "GET", body, fallback = "No se pudo completar la operación" } = options;
  try {
    const res = await fetch(`/api/catalog/${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: data as T, status: res.status, message: "" };
    return { ok: false, data: null, status: res.status, message: apiErrorMessage(data, fallback) };
  } catch {
    return { ok: false, data: null, status: 0, message: "No se pudo conectar con el servidor" };
  }
}
