"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isProfessionalAuthenticated, getRole } from "@/src/lib/auth";
import EarningsTabs from "@/src/components/professional/EarningsTabs";

export default function ProfesionalDiaTrabajadoPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isProfessionalAuthenticated()) {
      router.push(getRole() === "Admin" ? "/admin/turnos" : "/profesional/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Día Trabajado</h1>
          <p className="text-charcoal/50 text-sm mt-1">Movimiento de tus turnos de hoy y tu comisión, basada en los cobros registrados en caja</p>
        </div>

        <EarningsTabs
          dayUrl={(date) => `/api/professionals/me/day?date=${date}`}
          breakdownUrl={(granularity, from, to) => `/api/professionals/me/earnings/breakdown?granularity=${granularity}&from=${from}&to=${to}`}
        />
      </div>
    </div>
  );
}
