"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { Button } from "@/src/components/shared/Button";
import { usePermissions } from "@/src/hooks/usePermissions";

interface DeletionRequest {
  id: number;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  note: string | null;
  status: "Pending" | "Confirmed" | "Rejected";
  requestedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

const STATUS_LABELS: Record<DeletionRequest["status"], string> = {
  Pending: "Pendiente",
  Confirmed: "Confirmado (anonimizado)",
  Rejected: "Rechazado",
};

const STATUS_STYLES: Record<DeletionRequest["status"], string> = {
  Pending: "bg-amber-100 text-amber-700",
  Confirmed: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
};

export default function SolicitudesPrivacidadPage() {
  const router = useRouter();
  const { can, loading: loadingPermissions } = usePermissions();
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
      return;
    }
    loadRequests();
  }, [router]);

  const loadRequests = async () => {
    try {
      const res = await fetch("/api/data-deletion-requests");
      if (res.ok) setRequests(await res.json());
    } catch (error) {
      logError(error);
    } finally {
      setLoading(false);
    }
  };

  const resolve = async (id: number, action: "confirm" | "reject") => {
    const confirmMessage =
      action === "confirm"
        ? "Esto anonimiza de forma permanente los datos del cliente (nombre, teléfono, email) en perfiles, reservas y giros de ruleta. ¿Confirmar?"
        : "¿Rechazar este pedido sin modificar datos?";
    if (!window.confirm(confirmMessage)) return;

    setResolvingId(id);
    try {
      const res = await fetch(`/api/data-deletion-requests/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        showToast(
          "success",
          action === "confirm" ? "Datos anonimizados" : "Pedido rechazado",
          undefined
        );
        loadRequests();
      } else {
        const data = await res.json().catch(() => null);
        showToast("error", "No se pudo completar la acción", data?.message);
      }
    } catch (error) {
      showToast("error", "Error de conexión");
      logError(error);
    } finally {
      setResolvingId(null);
    }
  };

  if (loading || loadingPermissions) {
    return <div className="p-8 text-charcoal/60">Cargando...</div>;
  }

  const canResolve = can("Clientes", "Delete");
  const pending = requests.filter((r) => r.status === "Pending");
  const resolved = requests.filter((r) => r.status !== "Pending");

  return (
    <div className="p-6 space-y-8">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div>
        <h1 className="text-2xl font-bold text-charcoal">Solicitudes de borrado de datos</h1>
        <p className="text-charcoal/50 text-sm mt-1">
          Pedidos de clientes vía /privacidad/solicitar-borrado (Ley 25.326). Confirmar
          anonimiza nombre, teléfono y email en perfil, reservas y ruleta de fidelización —
          el turno en sí no se borra.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal/50">
          Pendientes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-charcoal/40 text-sm">No hay pedidos pendientes.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="bg-ivory border border-mauve/10 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                <div>
                  <p className="font-medium text-charcoal">{r.contactName}</p>
                  <p className="text-xs text-charcoal/50">
                    {[r.contactEmail, r.contactPhone].filter(Boolean).join(" · ")}
                  </p>
                  {r.note && <p className="text-xs text-charcoal/40 mt-1">&quot;{r.note}&quot;</p>}
                  <p className="text-xs text-charcoal/30 mt-1">
                    Pedido el {new Date(r.requestedAt).toLocaleDateString("es-AR")}
                  </p>
                </div>
                {canResolve && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      disabled={resolvingId === r.id}
                      onClick={() => resolve(r.id, "reject")}
                    >
                      Rechazar
                    </Button>
                    <Button
                      disabled={resolvingId === r.id}
                      onClick={() => resolve(r.id, "confirm")}
                    >
                      Confirmar y anonimizar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal/50">
            Resueltos
          </h2>
          <div className="space-y-2">
            {resolved.map((r) => (
              <div key={r.id} className="border border-mauve/10 rounded-xl p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-charcoal">{r.contactName}</p>
                  <p className="text-xs text-charcoal/40">
                    {r.resolvedAt && new Date(r.resolvedAt).toLocaleDateString("es-AR")}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[r.status]}`}>
                  {STATUS_LABELS[r.status]}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
