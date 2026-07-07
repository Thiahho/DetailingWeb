"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";

interface TopService {
  service: string;
  count: number;
}

interface MonthlyBooking {
  year: number;
  month: number;
  count: number;
}

interface UpcomingBooking {
  id: number;
  customerName: string;
  vehicle: string;
  service: string;
  startDateTime: string;
}

interface AnalyticsSummary {
  bookingsThisMonth: number;
  bookingsLastMonth: number;
  totalBookings: number;
  confirmedThisMonth: number;
  cancelledThisMonth: number;
  confirmationRate: number;
  cancellationRate: number;
  avgLeadTimeHours: number;
  activeBookings: number;
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  occupancyRate: number;
  topServices: TopService[];
  bookingsByMonth: MonthlyBooking[];
  upcomingBookings: UpcomingBooking[];
}

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

function StatCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`bg-ivory border rounded-xl p-5 ${accent ? "border-green-200" : "border-mauve/5"}`}>
      <p className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${accent ? "text-green-700" : "text-charcoal"}`}>{value}</p>
      {sub && <p className="text-charcoal/40 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function EstadisticasPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
      return;
    }
    fetch("/api/analytics/summary")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => logError("Error cargando estadísticas:", err))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory">
        <p className="text-charcoal">Cargando estadísticas...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory">
        <p className="text-red-600">Error al cargar estadísticas</p>
      </div>
    );
  }

  const trend = data.bookingsLastMonth > 0
    ? Math.round(((data.bookingsThisMonth - data.bookingsLastMonth) / data.bookingsLastMonth) * 100)
    : null;

  // Completar los 12 meses del año actual con 0 si no hay datos
  const currentYear = new Date().getFullYear();
  const allMonths = Array.from({ length: 12 }, (_, i) => {
    const found = data.bookingsByMonth.find((m) => m.year === currentYear && m.month === i + 1);
    return { year: currentYear, month: i + 1, count: found?.count ?? 0 };
  });
  const maxMonthCount = Math.max(...allMonths.map((m) => m.count), 1);

  return (
    <div className="p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Estadísticas</h1>
          <p className="text-charcoal/50 text-sm mt-1">Resumen de actividad del negocio</p>
        </div>

        {/* KPIs principales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Reservas este mes"
            value={data.bookingsThisMonth}
            sub={
              trend !== null
                ? trend >= 0
                  ? `↑ ${trend}% vs mes anterior`
                  : `↓ ${Math.abs(trend)}% vs mes anterior`
                : "Primer mes con datos"
            }
            accent
          />
          <StatCard
            label="Total histórico"
            value={data.totalBookings}
            sub="Reservas acumuladas"
          />
          <StatCard
            label="Tasa de ocupación"
            value={`${data.occupancyRate}%`}
            sub={`${data.occupiedSlots} ocupados / ${data.totalSlots} turnos`}
          />
          <StatCard
            label="Turnos disponibles"
            value={data.availableSlots}
            sub={`${data.activeBookings} reservas activas`}
          />
        </div>

        {/* KPIs V2 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Confirmadas (mes)"
            value={data.confirmedThisMonth}
            sub={`${data.confirmationRate}% confirmación`}
          />
          <StatCard
            label="Canceladas (mes)"
            value={data.cancelledThisMonth}
            sub={`${data.cancellationRate}% cancelación`}
          />
          <StatCard
            label="Lead time prom."
            value={`${data.avgLeadTimeHours}h`}
            sub="Desde reserva a turno"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Reservas por mes (gráfico de barras simple) */}
          <div className="bg-ivory border border-mauve/5 rounded-xl p-6">
            <h2 className="text-charcoal font-semibold mb-5">Reservas por mes</h2>
              <div className="flex items-end gap-1.5 h-36">
                {allMonths.map((m) => {
                  const height = Math.round((m.count / maxMonthCount) * 100);
                  const isCurrent = m.month === new Date().getMonth() + 1;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      {m.count > 0 && (
                        <span className="text-charcoal/50 text-[9px]">{m.count}</span>
                      )}
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className={`w-full rounded-t-sm transition-all ${isCurrent ? "bg-green-500" : "bg-green-800/60"}`}
                          style={{ height: m.count > 0 ? `${Math.max(height, 6)}%` : "3px" }}
                        />
                      </div>
                      <span className={`text-[9px] ${isCurrent ? "text-green-700 font-semibold" : "text-charcoal/30"}`}>
                        {MONTH_NAMES[m.month - 1]}
                      </span>
                    </div>
                  );
                })}
              </div>
          </div>

          {/* Servicios más solicitados */}
          <div className="bg-ivory border border-mauve/5 rounded-xl p-6">
            <h2 className="text-charcoal font-semibold mb-5">Servicios más solicitados</h2>
            {data.topServices.length === 0 ? (
              <p className="text-charcoal/30 text-sm">Sin datos aún</p>
            ) : (
              <div className="space-y-3">
                {data.topServices.map((s, i) => {
                  const maxCount = data.topServices[0].count;
                  const pct = Math.round((s.count / maxCount) * 100);
                  return (
                    <div key={s.service}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-charcoal/80 text-sm capitalize">
                          {s.service.replace(/-/g, " ")}
                        </span>
                        <span className="text-charcoal/50 text-xs font-mono">
                          {s.count} {s.count === 1 ? "reserva" : "reservas"}
                        </span>
                      </div>
                      <div className="h-1.5 bg-porcelain/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${i === 0 ? "bg-green-500" : "bg-green-800"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Próximas reservas */}
        <div className="mt-6 bg-ivory border border-mauve/5 rounded-xl p-6">
          <h2 className="text-charcoal font-semibold mb-5">Próximas reservas (7 días)</h2>
          {data.upcomingBookings.length === 0 ? (
            <p className="text-charcoal/30 text-sm">No hay reservas en los próximos 7 días</p>
          ) : (
            <div className="space-y-3">
              {data.upcomingBookings.map((b) => {
                const dt = new Date(b.startDateTime.replace("Z", ""));
                const days = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
                const label = `${days[dt.getDay()]} ${dt.getDate()}/${dt.getMonth() + 1} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 py-3 border-b border-mauve/5 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-charcoal text-sm font-medium truncate">{b.customerName}</p>
                      <p className="text-charcoal/40 text-xs mt-0.5 truncate">
                        {b.vehicle} · {b.service?.replace(/-/g, " ")}
                      </p>
                    </div>
                    <span className="text-charcoal/60 text-xs font-mono shrink-0">{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
