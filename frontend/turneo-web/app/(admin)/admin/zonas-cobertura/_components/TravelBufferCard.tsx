"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { logError } from "@/src/lib/logger";
import {
  MAX_TRAVEL_BUFFER_MINUTES,
  isTravelBufferChanged,
  parseTravelBufferMinutes,
  type TravelBuffer,
} from "@/src/lib/homeService/travelBuffer";

const API = "/api/home-service/travel-buffer";

type ShowToast = (type: "success" | "error", title: string, message?: string) => void;

async function readMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.message === "string" && data.message ? data.message : fallback;
  } catch {
    return fallback;
  }
}

// Saves only the travel buffer (dedicated endpoint): the agenda slots are not regenerated.
export default function TravelBufferCard({ showToast }: { showToast: ShowToast }) {
  const [saved, setSaved] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch(API)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: TravelBuffer = await res.json();
        if (!ignore) {
          setSaved(data.minutes);
          setInput(String(data.minutes));
        }
      })
      .catch((err) => {
        logError("Error cargando el tiempo de traslado:", err);
        if (!ignore) setLoadFailed(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const parsed = parseTravelBufferMinutes(input);
  const changed = saved !== null && isTravelBufferChanged(input, saved);
  // `in` narrowing: tsconfig has strict off, so `!parsed.ok` does not narrow the union.
  const error = saved !== null && "message" in parsed ? parsed.message : "";

  const save = async () => {
    if ("message" in parsed) return;
    setBusy(true);
    try {
      const res = await fetch(API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: parsed.value }),
      });
      if (!res.ok) {
        showToast("error", "No se pudo guardar el tiempo de traslado", await readMessage(res, "Intentá de nuevo"));
        return;
      }
      const data: TravelBuffer = await res.json();
      setSaved(data.minutes);
      setInput(String(data.minutes));
      showToast("success", "Tiempo de traslado guardado");
    } catch {
      showToast("error", "No se pudo guardar el tiempo de traslado", "No se pudo conectar con el servidor");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="travel-buffer-card" className="mb-6 rounded-xl border border-mauve/15 bg-ivory p-4">
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-charcoal/40" />
        <label htmlFor="travel-buffer-minutes" className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">
          Tiempo de traslado
        </label>
      </div>
      <p className="mt-1 text-sm text-charcoal/50">
        Margen entre dos turnos a domicilio del mismo profesional. 0 lo desactiva.
      </p>

      {loadFailed ? (
        <p className="mt-3 text-sm text-red-700">No se pudo cargar el tiempo de traslado. Recargá la página para intentar de nuevo.</p>
      ) : (
        <form
          className="mt-3 flex flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (changed) save();
          }}
        >
          <div className="flex items-center gap-2">
            <div className="relative w-36">
              <input
                id="travel-buffer-minutes"
                data-testid="travel-buffer-minutes"
                className="form-input !py-2 !pr-12"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_TRAVEL_BUFFER_MINUTES}
                step={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={saved === null ? "Cargando..." : undefined}
                disabled={saved === null || busy}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-charcoal/40">min</span>
            </div>
            <Button type="submit" size="sm" data-testid="travel-buffer-save" disabled={!changed || busy}>
              Guardar
            </Button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
