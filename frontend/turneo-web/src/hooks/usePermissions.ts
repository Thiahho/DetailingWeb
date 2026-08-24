"use client";

import { useCallback, useEffect, useState } from "react";
import { getRole } from "@/src/lib/auth";

export type PermissionModuleKey =
  | "Turnos" | "Clientes" | "Servicios" | "Productos" | "Insumos"
  | "Profesionales" | "Caja" | "Contenido" | "Galeria" | "Automatizaciones" | "SmartTags" | "Ruleta" | "Resenas";

export type PermissionAction = "View" | "Create" | "Edit" | "Delete";

export interface ModulePermission {
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

// Permisos efectivos del usuario logueado. Admin siempre puede todo (no hace
// falta ni pedirlo al backend). Staff trae su grilla real desde /api/permissions/me.
// Esto es solo UX (ocultar/deshabilitar) — la seguridad real la aplica el backend
// vía RequirePermission en cada endpoint.
export function usePermissions() {
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentRole = getRole();
    setRole(currentRole);

    if (currentRole === "Admin") {
      setLoading(false);
      return;
    }

    fetch("/api/permissions/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setRole(data.role);
          setPermissions(data.permissions ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const can = useCallback(
    (module: PermissionModuleKey, action: PermissionAction): boolean => {
      if (role === "Admin") return true;
      const perm = permissions.find((p) => p.module === module);
      if (!perm) return false;
      if (action === "View") return perm.canView;
      if (action === "Create") return perm.canCreate;
      if (action === "Edit") return perm.canEdit;
      return perm.canDelete;
    },
    [role, permissions]
  );

  return { role, permissions, can, loading, isAdmin: role === "Admin", isStaff: role === "Staff" };
}
