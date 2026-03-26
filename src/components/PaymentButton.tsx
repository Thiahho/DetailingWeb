"use client";

import { useState } from "react";
import { logError } from "../lib/logger";
import { initMercadoPago, Wallet } from "@mercadopago/sdk-react";

interface PaymentButtonProps {
  bookingId: number;
  serviceName: string;
  amount?: number;
  onPaymentCreated?: (checkoutUrl: string) => void;
}

initMercadoPago('');

export default function PaymentButton({
  bookingId,
  serviceName,
  amount,
  onPaymentCreated,
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          amount: amount || 0,
        }),
      });

      const data = await response.json();

      if (data.success && data.checkoutUrl) {
        setCheckoutUrl(data.checkoutUrl);
        onPaymentCreated?.(data.checkoutUrl);
        // Redirect to MercadoPago checkout
        window.location.href = data.checkoutUrl;
      } else {
        setError(data.message || "Error al crear el pago");
      }
    } catch (err) {
      setError("Error de conexión. Intentá de nuevo.");
      logError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handlePayment}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 rounded-xl border-2 border-sky-400/50 bg-gradient-to-r from-sky-500/20 to-blue-600/20 px-6 py-4 text-white font-semibold transition hover:from-sky-500/30 hover:to-blue-600/30 hover:border-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Generando pago...</span>
          </>
        ) : (
          <>
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            {/* <span>Pagar con Mercado Pago</span> */
            }
            <div style={{width:'300px'}}>
              {/* <Wallet initialization={{preferenceId:''}} /> */}
            </div>
          </>
        )
        }
      </button>

      {checkoutUrl && !loading && (
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-sky-400 text-sm hover:underline"
        >
          Si no se abrió automáticamente, hacé clic aquí
        </a>
      )}

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      <div className="flex items-center justify-center gap-2 text-white/40 text-xs">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        <span>Pago seguro procesado por Mercado Pago</span>
      </div>

      <div className="flex items-center justify-center gap-4 opacity-50">
        <span className="text-[10px] text-white/30 uppercase tracking-wider">
          Tarjetas de crédito/débito &middot; Transferencia bancaria &middot; Efectivo
        </span>
      </div>
    </div>
  );
}
