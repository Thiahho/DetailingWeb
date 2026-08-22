"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth, isProfessionalAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";

interface TimeSlot {
  id: number;
  startDateTime: string;
  isAvailable: boolean;
}

interface EarningsPeriod {
  periodStart: string;
  chargedTotal: number;
  commissionAmount: number;
}

interface Earnings {
  chargedTotal: number;
  commissionAmount: number;
}

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatCurrency(amount: number) {
  return amount.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-ivory border border-mauve/5 rounded-xl p-5">
      <p className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold mt-2 text-charcoal">{value}</p>
      {sub && <p className="text-charcoal/40 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function ProfesionalTableroPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [trend, setTrend] = useState<EarningsPeriod[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isProfessionalAuthenticated()) {
      router.push(getRole() === "Admin" ? "/admin/turnos" : "/profesional/login");
      return;
    }

    const now = new Date();
    const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const trendEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    Promise.all([
      fetchWithAuth(`/api/professionals/me/earnings?year=${now.getFullYear()}&month=${now.getMonth() + 1}`).then((res) => (res.ok ? res.json() : null)),
      fetchWithAuth(`/api/professionals/me/earnings/breakdown?granularity=month&from=${trendStart.toISOString()}&to=${trendEnd.toISOString()}`).then((res) =>
        res.ok ? res.json() : []
      ),
      fetchWithAuth("/api/timeslots/mine").then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([earningsData, breakdown, mySlots]) => {
        setEarnings(earningsData);
        setTrend(breakdown);
        setSlots(mySlots);
      })
      .catch((error) => logError("Error cargando el tablero:", error))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando tu tablero...</p>
      </div>
    );
  }

  const now = new Date();
  const monthSlots = slots.filter((s) => {
    const d = new Date(s.startDateTime);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const bookedThisMonth = monthSlots.filter((s) => !s.isAvailable);
  const occupancyRate = monthSlots.length > 0 ? Math.round((bookedThisMonth.length / monthSlots.length) * 100) : 0;
  const daysElapsed = now.getDate();
  const commissionAmount = earnings?.commissionAmount ?? 0;
  const chargedTotal = earnings?.chargedTotal ?? 0;
  const dailyAverage = commissionAmount / daysElapsed;

  const byMonthKey = new Map(trend.map((p) => [p.periodStart.slice(0, 10), p]));
  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
    const key = d.toISOString().slice(0, 10);
    const period = byMonthKey.get(key);
    return { month: d.getUTCMonth(), chargedTotal: period?.chargedTotal ?? 0, commissionAmount: period?.commissionAmount ?? 0 };
  });
  const maxCommission = Math.max(...trendMonths.map((m) => m.commissionAmount), 1);

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Mi Tablero</h1>
          <p className="text-charcoal/50 text-sm mt-1">Tu actividad y comisiones del mes</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Turnos del mes" value={bookedThisMonth.length} />
          <StatCard label="Ocupación" value={`${occupancyRate}%`} sub={`${bookedThisMonth.length} / ${monthSlots.length} turnos`} />
          <StatCard label="Comisión del mes" value={formatCurrency(commissionAmount)} sub={`sobre ${formatCurrency(chargedTotal)} cobrados`} />
          <StatCard label="Promedio diario" value={formatCurrency(dailyAverage)} sub={`en ${daysElapsed} días`} />
        </div>

        <div className="bg-ivory border border-mauve/5 rounded-xl p-6">
          <h2 className="text-charcoal font-semibold mb-5">Comisión mensual (últimos 6 meses)</h2>
          <div className="flex items-end gap-2 h-40">
            {trendMonths.map((m, i) => {
              const height = Math.round((m.commissionAmount / maxCommission) * 100);
              const isCurrent = i === trendMonths.length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  {m.commissionAmount > 0 && <span className="text-charcoal/50 text-[9px]">{formatCurrency(m.commissionAmount)}</span>}
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t-sm ${isCurrent ? "bg-blush" : "bg-blush/50"}`}
                      style={{ height: m.commissionAmount > 0 ? `${Math.max(height, 6)}%` : "3px" }}
                    />
                  </div>
                  <span className={`text-[9px] ${isCurrent ? "text-blushdark font-semibold" : "text-charcoal/30"}`}>{MONTH_LABELS[m.month]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
