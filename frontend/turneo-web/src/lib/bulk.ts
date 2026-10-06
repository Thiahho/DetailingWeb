export interface BulkResult<T> {
  done: T[];
  failed: T[];
}

/**
 * Aplica `action` a cada item, de a uno (los endpoints del panel son por
 * registro; en paralelo se pisan con el rate limit y con el orden de
 * revalidación de las rutas proxy). Un registro que falla no corta el resto:
 * queda en `failed` para poder avisar "N listos, M con error".
 *
 * `action` devuelve si salió bien; una excepción (red caída) cuenta como fallo.
 */
export async function runBulk<T>(items: T[], action: (item: T) => Promise<boolean>): Promise<BulkResult<T>> {
  const done: T[] = [];
  const failed: T[] = [];
  for (const item of items) {
    let ok = false;
    try {
      ok = await action(item);
    } catch {
      ok = false;
    }
    (ok ? done : failed).push(item);
  }
  return { done, failed };
}

/** "3 servicios" / "1 servicio". */
export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
