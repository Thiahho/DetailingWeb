"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import EarningsTabs, { EarningsPeriod } from "@/src/components/professional/EarningsTabs";

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
  subject: string;
  service: string;
  startDateTime: string;
}

interface ProfessionalStat {
  professionalId: number;
  professionalName: string;
  revenueThisMonth: number;
  paidBookingsThisMonth: number;
  occupiedHours: number;
  freeHours: number;
  occupancyRate: number;
  upcomingAbsences: number;
}

interface ProfessionalOption {
  id: number;
  firstName: string;
  lastName: string;
}

interface CommissionsSummary {
  businessChargedTotal: number;
  businessCommissionAmount: number;
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
  professionalStats: ProfessionalStat[];
}

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

function formatMoney(amount: number) {
  return amount.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

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
    <div
      data-testid="estadisticas-stat-card"
      data-label={label}
      className={`bg-ivory border rounded-xl p-5 ${accent ? "border-green-200" : "border-mauve/5"}`}
    >
      <p className="text-charcoal/50 text-xs font-medium uppercase tracking-wider">{label}</p>
      <p data-testid="estadisticas-stat-value" className={`text-3xl font-bold mt-2 ${accent ? "text-green-700" : "text-charcoal"}`}>{value}</p>
      {sub && <p className="text-charcoal/40 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function EstadisticasPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [commissions, setCommissions] = useState<CommissionsSummary | null>(null);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);

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

    fetch("/api/professionals/all")
      .then((res) => (res.ok ? res.json() : []))
      .then(setProfessionals)
      .catch((err) => logError("Error cargando profesionales:", err));

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    fetch(`/api/analytics/commissions?granularity=month&from=${monthStart.toISOString()}&to=${monthEnd.toISOString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setCommissions)
      .catch((err) => logError("Error cargando comisiones del negocio:", err));
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

  // Mismo criterio que el resto de la app: negocio de una sola persona =
  // 0 profesionales activos. El total del negocio (arriba) ya incluye su
  // trabajo (ProfessionalId null) — lo único que no aplica es el DESGLOSE
  // por profesional, redundante cuando hay una sola persona.
  const hasTeam = professionals.length > 0;

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
    <div data-testid="estadisticas-page" className="p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Estadísticas</h1>
          <p className="text-charcoal/50 text-sm mt-1">Resumen de actividad del negocio</p>
        </div>

        {/* KPIs de negocio (comisiones, nivel jefe) — "Comisiones a pagar" no
            aplica en modo solo (nadie le paga comisión a sí misma). */}
        <div className={`grid gap-4 mb-6 ${hasTeam ? "grid-cols-2" : "grid-cols-1"}`}>
          <StatCard
            label="Ingresos totales (mes)"
            value={commissions ? formatMoney(commissions.businessChargedTotal) : "—"}
            sub="Cobrado en caja por todo el negocio"
            accent
          />
          {hasTeam && (
            <StatCard
              label="Comisiones a pagar (mes)"
              value={commissions ? formatMoney(commissions.businessCommissionAmount) : "—"}
              sub="Suma de comisiones de todo el equipo"
            />
          )}
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

        {/* Estadísticas por profesional — redundante en modo solo: una sola
            persona, su total ya es el total del negocio (arriba). */}
        {hasTeam && (
          <div className="mt-6 bg-ivory border border-mauve/5 rounded-xl p-6">
            <h2 className="text-charcoal font-semibold mb-1">Por profesional</h2>
            <p className="text-charcoal/40 text-xs mb-5">Ventas, ocupación y ausencias del mes actual</p>
            {data.professionalStats.length === 0 ? (
              <p className="text-charcoal/30 text-sm">No hay datos todavía</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left text-charcoal/40 text-xs uppercase tracking-wider border-b border-mauve/10">
                      <th className="pb-2 pr-3 font-medium">Profesional</th>
                      <th className="pb-2 pr-3 font-medium">Ventas</th>
                      <th className="pb-2 pr-3 font-medium">Ocupación</th>
                      <th className="pb-2 pr-3 font-medium">Hs. ocupadas / libres</th>
                      <th className="pb-2 font-medium">Ausencias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.professionalStats.map((p) => (
                      <tr key={p.professionalId} className="border-b border-mauve/5 last:border-0">
                        <td className="py-3 pr-3 text-charcoal font-medium whitespace-nowrap">{p.professionalName}</td>
                        <td className="py-3 pr-3 text-charcoal/80 whitespace-nowrap">
                          ${p.revenueThisMonth.toLocaleString("es-AR")}
                          <span className="text-charcoal/40 text-xs ml-1">({p.paidBookingsThisMonth})</span>
                        </td>
                        <td className="py-3 pr-3 text-charcoal/80">{p.occupancyRate}%</td>
                        <td className="py-3 pr-3 text-charcoal/60 font-mono text-xs whitespace-nowrap">
                          {p.occupiedHours}h / {p.freeHours}h
                        </td>
                        <td className="py-3">
                          {p.upcomingAbsences > 0 ? (
                            <span className="text-orange-700 font-medium">{p.upcomingAbsences}</span>
                          ) : (
                            <span className="text-charcoal/30">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Día Trabajado / desglose de comisiones, a nivel negocio o por empleado.
            Sin equipo, selectedProfessionalId queda siempre null (todo el
            negocio) — es el mismo dato, es su propio trabajo. */}
        <div className="mt-6 bg-ivory border border-mauve/5 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-charcoal font-semibold">{hasTeam ? "Día Trabajado y comisiones" : "Día trabajado"}</h2>
              <p className="text-charcoal/40 text-xs mt-1">
                {hasTeam ? "Mismo detalle que ve cada profesional, a nivel negocio o por empleado" : "Detalle de lo cobrado, día a día"}
              </p>
            </div>
            {hasTeam && (
              <select
                value={selectedProfessionalId ?? ""}
                onChange={(e) => setSelectedProfessionalId(e.target.value ? Number(e.target.value) : null)}
                className="bg-cream border border-mauve/10 rounded-lg px-3 py-2 text-sm text-charcoal"
              >
                <option value="">Todo el negocio</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <EarningsTabs
            key={selectedProfessionalId ?? "all"}
            dayUrl={(date) => `/api/analytics/day?date=${date}${selectedProfessionalId ? `&professionalId=${selectedProfessionalId}` : ""}`}
            breakdownUrl={(granularity, from, to) =>
              `/api/analytics/commissions?granularity=${granularity}&from=${from}&to=${to}${
                selectedProfessionalId ? `&professionalId=${selectedProfessionalId}` : ""
              }`
            }
            extractBreakdown={(json) => (json as { breakdown?: EarningsPeriod[] })?.breakdown ?? []}
          />
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
                        {b.subject} · {b.service?.replace(/-/g, " ")}
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
