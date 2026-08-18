"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isProfessionalAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";

interface Booking {
  id: number;
  customerName: string;
  customerPhone: string;
  subject?: string;
  service?: string;
  status: string;
}

interface TimeSlot {
  id: number;
  startDateTime: string;
  label: string;
  booking?: Booking;
}

function isExpired(startDateTime: string) {
  return new Date(startDateTime) < new Date();
}

const statusLabel: Record<string, string> = {
  Confirmed: "Confirmado",
  Pending: "Pendiente",
};

export default function ProfesionalHistorialPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isProfessionalAuthenticated()) {
      router.push(getRole() === "Admin" ? "/admin/turnos" : "/profesional/login");
      return;
    }

    fetch("/api/timeslots/mine")
      .then((res) => {
        if (res.status === 401) {
          router.push("/profesional/login");
          return [];
        }
        return res.ok ? res.json() : [];
      })
      .then(setSlots)
      .catch((error) => logError("Error cargando historial:", error))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando tu historial...</p>
      </div>
    );
  }

  const past = slots
    .filter((s) => isExpired(s.startDateTime) && s.booking)
    .sort((a, b) => b.startDateTime.localeCompare(a.startDateTime));

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Historial</h1>
          <p className="text-charcoal/50 text-sm mt-1">Turnos pasados con reserva</p>
        </div>

        <div className="bg-ivory border border-mauve/10 rounded-xl p-6">
          {past.length === 0 ? (
            <p className="text-charcoal/40 text-sm py-8 text-center">Todavía no tenés turnos pasados.</p>
          ) : (
            <div className="space-y-2">
              {past.map((slot) => (
                <div
                  key={slot.id}
                  data-testid="historial-slot-item"
                  className={`p-4 rounded-xl border ${
                    slot.booking?.status === "Confirmed"
                      ? "border-blue-500/20 bg-blue-500/5"
                      : "border-orange-500/20 bg-orange-500/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-charcoal font-medium text-sm">{slot.label}</p>
                      <p className="text-charcoal/60 text-xs mt-1">
                        {slot.booking?.customerName} · {slot.booking?.customerPhone}
                        {slot.booking?.service && ` · ${slot.booking.service}`}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        slot.booking?.status === "Confirmed"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-orange-500/20 text-orange-400"
                      }`}
                    >
                      {slot.booking ? statusLabel[slot.booking.status] ?? slot.booking.status : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
