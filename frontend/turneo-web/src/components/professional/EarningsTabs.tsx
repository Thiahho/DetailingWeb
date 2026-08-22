"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";

export interface DayBooking {
  bookingId: number;
  startDateTime: string;
  endDateTime: string;
  customerName: string;
  service?: string;
  status: string;
}

export interface DaySummary {
  date: string;
  pendingCount: number;
  confirmedCount: number;
  cancelledCount: number;
  chargedTotal: number;
  bookings: DayBooking[];
}

export interface EarningsPeriod {
  periodStart: string;
  chargedTotal: number;
  commissionAmount: number;
}

type Granularity = "day" | "week" | "month";

interface EarningsTabsProps {
  // Recibe la fecha de "hoy" en formato YYYY-MM-DD (calendario UTC, igual que el backend).
  dayUrl: (dateIso: string) => string;
  breakdownUrl: (granularity: Granularity, fromIso: string, toIso: string) => string;
  // Por defecto la respuesta de breakdownUrl ya es el array de períodos (caso del
  // propio profesional). El endpoint admin devuelve un objeto envolvente con
  // totales de negocio además del array — este transform lo extrae.
  extractBreakdown?: (json: unknown) => EarningsPeriod[];
}

function formatCurrency(amount: number) {
  return amount.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

const STATUS_LABEL: Record<string, string> = {
  Pending: "PENDIENTE",
  Reservado: "PENDIENTE",
  Confirmed: "CONFIRMADO",
  Cancelled: "CANCELADO",
};

const STATUS_STYLE: Record<string, string> = {
  Pending: "bg-orange-500/20 text-orange-700",
  Reservado: "bg-orange-500/20 text-orange-700",
  Confirmed: "bg-blue-500/20 text-blue-700",
  Cancelled: "bg-red-500/20 text-red-700",
};

// Todo lo que sigue trabaja en calendario UTC (no en el huso horario del navegador):
// el backend agrupa CajaMovements por fecha UTC, así que para que los buckets coincidan
// con lo que devuelve la API hay que construir y leer fechas siempre con los getters UTC.
function utc(year: number, month: number, day = 1) {
  return new Date(Date.UTC(year, month, day));
}

function todayUtc() {
  const now = new Date();
  return utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function addDaysUtc(d: Date, days: number) {
  return utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days);
}

function addMonthsUtc(d: Date, months: number) {
  return utc(d.getUTCFullYear(), d.getUTCMonth() + months, 1);
}

function startOfWeekUtc(d: Date) {
  const dayIndex = (d.getUTCDay() + 6) % 7; // lunes = 0
  return addDaysUtc(d, -dayIndex);
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function bucketLabel(d: Date, granularity: Granularity) {
  if (granularity === "month") return MONTH_LABELS[d.getUTCMonth()];
  if (granularity === "week") return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  return WEEKDAY_LABELS[(d.getUTCDay() + 6) % 7];
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-ivory border border-mauve/10 rounded-xl p-4">
      <p className="text-charcoal/50 text-[11px] uppercase tracking-wider">{label}</p>
      <p className="text-charcoal text-xl font-bold mt-1">{value}</p>
    </div>
  );
}

function HoyTab({ dayUrl }: { dayUrl: (dateIso: string) => string }) {
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchWithAuth(dayUrl(dateKey(todayUtc())))
      .then((res) => (res.ok ? res.json() : null))
      .then(setSummary)
      .catch((error) => logError("Error cargando el día trabajado:", error))
      .finally(() => setLoading(false));
  }, [dayUrl]);

  if (loading) {
    return <div className="bg-ivory border border-mauve/10 rounded-xl p-8 text-center text-charcoal/40 text-sm">Cargando...</div>;
  }
  if (!summary) {
    return <div className="bg-ivory border border-mauve/10 rounded-xl p-8 text-center text-charcoal/40 text-sm">No se pudieron cargar los datos.</div>;
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Pendientes" value={summary.pendingCount} />
        <MiniStat label="Confirmados" value={summary.confirmedCount} />
        <MiniStat label="Cancelados" value={summary.cancelledCount} />
        <MiniStat label="Cobrado hoy" value={formatCurrency(summary.chargedTotal)} />
      </div>
      <div className="bg-ivory border border-mauve/10 rounded-xl p-6">
        <h2 className="text-charcoal font-semibold mb-4">Turnos de hoy</h2>
        {summary.bookings.length === 0 ? (
          <p className="text-charcoal/40 text-sm py-6 text-center">No hay turnos hoy.</p>
        ) : (
          <div className="space-y-2">
            {summary.bookings.map((b) => {
              const start = new Date(b.startDateTime.replace("Z", ""));
              const hour = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
              return (
                <div key={b.bookingId} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-mauve/10">
                  <div className="min-w-0">
                    <p className="text-charcoal text-sm font-medium">{hour} · {b.customerName}</p>
                    {b.service && <p className="text-charcoal/40 text-xs mt-0.5">{b.service}</p>}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[b.status] ?? "bg-charcoal/10 text-charcoal/60"}`}>
                    {STATUS_LABEL[b.status] ?? b.status.toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BreakdownTab({
  granularity,
  breakdownUrl,
  extractBreakdown,
}: {
  granularity: Granularity;
  breakdownUrl: (granularity: Granularity, fromIso: string, toIso: string) => string;
  extractBreakdown: (json: unknown) => EarningsPeriod[];
}) {
  const bucketCount = granularity === "day" ? 7 : granularity === "week" ? 8 : 6;
  const [offset, setOffset] = useState(0); // 0 = ventana actual; negativo = ventanas anteriores
  const [periods, setPeriods] = useState<EarningsPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  const { from, to, buckets } = useMemo(() => {
    if (granularity === "month") {
      const anchor = addMonthsUtc(todayUtc(), offset * bucketCount);
      const from = addMonthsUtc(anchor, -(bucketCount - 1));
      const to = addMonthsUtc(anchor, 1);
      const buckets = Array.from({ length: bucketCount }, (_, i) => addMonthsUtc(from, i));
      return { from, to, buckets };
    }
    if (granularity === "week") {
      const currentWeekStart = startOfWeekUtc(todayUtc());
      const anchorWeekStart = addDaysUtc(currentWeekStart, offset * bucketCount * 7);
      const from = addDaysUtc(anchorWeekStart, -(bucketCount - 1) * 7);
      const to = addDaysUtc(anchorWeekStart, 7);
      const buckets = Array.from({ length: bucketCount }, (_, i) => addDaysUtc(from, i * 7));
      return { from, to, buckets };
    }
    const weekStart = addDaysUtc(startOfWeekUtc(todayUtc()), offset * 7);
    const to = addDaysUtc(weekStart, 7);
    const buckets = Array.from({ length: 7 }, (_, i) => addDaysUtc(weekStart, i));
    return { from: weekStart, to, buckets };
  }, [granularity, offset, bucketCount]);

  useEffect(() => {
    setLoading(true);
    fetchWithAuth(breakdownUrl(granularity, from.toISOString(), to.toISOString()))
      .then((res) => (res.ok ? res.json() : []))
      .then((json) => setPeriods(extractBreakdown(json)))
      .catch((error) => logError("Error cargando el desglose:", error))
      .finally(() => setLoading(false));
  }, [granularity, from, to, breakdownUrl, extractBreakdown]);

  const byBucketKey = new Map(periods.map((p) => [p.periodStart.slice(0, 10), p]));
  const rows = buckets.map((d) => byBucketKey.get(dateKey(d)) ?? { periodStart: d.toISOString(), chargedTotal: 0, commissionAmount: 0 });
  const totalCharged = rows.reduce((sum, r) => sum + r.chargedTotal, 0);
  const totalCommission = rows.reduce((sum, r) => sum + r.commissionAmount, 0);
  const maxCharged = Math.max(...rows.map((r) => r.chargedTotal), 1);
  const isCurrentWindow = offset >= 0;
  const last = buckets[buckets.length - 1];
  const rangeLabel =
    granularity === "month"
      ? `${MONTH_LABELS[buckets[0].getUTCMonth()]} ${buckets[0].getUTCFullYear()} – ${MONTH_LABELS[last.getUTCMonth()]} ${last.getUTCFullYear()}`
      : `${buckets[0].getUTCDate()}/${buckets[0].getUTCMonth() + 1} – ${last.getUTCDate()}/${last.getUTCMonth() + 1}`;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setOffset((o) => o - 1)} className="text-charcoal/60 hover:text-charcoal px-3 py-1.5 rounded-lg hover:bg-porcelain transition text-sm">
          ← Anterior
        </button>
        <span className="text-charcoal font-semibold text-xs md:text-sm text-center">{rangeLabel}</span>
        <button
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={isCurrentWindow}
          className="text-charcoal/60 hover:text-charcoal px-3 py-1.5 rounded-lg hover:bg-porcelain transition text-sm disabled:opacity-30 disabled:hover:bg-transparent"
        >
          Siguiente →
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="Total cobrado" value={formatCurrency(totalCharged)} />
        <MiniStat label="Comisión" value={formatCurrency(totalCommission)} />
      </div>

      <div className="bg-ivory border border-mauve/10 rounded-xl p-6">
        {loading ? (
          <p className="text-charcoal/40 text-sm text-center py-8">Cargando...</p>
        ) : (
          <div className="flex items-end gap-1.5 h-36">
            {rows.map((r, i) => {
              const height = Math.round((r.chargedTotal / maxCharged) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  {r.chargedTotal > 0 && <span className="text-charcoal/50 text-[9px]">{formatCurrency(r.chargedTotal)}</span>}
                  <div className="w-full flex-1 flex items-end">
                    <div className="w-full rounded-t-sm bg-blush/70" style={{ height: r.chargedTotal > 0 ? `${Math.max(height, 6)}%` : "3px" }} />
                  </div>
                  <span className="text-[9px] text-charcoal/30">{bucketLabel(buckets[i], granularity)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const TABS: { key: "hoy" | Granularity; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "day", label: "Diario" },
  { key: "week", label: "Semanal" },
  { key: "month", label: "Mensual" },
];

const identityExtract = (json: unknown) => (Array.isArray(json) ? (json as EarningsPeriod[]) : []);

export default function EarningsTabs({ dayUrl, breakdownUrl, extractBreakdown = identityExtract }: EarningsTabsProps) {
  const [tab, setTab] = useState<"hoy" | Granularity>("hoy");

  return (
    <div>
      <div className="flex gap-1 mb-4 bg-porcelain/60 p-1 rounded-lg w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition ${
              tab === t.key ? "bg-ivory text-charcoal shadow-sm" : "text-charcoal/50 hover:text-charcoal"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "hoy" ? (
        <HoyTab dayUrl={dayUrl} />
      ) : (
        <BreakdownTab granularity={tab} breakdownUrl={breakdownUrl} extractBreakdown={extractBreakdown} />
      )}
    </div>
  );
}
