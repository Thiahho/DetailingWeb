"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type View,
  type ResourceHeaderProps,
} from "react-big-calendar";
import withDragAndDrop, { type EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, endOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "./agenda-calendar.css";

const locales = { es };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const UNASSIGNED = 0;

export interface AgendaBooking {
  id: number;
  customerName: string;
  professionalId?: number | null;
  status: string;
}

export interface AgendaTimeSlot {
  id: number;
  startDateTime: string;
  endDateTime: string;
  isAvailable: boolean;
  professionalId?: number | null;
  professionalName?: string | null;
  booking?: AgendaBooking;
}

export interface AgendaProfessional {
  id: number;
  firstName: string;
  lastName: string;
  calendarColor?: string;
  schedule?: string | null;
}

interface AgendaEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resourceId: number;
  isAvailable: boolean;
  bookingId?: number;
  bookingStatus?: string;
  color: string;
}

interface AgendaResource {
  resourceId: number;
  resourceTitle: string;
  color: string;
}

interface AgendaCalendarProps {
  slots: AgendaTimeSlot[];
  professionals: AgendaProfessional[];
  view: "week" | "day";
  date: Date;
  onNavigate: (date: Date) => void;
  onViewChange: (view: "week" | "day") => void;
  onSelectAvailable: (slotId: number) => void;
  onSelectBooking: (slotId: number) => void;
  onReschedule: (bookingId: number, newTimeSlotId: number) => void;
  onCreateAndReschedule?: (bookingId: number, professionalId: number, startDateTime: string, endDateTime: string) => void;
  onError?: (message: string) => void;
  professionalFilter: number | "all";
}

interface WeeklyScheduleDay {
  dayOfWeek: number; // 0=Domingo..6=Sábado, igual que Date.getDay()
  start: string; // "HH:mm"
  end: string;
  enabled: boolean;
}

// Mismo criterio que ProfessionalsController.IsWorkingDuringSlot en el backend:
// sin horario cargado = disponible por defecto.
function isWithinSchedule(scheduleJson: string | null | undefined, start: Date, end: Date): boolean {
  if (!scheduleJson) return true;

  let schedule: WeeklyScheduleDay[];
  try {
    schedule = JSON.parse(scheduleJson);
  } catch {
    return true;
  }
  if (!Array.isArray(schedule) || schedule.length === 0) return true;

  const dayOfWeek = start.getDay();
  const toMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);

  return schedule.some((day) => {
    if (!day.enabled || day.dayOfWeek !== dayOfWeek) return false;
    const [sh, sm] = day.start.split(":").map(Number);
    const [eh, em] = day.end.split(":").map(Number);
    return startMin >= sh * 60 + sm && endMin <= eh * 60 + em;
  });
}

// Formatea en hora local sin pasar por UTC — el backend interpreta
// StartDateTime/EndDateTime como hora Argentina, no como ISO con Z.
function toLocalIsoString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ── Tamaño de la grilla — "jugar con el tamaño" para acomodar la vista según
// pantalla/preferencia, persistido para no tener que reajustarlo cada vez. ──
type Density = "compact" | "comfortable" | "spacious";
const DENSITY_HEIGHTS: Record<Density, number> = { compact: 420, comfortable: 640, spacious: 820 };
const DENSITY_LABELS: Record<Density, string> = { compact: "S", comfortable: "M", spacious: "L" };
const DENSITY_STORAGE_KEY = "Turneo-agenda-density";

function readStoredDensity(): Density | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(DENSITY_STORAGE_KEY);
  return stored === "compact" || stored === "comfortable" || stored === "spacious" ? stored : null;
}

const DnDCalendar = withDragAndDrop<AgendaEvent, AgendaResource>(Calendar);

function AgendaEventContent({ event }: { event: AgendaEvent }) {
  return (
    <span
      data-testid={event.isAvailable ? "agenda-event-available" : "agenda-event-booking"}
      data-slot-id={event.id}
      data-booking-id={event.bookingId ?? ""}
    >
      {event.title}
    </span>
  );
}

// Se renderiza afuera del contenedor con scroll horizontal de la grilla —
// si viviera adentro (como el toolbar default de RBC), en mobile con varias
// columnas de profesional quedaría fuera de vista sin scrollear a mano.
interface AgendaToolbarProps {
  view: "week" | "day";
  date: Date;
  density: Density;
  onDensityChange: (d: Density) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function formatAgendaLabel(view: "week" | "day", date: Date): string {
  if (view === "day") {
    const s = format(date, "EEEE d 'de' MMMM", { locale: es });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  const start = startOfWeek(date, { locale: es });
  const end = endOfWeek(date, { locale: es });
  return start.getMonth() === end.getMonth()
    ? `${format(start, "d")} – ${format(end, "d 'de' MMMM", { locale: es })}`
    : `${format(start, "d MMM", { locale: es })} – ${format(end, "d MMM", { locale: es })}`;
}

function AgendaToolbar({ view, date, density, onDensityChange, onPrev, onNext, onToday }: AgendaToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3 px-1 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="agenda-toolbar-prev"
            onClick={onPrev}
            className="p-1.5 rounded-lg text-charcoal/50 hover:text-charcoal hover:bg-porcelain/10 transition"
            aria-label="Período anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            data-testid="agenda-toolbar-next"
            onClick={onNext}
            className="p-1.5 rounded-lg text-charcoal/50 hover:text-charcoal hover:bg-porcelain/10 transition"
            aria-label="Período siguiente"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            data-testid="agenda-toolbar-today"
            onClick={onToday}
            className="ml-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-blush bg-blush/10 hover:bg-blush/15 transition"
          >
            Hoy
          </button>
        </div>
        <p className="text-charcoal font-semibold text-sm">{formatAgendaLabel(view, date)}</p>
      </div>

      <div className="flex items-center gap-1 bg-porcelain/10 rounded-lg p-1" data-testid="agenda-density-control">
        {(Object.keys(DENSITY_HEIGHTS) as Density[]).map((d) => (
          <button
            key={d}
            type="button"
            data-testid={`agenda-density-${d}`}
            onClick={() => onDensityChange(d)}
            title={d === "compact" ? "Vista compacta" : d === "comfortable" ? "Vista media" : "Vista amplia"}
            className={`w-6 h-6 rounded-md text-[11px] font-bold transition ${
              density === d ? "bg-blush text-white" : "text-charcoal/50 hover:text-charcoal hover:bg-porcelain/10"
            }`}
          >
            {DENSITY_LABELS[d]}
          </button>
        ))}
      </div>
    </div>
  );
}

function AgendaResourceHeader({ resource }: ResourceHeaderProps<AgendaResource>) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-0.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: resource.color }} />
      <span className="text-charcoal text-xs font-semibold truncate">{resource.resourceTitle}</span>
    </div>
  );
}

export default function AgendaCalendar({
  slots,
  professionals,
  view,
  date,
  onNavigate,
  onViewChange,
  onSelectAvailable,
  onSelectBooking,
  onReschedule,
  onCreateAndReschedule,
  onError,
  professionalFilter,
}: AgendaCalendarProps) {
  // Densidad: respeta preferencia guardada; si es la primera vez y la pantalla
  // es angosta, arranca compacta para no forzar scroll vertical infinito en mobile.
  const [density, setDensity] = useState<Density>(() => readStoredDensity() ?? "comfortable");

  useEffect(() => {
    if (readStoredDensity() !== null) return;
    if (typeof window !== "undefined" && window.innerWidth < 768) setDensity("compact");
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
  }, [density]);

  const stepDate = useCallback(
    (direction: 1 | -1) => {
      const next = new Date(date);
      next.setDate(next.getDate() + direction * (view === "week" ? 7 : 1));
      onNavigate(next);
    },
    [date, view, onNavigate]
  );

  const professionalColor = useCallback(
    (id?: number | null) => professionals.find((p) => p.id === id)?.calendarColor || "#7c3aed",
    [professionals]
  );

  const filteredSlots = useMemo(
    () =>
      professionalFilter === "all"
        ? slots
        : slots.filter((s) => (s.professionalId ?? UNASSIGNED) === professionalFilter),
    [slots, professionalFilter]
  );

  const events: AgendaEvent[] = useMemo(
    () =>
      filteredSlots.map((s) => ({
        id: s.id,
        title: s.isAvailable
          ? `Libre${s.professionalName ? ` · ${s.professionalName}` : ""}`
          : `${s.booking?.customerName ?? "Reservado"}`,
        start: new Date(s.startDateTime),
        end: new Date(s.endDateTime),
        resourceId: s.professionalId ?? UNASSIGNED,
        isAvailable: s.isAvailable,
        bookingId: s.booking?.id,
        bookingStatus: s.booking?.status,
        color: professionalColor(s.professionalId),
      })),
    [filteredSlots, professionalColor]
  );

  const resources: AgendaResource[] = useMemo(() => {
    const list = professionals.map((p) => ({
      resourceId: p.id,
      resourceTitle: `${p.firstName} ${p.lastName}`,
      color: professionalColor(p.id),
    }));
    const hasUnassigned = filteredSlots.some((s) => !s.professionalId);
    // "Sin asignar" solo tiene sentido cuando hay equipo (algunos turnos sí
    // tienen profesional). Con cero profesionales en el tenant, todo turno
    // no asignado es simplemente el negocio — no hay ninguna "asignación" que mencionar.
    if (hasUnassigned) {
      list.push({
        resourceId: UNASSIGNED,
        resourceTitle: professionals.length === 0 ? "Agenda" : "Sin asignar",
        color: "#9C7C88",
      });
    }
    return professionalFilter === "all" ? list : list.filter((r) => r.resourceId === professionalFilter);
  }, [professionals, filteredSlots, professionalFilter, professionalColor]);

  const eventPropGetter = useCallback((event: AgendaEvent) => {
    if (event.isAvailable) {
      return {
        style: {
          backgroundColor: "transparent",
          border: `1.5px dashed ${event.color}`,
          color: "#1f2937",
        },
      };
    }
    const confirmed = event.bookingStatus === "Confirmed";
    return {
      style: {
        backgroundColor: event.color,
        opacity: confirmed ? 1 : 0.75,
        border: confirmed ? "2px solid rgba(0,0,0,0.25)" : "none",
        color: "#fff",
      },
    };
  }, []);

  const handleSelectEvent = useCallback(
    (event: AgendaEvent) => {
      if (event.isAvailable) onSelectAvailable(event.id);
      else onSelectBooking(event.id);
    },
    [onSelectAvailable, onSelectBooking]
  );

  const handleEventDrop = useCallback(
    ({ event, start, end, resourceId }: EventInteractionArgs<AgendaEvent>) => {
      if (!event.bookingId) return; // solo se puede arrastrar un turno reservado

      const targetProfessionalId = resourceId === undefined ? event.resourceId : Number(resourceId);
      const dropStartDate = new Date(start);
      const dropEndDate = new Date(end);
      const dropStart = dropStartDate.getTime();
      const dropDay = dropStartDate.toDateString();
      const proName = resources.find((r) => r.resourceId === targetProfessionalId)?.resourceTitle ?? "ese profesional";

      // Los slots son recursos fijos generados por BusinessSettings, no horarios libres:
      // se busca el turno disponible más cercano en ese día para ese profesional,
      // en vez de exigir que coincida al minuto con el punto exacto donde se soltó.
      const candidates = slots.filter(
        (s) =>
          s.id !== event.id &&
          s.isAvailable &&
          (s.professionalId ?? UNASSIGNED) === targetProfessionalId &&
          new Date(s.startDateTime).toDateString() === dropDay
      );

      if (candidates.length === 0) {
        // Sin turno libre ese día: si cae dentro del horario laboral del profesional,
        // se crea un turno nuevo justo ahí en vez de bloquear el movimiento (un
        // profesional sin asignar no tiene horario propio para validar contra).
        const targetProfessional = professionals.find((p) => p.id === targetProfessionalId);
        if (targetProfessionalId !== UNASSIGNED && isWithinSchedule(targetProfessional?.schedule, dropStartDate, dropEndDate)) {
          onCreateAndReschedule?.(
            event.bookingId,
            targetProfessionalId,
            toLocalIsoString(dropStartDate),
            toLocalIsoString(dropEndDate)
          );
          return;
        }

        onError?.(`No hay turnos libres ese día para ${proName} y ese horario está fuera de su jornada laboral.`);
        return;
      }

      const closest = candidates.reduce((best, s) => {
        const diff = Math.abs(new Date(s.startDateTime).getTime() - dropStart);
        const bestDiff = Math.abs(new Date(best.startDateTime).getTime() - dropStart);
        return diff < bestDiff ? s : best;
      });

      onReschedule(event.bookingId, closest.id);
    },
    [slots, professionals, onReschedule, onCreateAndReschedule, onError, resources]
  );

  // Ancho mínimo para que las columnas de profesional no queden ilegibles en
  // mobile — fuerza scroll horizontal en vez de comprimir todo, en lugar de
  // scroll vertical infinito. Semana multiplica por 7 días.
  const columnCount = Math.max(resources.length, 1) * (view === "week" ? 7 : 1);
  const minWidth = Math.max(columnCount * 130, 320);

  return (
    <div className="agenda-calendar bg-ivory border border-mauve/5 rounded-2xl p-3 md:p-4" data-testid="agenda-calendar">
      <AgendaToolbar
        view={view}
        date={date}
        density={density}
        onDensityChange={setDensity}
        onPrev={() => stepDate(-1)}
        onNext={() => stepDate(1)}
        onToday={() => onNavigate(new Date())}
      />
      <div className="overflow-x-auto">
        <DnDCalendar
          localizer={localizer}
          culture="es"
          toolbar={false}
          events={events}
          resources={resources}
          resourceIdAccessor="resourceId"
          resourceTitleAccessor="resourceTitle"
          view={view as View}
          onView={(v) => onViewChange(v as "week" | "day")}
          views={[Views.WEEK, Views.DAY]}
          date={date}
          onNavigate={onNavigate}
          startAccessor="start"
          endAccessor="end"
          step={30}
          timeslots={2}
          min={new Date(1970, 0, 1, 7, 0)}
          max={new Date(1970, 0, 1, 22, 0)}
          style={{ height: DENSITY_HEIGHTS[density], minWidth }}
          eventPropGetter={eventPropGetter}
          onSelectEvent={handleSelectEvent}
          draggableAccessor={(event: AgendaEvent) => Boolean(event.bookingId)}
          onEventDrop={handleEventDrop}
          resizable={false}
          components={{ event: AgendaEventContent, resourceHeader: AgendaResourceHeader }}
          messages={{ noEventsInRange: "Sin turnos en este rango" }}
        />
      </div>
    </div>
  );
}
