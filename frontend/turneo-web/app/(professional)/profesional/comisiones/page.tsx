"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth, isProfessionalAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";

interface Earnings {
  year: number;
  month: number;
  commissionRate: number;
  chargedTotal: number;
  commissionAmount: number;
}

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatCurrency(amount: number) {
  return amount.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

export default function ProfesionalComisionesPage() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isProfessionalAuthenticated()) {
      router.push(getRole() === "Admin" ? "/admin/turnos" : "/profesional/login");
    }
  }, [router]);

  useEffect(() => {
    setLoading(true);
    fetchWithAuth(`/api/professionals/me/earnings?year=${year}&month=${month}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setEarnings)
      .catch((error) => logError("Error cargando comisiones:", error))
      .finally(() => setLoading(false));
  }, [year, month]);

  const goToPreviousMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Mis comisiones</h1>
          <p className="text-charcoal/50 text-sm mt-1">Basado en los cobros registrados en caja para tus turnos</p>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goToPreviousMonth}
            className="text-charcoal/60 hover:text-charcoal px-3 py-1.5 rounded-lg hover:bg-porcelain transition text-sm"
          >
            ← Anterior
          </button>
          <span className="text-charcoal font-semibold text-sm">
            {monthNames[month - 1]} {year}
          </span>
          <button
            onClick={goToNextMonth}
            disabled={isCurrentMonth}
            className="text-charcoal/60 hover:text-charcoal px-3 py-1.5 rounded-lg hover:bg-porcelain transition text-sm disabled:opacity-30 disabled:hover:bg-transparent"
          >
            Siguiente →
          </button>
        </div>

        {loading ? (
          <div className="bg-ivory border border-mauve/10 rounded-xl p-8 text-center text-charcoal/40 text-sm">
            Cargando...
          </div>
        ) : !earnings ? (
          <div className="bg-ivory border border-mauve/10 rounded-xl p-8 text-center text-charcoal/40 text-sm">
            No se pudieron cargar los datos.
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="bg-ivory border border-mauve/10 rounded-xl p-6">
              <p className="text-charcoal/50 text-xs uppercase tracking-wider mb-1">Total cobrado en tus turnos</p>
              <p className="text-charcoal text-2xl font-bold">{formatCurrency(earnings.chargedTotal)}</p>
            </div>
            <div className="bg-ivory border border-mauve/10 rounded-xl p-6">
              <p className="text-charcoal/50 text-xs uppercase tracking-wider mb-1">Tu comisión ({earnings.commissionRate}%)</p>
              <p className="text-blush text-3xl font-bold">{formatCurrency(earnings.commissionAmount)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
