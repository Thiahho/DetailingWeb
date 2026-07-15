"use client";

import { useCallback, useMemo } from "react";
import { Calendar, dateFnsLocalizer, Views, type View } from "react-big-calendar";
import withDragAndDrop, { type EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

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
  professionalFilter: number | "all";
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
  professionalFilter,
}: AgendaCalendarProps) {
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

  const resources = useMemo(() => {
    const list = professionals.map((p) => ({
      resourceId: p.id,
      resourceTitle: `${p.firstName} ${p.lastName}`,
    }));
    const hasUnassigned = filteredSlots.some((s) => !s.professionalId);
    if (hasUnassigned) list.push({ resourceId: UNASSIGNED, resourceTitle: "Sin asignar" });
    return professionalFilter === "all" ? list : list.filter((r) => r.resourceId === professionalFilter);
  }, [professionals, filteredSlots, professionalFilter]);

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
    ({ event, start, resourceId }: EventInteractionArgs<AgendaEvent>) => {
      if (!event.bookingId) return; // solo se puede arrastrar un turno reservado

      const targetProfessionalId = resourceId === undefined ? event.resourceId : Number(resourceId);
      const dropStart = new Date(start).getTime();
      const dropDay = new Date(start).toDateString();

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
        alert("No hay ningún turno disponible ese día para ese profesional.");
        return;
      }

      const closest = candidates.reduce((best, s) => {
        const diff = Math.abs(new Date(s.startDateTime).getTime() - dropStart);
        const bestDiff = Math.abs(new Date(best.startDateTime).getTime() - dropStart);
        return diff < bestDiff ? s : best;
      });

      onReschedule(event.bookingId, closest.id);
    },
    [slots, onReschedule]
  );

  return (
    <div className="agenda-calendar bg-ivory border border-mauve/5 rounded-2xl p-4" data-testid="agenda-calendar">
      <DnDCalendar
        localizer={localizer}
        culture="es"
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
        style={{ height: 640 }}
        eventPropGetter={eventPropGetter}
        onSelectEvent={handleSelectEvent}
        draggableAccessor={(event: AgendaEvent) => Boolean(event.bookingId)}
        onEventDrop={handleEventDrop}
        resizable={false}
        components={{ event: AgendaEventContent }}
        messages={{
          week: "Semana",
          day: "Día",
          today: "Hoy",
          previous: "Anterior",
          next: "Siguiente",
          noEventsInRange: "Sin turnos en este rango",
        }}
      />
    </div>
  );
}
