"use client";

import { useEffect, useState } from "react";

export interface TeamModeProfessional {
  id: number;
  firstName: string;
  lastName: string;
}

// Caché de módulo + dedupe de la promesa en vuelo (mismo patrón que
// src/lib/siteConfig.ts) — así montar el sidebar y la página admin en
// simultáneo no dispara dos fetches para lo mismo. GET /api/professionals ya
// tiene su propia caché de 60s invalidada por tag al crear/editar/borrar
// (app/api/professionals/route.ts), así que alcanza con no repetir el fetch
// dentro de la misma carga de página — no hace falta persistir en localStorage.
let cachedProfessionals: TeamModeProfessional[] | null = null;
let inFlight: Promise<TeamModeProfessional[]> | null = null;

async function fetchProfessionals(): Promise<TeamModeProfessional[]> {
  try {
    const res = await fetch("/api/professionals");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// "hasTeam = false" (0 profesionales activos) es el criterio único que usa
// toda la app — front y back — para decidir si un tenant está en "modo
// solo" (dueña sin empleados). Ver TimeSlotsController.AnyActiveProfessionalExistsAsync.
export function useTeamMode() {
  const [professionals, setProfessionals] = useState<TeamModeProfessional[]>(cachedProfessionals ?? []);
  const [loading, setLoading] = useState(cachedProfessionals === null);

  useEffect(() => {
    if (cachedProfessionals !== null) return;

    if (!inFlight) inFlight = fetchProfessionals();
    inFlight.then((data) => {
      cachedProfessionals = data;
      setProfessionals(data);
      setLoading(false);
    });
  }, []);

  return { hasTeam: professionals.length > 0, professionals, loading };
}
