"use client";

import { useCallback, useEffect, useState } from "react";
import { readConsent, writeConsent, type Consent } from "@/src/lib/consent";
import { clearPublicDataCache } from "@/src/lib/publicDataCache";

// `ready` arranca en false para que el primer render de cliente coincida con
// el del servidor (que no conoce cookies) — evita el warning de hidratación
// que daría leer document.cookie durante el render. La barra de consentimiento
// recién decide si se muestra una vez que ready pasa a true, en un useEffect.
export function useConsent() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);

    const onChange = () => setConsent(readConsent());
    // "consent-change": esta misma pestaña, disparado por writeConsent().
    // "storage": otra pestaña cambió la decisión (localStorage/cookie no
    // dispara "storage" para cookies, pero lo dejamos por si en el futuro
    // se lee vía localStorage; el sync entre pestañas real ocurre al
    // volver a montar el hook en cada navegación).
    window.addEventListener("consent-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("consent-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const save = useCallback((preferences: boolean, analytics: boolean) => {
    const next = writeConsent(preferences, analytics);
    if (!next.preferences) clearPublicDataCache();
    setConsent(next);
  }, []);

  const acceptAll = useCallback(() => save(true, true), [save]);
  const acceptOnlyNecessary = useCallback(() => save(false, false), [save]);

  return { consent, ready, save, acceptAll, acceptOnlyNecessary };
}
