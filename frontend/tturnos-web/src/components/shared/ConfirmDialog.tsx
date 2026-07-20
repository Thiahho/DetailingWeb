"use client";

import { useCallback, useState, type ReactElement } from "react";
import { Button } from "@/src/components/shared/Button";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Color del ícono y del botón de confirmar. Default: "danger" (la mayoría de los usos son borrar/cancelar/liberar). */
  variant?: "danger" | "primary";
  /** Paleta del propio diálogo, independiente del tema de la página que lo monta. Default: "light" (cream/ivory, el tema del admin). */
  theme?: "light" | "dark";
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

const ICONS: Record<"danger" | "primary", ReactElement> = {
  danger: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  primary: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

/**
 * Reemplazo con el diseño propio de la app para `window.confirm()`. Uso:
 *   const { confirm, ConfirmDialog } = useConfirm();
 *   if (!(await confirm("¿Eliminar este turno?"))) return;
 *   // ...renderizar {ConfirmDialog} una vez en el JSX de la página, como ToastContainer.
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const opts: ConfirmOptions = typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => setState({ ...opts, resolve }));
  }, []);

  const respond = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  useModalHotkeys(!!state, { onClose: () => respond(false), onSubmit: () => respond(true) });

  let ConfirmDialog: ReactElement | null = null;

  if (state) {
    const variant = state.variant ?? "danger";
    const theme = state.theme ?? "light";
    const dark = theme === "dark";
    const iconWrapClass = variant === "danger" ? "bg-red-500/15 text-red-500" : "bg-blue-500/15 text-blue-500";

    ConfirmDialog = (
      <div
        data-testid="confirm-dialog-backdrop"
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={() => respond(false)}
      >
        <div
          data-testid="confirm-dialog"
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl border ${
            dark ? "bg-[#161b22] border-white/10" : "bg-ivory border-mauve/10"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`shrink-0 p-2 rounded-lg ${iconWrapClass}`}>{ICONS[variant]}</div>
            <div className="min-w-0">
              {state.title && (
                <h2 className={`font-semibold text-base ${dark ? "text-white" : "text-charcoal"}`}>{state.title}</h2>
              )}
              <p className={`text-sm mt-1 ${dark ? "text-white/70" : "text-charcoal/70"}`}>{state.message}</p>
            </div>
          </div>
          <div className="flex gap-3 pt-5">
            {dark ? (
              <>
                <button
                  data-testid="confirm-dialog-confirm"
                  onClick={() => respond(true)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                    variant === "danger" ? "bg-red-600 hover:bg-red-500 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"
                  }`}
                >
                  {state.confirmLabel ?? "Confirmar"}
                </button>
                <button
                  data-testid="confirm-dialog-cancel"
                  onClick={() => respond(false)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition"
                >
                  {state.cancelLabel ?? "Cancelar"}
                </button>
              </>
            ) : (
              <>
                <Button
                  data-testid="confirm-dialog-confirm"
                  onClick={() => respond(true)}
                  variant={variant === "danger" ? "danger" : "primary"}
                  className="flex-1"
                >
                  {state.confirmLabel ?? "Confirmar"}
                </Button>
                <Button data-testid="confirm-dialog-cancel" onClick={() => respond(false)} variant="secondary">
                  {state.cancelLabel ?? "Cancelar"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return { confirm, ConfirmDialog };
}
