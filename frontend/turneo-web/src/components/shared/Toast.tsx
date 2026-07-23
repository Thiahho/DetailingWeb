"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

const MAX_VISIBLE_TOASTS = 4;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((type: ToastType, title: string, message?: string, duration?: number) => {
    idRef.current += 1;
    setToasts((prev) => [...prev, { id: idRef.current, type, title, message, duration }].slice(-MAX_VISIBLE_TOASTS));
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
}

function ToastNotification({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [isExiting, setIsExiting] = useState(false);
  const duration = toast.duration || 4000;

  useEffect(() => {
    const exitTimer = setTimeout(() => setIsExiting(true), duration - 300);
    const closeTimer = setTimeout(onClose, duration);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
    };
  }, [duration, onClose]);

  const icons = {
    success: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const styles = {
    success: { accent: "bg-emerald-500", icon: "bg-emerald-500/15 text-emerald-400", bar: "bg-emerald-500" },
    error: { accent: "bg-red-500", icon: "bg-red-500/15 text-red-400", bar: "bg-red-500" },
    warning: { accent: "bg-champagne", icon: "bg-champagne/15 text-champagne", bar: "bg-champagne" },
    info: { accent: "bg-lavender", icon: "bg-lavender/20 text-mauve", bar: "bg-lavender" },
  };

  const style = styles[toast.type];

  return (
    <div
      role="status"
      className={`relative flex w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-mauve/15 bg-ivory shadow-elevated transition-all duration-300 ease-out ${
        isExiting ? "translate-x-[120%] opacity-0" : "translate-x-0 opacity-100"
      }`}
    >
      <span className={`w-1 shrink-0 ${style.accent}`} />
      <div className="flex flex-1 items-start gap-3 py-3 pl-3 pr-9">
        <div className={`mt-0.5 shrink-0 rounded-full p-1.5 ${style.icon}`}>{icons[toast.type]}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-tight text-charcoal">{toast.title}</p>
          {toast.message && <p className="mt-0.5 text-[13px] leading-snug text-warmgray">{toast.message}</p>}
        </div>
      </div>
      <button
        onClick={() => { setIsExiting(true); setTimeout(onClose, 300); }}
        aria-label="Cerrar notificación"
        className="absolute right-2.5 top-2.5 rounded-full p-1 text-warmgray/60 transition hover:bg-porcelain/60 hover:text-charcoal"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="absolute bottom-0 left-1 right-0 h-0.5 bg-porcelain/60">
        <div
          className={`h-full ${style.bar} opacity-60`}
          style={{ animation: `toast-shrink ${duration}ms linear forwards` }}
        />
      </div>
    </div>
  );
}

export function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: number) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col-reverse gap-3">
      {toasts.map((toast) => (
        <ToastNotification key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
      <style jsx global>{`
        @keyframes toast-shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
