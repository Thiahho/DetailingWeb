"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/src/components/shared/Button";
import { useConsent } from "@/src/hooks/useConsent";

// Barra de consentimiento de cookies — no bloqueante a propósito (sin
// backdrop, no tapa el resto del sitio). Un modal acá penalizaría LCP/CLS y
// la tasa de reserva en /reservar, que es lo opuesto de lo que se busca al
// sumar la caché de src/lib/publicDataCache.ts. Se puede reabrir en
// cualquier momento con el botón "Preferencias de cookies" del footer
// (ver app/(public)/reservar/page.tsx), que dispara el evento "consent-open".
export default function CookieConsent() {
  const { consent, ready, save, acceptAll, acceptOnlyNecessary } = useConsent();
  const [forceOpen, setForceOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draftPreferences, setDraftPreferences] = useState(false);
  const [draftAnalytics, setDraftAnalytics] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = () => {
      setDraftPreferences(consent?.preferences ?? false);
      setDraftAnalytics(consent?.analytics ?? false);
      setExpanded(true);
      setForceOpen(true);
    };
    window.addEventListener("consent-open", onOpen);
    return () => window.removeEventListener("consent-open", onOpen);
  }, [consent]);

  const visible = ready && (forceOpen || consent === null);

  // Le avisa a los floats fijos (WhatsApp, Ruleta) cuánto lugar ocupa la
  // barra para que no queden tapados — ver app/globals.css. Se mide el alto
  // real (ResizeObserver) en vez de un valor fijo: en mobile el texto y los
  // botones envuelven en más líneas, así que un número fijo se quedaba corto
  // y tapaba el float de WhatsApp.
  useEffect(() => {
    if (!visible) {
      document.documentElement.style.removeProperty("--consent-bar-h");
      return;
    }
    const el = cardRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty("--consent-bar-h", `${el.offsetHeight + 16}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--consent-bar-h");
    };
  }, [visible, expanded]);

  if (!visible) return null;

  const close = () => {
    setForceOpen(false);
    setExpanded(false);
  };

  const handleAcceptAll = () => {
    acceptAll();
    close();
  };

  const handleOnlyNecessary = () => {
    acceptOnlyNecessary();
    close();
  };

  const handleOpenPreferences = () => {
    setDraftPreferences(consent?.preferences ?? false);
    setDraftAnalytics(consent?.analytics ?? false);
    setExpanded(true);
  };

  const handleSave = () => {
    save(draftPreferences, draftAnalytics);
    close();
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Consentimiento de cookies"
      data-testid="cookie-banner"
      className="fixed inset-x-0 bottom-0 z-[9998] px-3 pb-3 sm:px-6 sm:pb-4"
    >
      <div ref={cardRef} className="glass-card mx-auto max-w-3xl border-mauve/20 bg-ivory p-4 shadow-elevated sm:p-5">
        <p className="text-xs leading-relaxed text-charcoal/80 sm:text-sm">
          Usamos cookies necesarias y, si aceptás, de preferencias para cargar más rápido.{" "}
          <a href="/privacidad" className="underline hover:text-charcoal">
            Más info
          </a>
          .
        </p>

        {expanded && (
          <div className="mt-3 space-y-2.5 border-t border-mauve/10 pt-3 sm:mt-4 sm:space-y-3 sm:pt-4">
            <label className="flex items-start gap-2.5 text-xs text-charcoal/70 sm:text-sm">
              <input type="checkbox" checked disabled className="mt-0.5 shrink-0" />
              <span>
                <span className="font-semibold text-charcoal">Necesarias</span> — sesión y esta misma decisión.
                Siempre activas.
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-xs text-charcoal/70 sm:text-sm">
              <input
                type="checkbox"
                data-testid="cookie-toggle-preferences"
                checked={draftPreferences}
                onChange={(e) => setDraftPreferences(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span>
                <span className="font-semibold text-charcoal">Preferencias</span> — cachean el catálogo para
                cargar más rápido.
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-xs text-charcoal/70 sm:text-sm">
              <input
                type="checkbox"
                data-testid="cookie-toggle-analytics"
                checked={draftAnalytics}
                onChange={(e) => setDraftAnalytics(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span>
                <span className="font-semibold text-charcoal">Analítica</span> — sin uso hoy, reservada a futuro.
              </span>
            </label>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          {expanded ? (
            <Button data-testid="cookie-save" onClick={handleSave} size="sm" className="w-full sm:w-auto">
              Guardar preferencias
            </Button>
          ) : (
            <>
              <Button
                data-testid="cookie-accept-all"
                onClick={handleAcceptAll}
                size="sm"
                className="w-full sm:w-auto"
              >
                Aceptar todas
              </Button>
              <Button
                data-testid="cookie-only-necessary"
                onClick={handleOnlyNecessary}
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
              >
                Solo necesarias
              </Button>
              <button
                data-testid="cookie-preferences"
                onClick={handleOpenPreferences}
                className="px-3 py-1.5 text-xs font-medium text-charcoal/60 underline hover:text-charcoal"
              >
                Preferencias
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
