"use client";

import { useEffect } from "react";

interface ModalHotkeysOptions {
  /** Escape */
  onClose?: () => void;
  /** Ctrl/Cmd+Enter — útil para confirmar sin depender de qué input tiene el foco */
  onSubmit?: () => void;
}

/**
 * Atajos de teclado para modales/formularios. Activo solo mientras `isOpen`.
 * Uso: const formRef = useRef<HTMLFormElement>(null);
 *      useModalHotkeys(showForm, { onClose: closeForm, onSubmit: () => formRef.current?.requestSubmit() });
 *      <form ref={formRef} onSubmit={handleSubmit}>...
 */
export function useModalHotkeys(isOpen: boolean, { onClose, onSubmit }: ModalHotkeysOptions) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose?.();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSubmit?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onSubmit]);
}
