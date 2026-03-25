"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface MyBooking {
  id: number;
  status: string;
  service: string;
  vehicle: string;
  startDateTime: string;
  endDateTime: string;
  canCancel: boolean;
  canReschedule: boolean;
}

function MisTurnosContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const bootstrap = async () => {
      const accessToken = searchParams.get("accessToken");
      try {
        if (accessToken) {
          await fetch("/api/auth/client/session/exchange", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken }),
          });
          window.history.replaceState({}, "", "/mis-turnos");
        }

        const res = await fetch("/api/bookings/my", { credentials: "include" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "No se pudieron cargar tus turnos");
        setItems(data);
      } catch (err: any) {
        setError(err.message || "Error de conexión");
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [searchParams]);

  const cancelBooking = async (id: number) => {
    const res = await fetch(`/api/bookings/${id}/cancel`, { method: "POST", credentials: "include" });
    if (res.ok) {
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, status: "Cancelled", canCancel: false, canReschedule: false } : item));
    }
  };

  return (
    <main className="min-h-screen bg-[#0f1115] p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl text-white font-bold mb-2">Mis turnos</h1>
        <p className="text-white/60 mb-8">Consultá estado, fecha y gestioná tus reservas.</p>
        {loading && <p className="text-white/70">Cargando...</p>}
        {error && <p className="text-red-400">{error}</p>}
        <div className="space-y-4">
          {items.map((b) => (
            <div key={b.id} className="bg-[#161b22] border border-white/10 rounded-xl p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="text-white font-semibold">{b.service || "Servicio"}</p>
                  <p className="text-white/60 text-sm">{b.vehicle || "Vehículo no informado"}</p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-white/10 text-white/70">{b.status}</span>
              </div>
              <p className="text-white/80 mt-3">{new Date(b.startDateTime).toLocaleString("es-AR")}</p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => cancelBooking(b.id)}
                  disabled={!b.canCancel}
                  className="px-4 py-2 rounded-lg bg-red-600 disabled:bg-white/10 disabled:text-white/40 text-white text-sm"
                >
                  Cancelar
                </button>
                <a
                  href="https://wa.me/"
                  className={`px-4 py-2 rounded-lg text-sm ${b.canReschedule ? "bg-blue-600 text-white" : "bg-white/10 text-white/40 pointer-events-none"}`}
                >
                  Reprogramar
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function MisTurnosPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0f1115] p-6 text-white/70">Cargando...</main>}>
      <MisTurnosContent />
    </Suspense>
  );
}
