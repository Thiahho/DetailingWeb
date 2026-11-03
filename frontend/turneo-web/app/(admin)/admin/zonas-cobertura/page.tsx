"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import type { LocalidadSuggestion } from "@/src/lib/geo/geo";
import {
  coverageLocalityFromSuggestion,
  toCoverageLocalityRequest,
  type CoverageLocality,
  type CoverageLocalityRequest,
} from "@/src/lib/homeService/coverageLocality";
import LocalitySearch from "./_components/LocalitySearch";
import CoverageLocalityRow from "./_components/CoverageLocalityRow";

const API = "/api/home-service/coverage-localities";
const CONNECTION_ERROR = "No se pudo conectar con el servidor";

async function readMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.message === "string" && data.message ? data.message : fallback;
  } catch {
    return fallback;
  }
}

export default function ZonasCoberturaPage() {
  const router = useRouter();
  const [localities, setLocalities] = useState<CoverageLocality[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const { toasts, showToast, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
      return;
    }
    let ignore = false;
    fetch(API)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!ignore) setLocalities(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        logError("Error cargando zonas de cobertura:", error);
        if (!ignore) setLoadFailed(true);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [router]);

  const add = async (suggestion: LocalidadSuggestion) => {
    const body: CoverageLocalityRequest = { ...coverageLocalityFromSuggestion(suggestion), surcharge: null, isActive: true };
    setBusyId("new");
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        showToast("error", "No se pudo agregar la localidad", await readMessage(res, "Intentá de nuevo"));
        return;
      }
      const created: CoverageLocality = await res.json();
      setLocalities((prev) => [...prev, created]);
      showToast("success", "Localidad agregada", `${created.name}, ${created.province}`);
    } catch {
      showToast("error", "No se pudo agregar la localidad", CONNECTION_ERROR);
    } finally {
      setBusyId(null);
    }
  };

  const save = async (locality: CoverageLocality, patch: Partial<CoverageLocalityRequest>) => {
    setBusyId(locality.id);
    try {
      const res = await fetch(`${API}/${locality.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toCoverageLocalityRequest(locality, patch)),
      });
      if (!res.ok) {
        showToast("error", "No se pudo guardar", await readMessage(res, "Intentá de nuevo"));
        return false;
      }
      const updated: CoverageLocality = await res.json();
      setLocalities((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      showToast("success", "Cambios guardados");
      return true;
    } catch {
      showToast("error", "No se pudo guardar", CONNECTION_ERROR);
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (locality: CoverageLocality) => {
    const ok = await confirm({
      title: "Quitar localidad",
      message: `¿Quitar ${locality.name} de tu zona de cobertura? Los turnos ya reservados no cambian.`,
      confirmLabel: "Quitar",
    });
    if (!ok) return;
    setBusyId(locality.id);
    try {
      const res = await fetch(`${API}/${locality.id}`, { method: "DELETE" });
      if (!res.ok) {
        showToast("error", "No se pudo quitar la localidad", await readMessage(res, "Intentá de nuevo"));
        return;
      }
      setLocalities((prev) => prev.filter((l) => l.id !== locality.id));
      showToast("success", "Localidad quitada", locality.name);
    } catch {
      showToast("error", "No se pudo quitar la localidad", CONNECTION_ERROR);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando zonas de cobertura...</p>
      </div>
    );
  }

  return (
    <div data-testid="zonas-cobertura-page" className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {ConfirmDialog}

      <div className="mx-auto max-w-3xl">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Zonas de cobertura</h1>
          <p className="text-charcoal/50 text-sm mt-1">
            Localidades donde prestás los servicios a domicilio. Podés sumar un recargo por traslado a cada una.
          </p>
        </div>

        {loadFailed ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
            No se pudieron cargar las zonas de cobertura. Recargá la página para intentar de nuevo.
          </div>
        ) : (
          <>
            <div className="mb-6 rounded-xl border border-mauve/15 bg-ivory p-4">
              <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Agregar localidad</label>
              <div className="mt-1.5">
                <LocalitySearch onPick={add} disabled={busyId === "new"} />
              </div>
            </div>

            {localities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-mauve/15 px-6 py-16 text-center">
                <MapPin className="mx-auto size-6 text-charcoal/30" />
                <p className="mt-3 text-charcoal/60">Todavía no cargaste ninguna localidad</p>
                <p className="mt-1 text-sm text-charcoal/40">
                  Mientras no haya localidades activas, nadie va a poder reservar servicios a domicilio.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-mauve/10 overflow-hidden rounded-xl border border-mauve/15 bg-ivory">
                {localities.map((locality) => (
                  <CoverageLocalityRow
                    key={locality.id}
                    locality={locality}
                    busy={busyId === locality.id}
                    onSave={save}
                    onDelete={remove}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
