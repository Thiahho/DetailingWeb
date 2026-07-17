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

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((type: ToastType, title: string, message?: string, duration?: number) => {
    idRef.current += 1;
    setToasts((prev) => [...prev, { id: idRef.current, type, title, message, duration }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
}

function ToastNotification({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration || 4000;
    const exitTimer = setTimeout(() => setIsExiting(true), duration - 300);
    const closeTimer = setTimeout(onClose, duration);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
    };
  }, [toast.duration, onClose]);

  const icons = {
    success: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const styles = {
    success: { bg: "bg-gradient-to-r from-green-600 to-green-500", border: "border-green-400", glow: "shadow-[0_0_30px_rgba(34,197,94,0.4)]", icon: "bg-green-400/20" },
    error: { bg: "bg-gradient-to-r from-red-600 to-red-500", border: "border-red-400", glow: "shadow-[0_0_30px_rgba(239,68,68,0.4)]", icon: "bg-red-400/20" },
    warning: { bg: "bg-gradient-to-r from-orange-600 to-orange-500", border: "border-orange-400", glow: "shadow-[0_0_30px_rgba(249,115,22,0.4)]", icon: "bg-orange-400/20" },
    info: { bg: "bg-gradient-to-r from-blue-600 to-blue-500", border: "border-blue-400", glow: "shadow-[0_0_30px_rgba(59,130,246,0.4)]", icon: "bg-blue-400/20" },
  };

  const style = styles[toast.type];

  return (
    <div
      className={`relative ${style.bg} ${style.glow} border ${style.border} rounded-xl p-4 pr-12 min-w-[320px] max-w-[420px] transform transition-all duration-300 ease-out ${
        isExiting ? "translate-x-[120%] opacity-0" : "translate-x-0 opacity-100"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`${style.icon} p-2 rounded-lg`}>{icons[toast.type]}</div>
        <div className="flex-1 pt-0.5">
          <p className="font-bold text-charcoal text-[15px]">{toast.title}</p>
          {toast.message && <p className="text-charcoal/80 text-sm mt-1">{toast.message}</p>}
        </div>
      </div>
      <button
        onClick={() => { setIsExiting(true); setTimeout(onClose, 300); }}
        className="absolute top-3 right-3 text-charcoal/60 hover:text-charcoal transition p-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: number) => void }) {
  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3">
      {toasts.map((toast) => (
        <ToastNotification key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}
