"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";

const ESTADOS = [
  "Nuevo",
  "Contactado",
  "Conversando",
  "Interesado",
  "DemoSolicitada",
  "DemoRealizada",
  "SuscripcionIniciada",
  "Cliente",
  "NoResponde",
  "NoInteresado",
  "BeneficioVencido",
  "Perdido",
];

interface RouletteLead {
  id: number;
  nombreNegocio: string;
  nombreResponsable: string | null;
  whatsApp: string;
  email: string | null;
  instagram: string | null;
  tipoNegocio: string | null;
  cantidadProfesionales: string | null;
  problemaPrincipal: string | null;
  premioNombre: string;
  codigoPromocional: string;
  fechaParticipacion: string;
  codigoVenceAt: string;
  fuente: string | null;
  campaign: string | null;
  estado: string;
  notas: string | null;
  fechaUltimoContacto: string | null;
}

export default function PlatformRoulettePage() {
  const { toasts, showToast, removeToast } = useToast();
  const [leads, setLeads] = useState<RouletteLead[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeads = async () => {
    const res = await fetch("/api/platform/roulette/leads", { credentials: "include" });
    if (res.ok) setLeads(await res.json());
  };

  useEffect(() => {
    loadLeads().finally(() => setLoading(false));
  }, []);

  const handleStatusChange = async (id: number, estado: string) => {
    const previous = leads;
    setLeads(leads.map((l) => (l.id === id ? { ...l, estado } : l)));

    const res = await fetch(`/api/platform/roulette/leads/${id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });

    if (!res.ok) {
      setLeads(previous);
      showToast("error", "No se pudo actualizar el estado", "");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 text-white">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="flex items-center gap-4 text-sm text-white/50">
        <Link href="/platform/tenants" className="hover:text-white">Tenants</Link>
        <span className="font-semibold text-white">Ruleta</span>
      </div>

      <h1 className="mt-2 text-2xl font-bold">Leads de la Ruleta</h1>
      <p className="mt-1 text-sm text-white/50">
        Participaciones de la ruleta de captación (docs/RULETA.pdf).
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-white/50">Cargando...</p>
      ) : leads.length === 0 ? (
        <p className="mt-8 text-sm text-white/50">Todavía no hay leads.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-white/60">
              <tr>
                <th className="px-4 py-3">Negocio</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3">Premio</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Fuente</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-white/10 align-top">
                  <td className="px-4 py-3">
                    <div>{l.nombreNegocio}</div>
                    {l.nombreResponsable && (
                      <div className="text-xs text-white/40">{l.nombreResponsable}</div>
                    )}
                    {l.tipoNegocio && (
                      <div className="text-xs text-white/40">{l.tipoNegocio}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    <div>{l.whatsApp}</div>
                    {l.email && <div className="text-xs text-white/40">{l.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-white/70">{l.premioNombre}</td>
                  <td className="px-4 py-3 font-mono text-xs text-white/70">
                    {l.codigoPromocional}
                    <div className="text-white/40">
                      vence {new Date(l.codigoVenceAt).toLocaleDateString("es-AR")}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/50">
                    <div>{l.fuente || "—"}</div>
                    {l.campaign && <div className="text-xs">{l.campaign}</div>}
                  </td>
                  <td className="px-4 py-3 text-white/50">
                    {new Date(l.fechaParticipacion).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-white focus:border-white/30 focus:outline-none"
                      value={l.estado}
                      onChange={(e) => handleStatusChange(l.id, e.target.value)}
                    >
                      {ESTADOS.map((estado) => (
                        <option key={estado} value={estado} className="text-charcoal">
                          {estado}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
