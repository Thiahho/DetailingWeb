"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface WhatsAppFloatProps {
  whatsappNumber?: string;
}

type ConsultationType = "Turnos" | "Consulta" | "otro";

export default function WhatsAppFloat({
  whatsappNumber = "54112692061",
}: WhatsAppFloatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    tipo: "Consulta" as ConsultationType,
    motivo: "",
    urgente: false,
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const clearAutoClose = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startAutoClose = useCallback(() => {
    clearAutoClose();
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      timeoutRef.current = null;
    }, 3000);
  }, [clearAutoClose]);

  const handleMouseEnter = () => {
    clearAutoClose();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    startAutoClose();
  };

  const handleButtonClick = () => {
    if (isOpen) {
      setIsOpen(false);
      clearAutoClose();
    } else {
      setIsOpen(true);
      startAutoClose();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    clearAutoClose();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        clearAutoClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, clearAutoClose]);

  useEffect(() => {
    return () => {
      clearAutoClose();
    };
  }, [clearAutoClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const tipoLabels: Record<ConsultationType, string> = {
      Turnos: "Turnos",
      Consulta: "Consulta",
      otro: "Otro",
    };

    const tipoLabel = tipoLabels[formData.tipo];
    const urgenciaLabel = formData.urgente ? " [URGENTE]" : "";
    const message = `Hola${urgenciaLabel}, soy ${formData.nombre}. Consulta: ${tipoLabel}. Mensaje: ${formData.motivo}`;

    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
      message
    )}`;
    window.open(whatsappUrl, "_blank");

    setFormData({ nombre: "", tipo: "Consulta", motivo: "", urgente: false });
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="fixed bottom-6 right-6 z-50"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Formulario */}
      <div
        className={`absolute bottom-16 right-0 w-72 origin-bottom-right transition-all duration-300 ${
          isOpen
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-mauve/15 bg-ivory p-4 shadow-elevated"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-lg font-semibold text-charcoal">
              Contactar por WhatsApp
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full p-1 text-charcoal/70 transition-colors hover:bg-blush/15 hover:text-charcoal"
              aria-label="Cerrar formulario"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="nombre"
                className="mb-1 block text-xs font-medium text-charcoal/70"
              >
                Nombre
              </label>
              <input
                type="text"
                id="nombre"
                required
                value={formData.nombre}
                onChange={(e) =>
                  setFormData({ ...formData, nombre: e.target.value })
                }
                className="w-full rounded-lg border border-mauve/40 bg-porcelain px-3 py-2 text-sm text-charcoal placeholder:text-warmgray/60 focus:border-blush focus:outline-none focus:ring-1 focus:ring-blush/40"
                placeholder="Tu nombre"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-charcoal/70">
                Tipo de consulta
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo: "Turnos" })}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs transition-colors ${
                    formData.tipo === "Turnos"
                      ? "border-blush bg-blush/15 text-charcoal"
                      : "border-mauve/20 text-charcoal/70 hover:border-mauve/40"
                  }`}
                >
                  Turnos
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo: "Consulta" })}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs transition-colors ${
                    formData.tipo === "Consulta"
                      ? "border-blush bg-blush/15 text-blushdark"
                      : "border-mauve/20 text-charcoal/70 hover:border-mauve/40"
                  }`}
                >
                  Consulta
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo: "otro" })}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs transition-colors ${
                    formData.tipo === "otro"
                      ? "border-blush bg-blush/15 text-blushdark"
                      : "border-mauve/20 text-charcoal/70 hover:border-mauve/40"
                  }`}
                >
                  Otro
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="motivo"
                className="mb-1 block text-xs font-medium text-charcoal/70"
              >
                Descripción breve
              </label>
              <textarea
                id="motivo"
                required
                rows={3}
                value={formData.motivo}
                onChange={(e) =>
                  setFormData({ ...formData, motivo: e.target.value })
                }
                className="w-full resize-none rounded-lg border border-mauve/40 bg-porcelain px-3 py-2 text-sm text-charcoal placeholder:text-warmgray/60 focus:border-blush focus:outline-none focus:ring-1 focus:ring-blush/40"
                placeholder="Describe brevemente tu situación..."
              />
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#20bd5a]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Enviar por WhatsApp
            </button>
          </div>
        </form>
      </div>

      {/* Botón flotante */}
      <button
        onClick={handleButtonClick}
        aria-label="Abrir formulario de WhatsApp"
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </button>
    </div>
  );
}
