// Caché en localStorage de datos públicos (catálogo, config del sitio, etc.)
// para que la segunda visita pinte al instante en vez de esperar al fetch a
// la API. Gateada por consentimiento explícito de la categoría "preferences"
// (ver src/lib/consent.ts) — sin esa decisión, get/set son no-ops y el
// comportamiento es idéntico al de antes de este módulo.
import { hasConsent } from "@/src/lib/consent";

const PREFIX = "turneo:cache:v1";

interface CacheEntry<T> {
  ts: number;
  data: T;
}

// Todo bajo el host actual: el mismo deploy sirve a todos los tenants
// (ver src/lib/tenantHeader.ts) diferenciados por Host — sin esto, la caché
// de un negocio se le mostraría a otro en el mismo navegador (ej. localhost
// en dev, o alguien probando dos subdominios en la misma máquina).
function storageKey(key: string): string | null {
  if (typeof window === "undefined") return null;
  return `${PREFIX}:${window.location.host}:${key}`;
}

// Devuelve el valor cacheado si existe, tiene el consentimiento activo y no
// superó maxAgeMs. try/catch porque localStorage puede tirar en modo
// privado o con la cuota llena — nunca debe romper el render por esto.
export function getCached<T>(key: string, maxAgeMs: number): T | null {
  if (!hasConsent("preferences")) return null;
  const fullKey = storageKey(key);
  if (!fullKey) return null;
  try {
    const raw = localStorage.getItem(fullKey);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.ts > maxAgeMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function setCached<T>(key: string, data: T): void {
  if (!hasConsent("preferences")) return;
  const fullKey = storageKey(key);
  if (!fullKey) return;
  try {
    const entry: CacheEntry<T> = { ts: Date.now(), data };
    localStorage.setItem(fullKey, JSON.stringify(entry));
  } catch {
    // Cuota llena / modo privado — no es crítico, simplemente no cachea.
  }
}

// Invalida una sola entrada — usar cuando el dato de origen cambió por una
// acción explícita (ej. el admin edita la configuración del sitio) y no
// conviene esperar a que expire maxAgeMs.
export function removeCached(key: string): void {
  const fullKey = storageKey(key);
  if (!fullKey) return;
  try {
    localStorage.removeItem(fullKey);
  } catch {
    // Nada que hacer si localStorage no está disponible.
  }
}

// Se llama al revocar la categoría "preferences" desde el panel de
// preferencias, para no dejar datos cacheados sin consentimiento vigente.
export function clearPublicDataCache(): void {
  if (typeof window === "undefined") return;
  try {
    const prefix = `${PREFIX}:${window.location.host}:`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) localStorage.removeItem(k);
    }
  } catch {
    // Nada que hacer si localStorage no está disponible.
  }
}
