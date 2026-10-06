"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, isFullAdmin, getRole } from "@/src/lib/auth";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import { Button } from "@/src/components/shared/Button";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

interface StaffPermission {
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface StaffUser {
  id: number;
  email: string;
  username?: string | null;
  type?: "Staff" | "Professional";
  professionalId?: number | null;
  professionalName?: string | null;
  permissions: StaffPermission[];
}

// Profesional del Equipo con acceso ya activado (ver /admin/profesionales),
// candidato a que se le otorguen permisos de panel desde acá.
interface ProfessionalOption {
  id: number;
  firstName: string;
  lastName: string;
  accountUserId: number | null;
  accountEmail: string | null;
  accountUsername: string | null;
}

type PermFlag = "canView" | "canCreate" | "canEdit" | "canDelete";
type PermGrid = Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>;

const MODULE_LABELS: Record<string, string> = {
  Turnos: "Turnos (turnos, calendario, historial)",
  Clientes: "Clientes",
  Servicios: "Servicios",
  Productos: "Productos",
  Insumos: "Insumos",
  Profesionales: "Equipo",
  Caja: "Caja",
  Contenido: "Contenido",
  Galeria: "Galería",
  Resenas: "Reseñas",
  Automatizaciones: "Automatizaciones",
};

const ACTION_LABELS: { key: PermFlag; label: string }[] = [
  { key: "canView", label: "Ver" },
  { key: "canCreate", label: "Crear" },
  { key: "canEdit", label: "Editar" },
  { key: "canDelete", label: "Eliminar" },
];

const emptyCell = { canView: false, canCreate: false, canEdit: false, canDelete: false };

function grantedModules(permissions: StaffPermission[]) {
  return permissions.filter((p) => p.canView || p.canCreate || p.canEdit || p.canDelete);
}

export default function PermisosPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const { toasts, showToast, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", username: "", password: "" });
  const [creating, setCreating] = useState(false);
  const createFormRef = useRef<HTMLFormElement>(null);

  const [showLinkPicker, setShowLinkPicker] = useState(false);

  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [editGrid, setEditGrid] = useState<PermGrid>({});
  const [savingGrid, setSavingGrid] = useState(false);

  const [passwordStaff, setPasswordStaff] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const passwordFormRef = useRef<HTMLFormElement>(null);

  useModalHotkeys(showCreateForm, { onClose: () => setShowCreateForm(false), onSubmit: () => createFormRef.current?.requestSubmit() });
  useModalHotkeys(!!editingStaff, { onClose: () => setEditingStaff(null) });
  useModalHotkeys(!!passwordStaff, { onClose: () => setPasswordStaff(null), onSubmit: () => passwordFormRef.current?.requestSubmit() });

  useEffect(() => {
    if (!isAdminAuthenticated()) { router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login"); return; }
    if (!isFullAdmin()) { router.push("/admin"); return; }

    Promise.all([
      fetch("/api/permissions/staff").then((r) => r.json()),
      fetch("/api/permissions/modules").then((r) => r.json()),
      fetch("/api/professionals/all").then((r) => r.json()),
    ])
      .then(([staffData, modulesData, professionalsData]) => {
        if (Array.isArray(staffData)) setStaff(staffData);
        if (Array.isArray(modulesData)) setModules(modulesData);
        if (Array.isArray(professionalsData)) setProfessionals(professionalsData);
      })
      .finally(() => setLoading(false));
  }, [router]);

  // Profesionales con acceso activado que todavía no tienen fila en Permisos —
  // candidatos para "Vincular profesional".
  const linkableProfessionals = professionals.filter(
    (p) => p.accountUserId != null && !staff.some((s) => s.id === p.accountUserId)
  );

  const openCreate = () => {
    setCreateForm({ email: "", username: "", password: "" });
    setShowCreateForm(true);
  };

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/permissions/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", "Cuenta creada", "Ahora asignale permisos por módulo.");
        setStaff((prev) => [...prev, { id: data.id, email: data.email, username: data.username, type: "Staff", permissions: [] }]);
        setShowCreateForm(false);
      } else {
        showToast("error", "No se pudo crear la cuenta", data.message);
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor.");
    } finally {
      setCreating(false);
    }
  };

  const linkProfessional = (p: ProfessionalOption) => {
    if (p.accountUserId == null) return;
    setShowLinkPicker(false);
    openEdit({
      id: p.accountUserId,
      email: p.accountEmail ?? "",
      username: p.accountUsername,
      type: "Professional",
      professionalId: p.id,
      professionalName: `${p.firstName} ${p.lastName}`,
      permissions: [],
    });
  };

  const openEdit = (s: StaffUser) => {
    const grid: PermGrid = {};
    for (const m of modules) {
      const existing = s.permissions.find((p) => p.module === m);
      grid[m] = existing
        ? { canView: existing.canView, canCreate: existing.canCreate, canEdit: existing.canEdit, canDelete: existing.canDelete }
        : { ...emptyCell };
    }
    setEditGrid(grid);
    setEditingStaff(s);
  };

  const toggleCell = (module: string, flag: PermFlag) => {
    setEditGrid((prev) => {
      const cell = { ...prev[module], [flag]: !prev[module][flag] };
      // "Crear/Editar/Eliminar" un módulo sin poder verlo no tiene sentido en la UI del panel.
      if (flag !== "canView" && cell[flag]) cell.canView = true;
      return { ...prev, [module]: cell };
    });
  };

  const savePermissions = async () => {
    if (!editingStaff) return;
    setSavingGrid(true);
    try {
      const permissions = modules
        .map((m) => ({ module: m, ...editGrid[m] }))
        .filter((p) => p.canView || p.canCreate || p.canEdit || p.canDelete);

      const res = await fetch(`/api/permissions/staff/${editingStaff.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", "Permisos actualizados");
        setStaff((prev) =>
          prev.some((s) => s.id === editingStaff.id)
            ? prev.map((s) => (s.id === editingStaff.id ? { ...s, permissions } : s))
            : [...prev, { ...editingStaff, permissions }]
        );
        setEditingStaff(null);
      } else {
        showToast("error", "No se pudo guardar", data.message);
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor.");
    } finally {
      setSavingGrid(false);
    }
  };

  const openPassword = (s: StaffUser) => {
    setNewPassword("");
    setPasswordStaff(s);
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordStaff) return;
    setSavingPassword(true);
    try {
      const res = await fetch(`/api/permissions/staff/${passwordStaff.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", "Contraseña actualizada");
        setPasswordStaff(null);
      } else {
        showToast("error", "No se pudo actualizar", data.message);
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor.");
    } finally {
      setSavingPassword(false);
    }
  };

  const deleteStaff = async (s: StaffUser) => {
    const isProfessional = s.type === "Professional";
    if (!(await confirm({
      message: isProfessional
        ? `¿Sacarle los permisos de panel a ${s.professionalName ?? s.email}? Sigue entrando normalmente a su agenda, solo pierde el acceso extra.`
        : `¿Revocar el acceso de ${s.email}? Ya no va a poder entrar al panel.`,
      confirmLabel: isProfessional ? "Sacar permisos" : "Revocar acceso",
    }))) return;

    const res = await fetch(`/api/permissions/staff/${s.id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      showToast("warning", isProfessional ? "Permisos de panel removidos" : "Acceso revocado", data.message);
      setStaff((prev) => prev.filter((x) => x.id !== s.id));
    } else {
      showToast("error", "No se pudo revocar", data.message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando permisos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {ConfirmDialog}

      <div className="mx-auto max-w-4xl">
        {/* En celular los dos botones no entran al lado del título: se apilan debajo. */}
        <div className="mb-6 md:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Permisos</h1>
            <p className="text-charcoal/50 text-sm mt-1">
              Creá cuentas de acceso limitado (Staff) o sumale acceso al panel a un profesional del Equipo, y asignales qué módulos pueden ver, crear, editar o eliminar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <Button onClick={() => setShowLinkPicker(true)} variant="secondary">
              Vincular profesional
            </Button>
            <Button onClick={openCreate} data-testid="staff-create-button" variant="primary">
              + Nueva cuenta
            </Button>
          </div>
        </div>

        {staff.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-mauve/10 rounded-xl">
            <p className="text-charcoal/40 text-lg">No hay cuentas con permisos todavía</p>
            <button onClick={openCreate} className="mt-4 text-blushdark hover:text-blush transition text-sm">
              + Crear la primera
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {staff.map((s) => {
              const granted = grantedModules(s.permissions);
              return (
                <div key={s.id} data-testid="staff-row" className="bg-ivory border border-mauve/5 rounded-2xl p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-charcoal font-semibold text-sm">
                          {s.type === "Professional" ? s.professionalName : s.email}
                        </p>
                        {s.type === "Professional" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-mauve/10 text-charcoal/50 font-medium uppercase tracking-wide">
                            Equipo
                          </span>
                        )}
                      </div>
                      {s.type === "Professional" ? (
                        <p className="text-charcoal/40 text-xs mt-0.5">{s.email}</p>
                      ) : (
                        s.username && <p className="text-charcoal/40 text-xs mt-0.5">Usuario: {s.username}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {granted.length === 0 ? (
                          <span className="text-[11px] text-charcoal/30 italic">Sin permisos asignados todavía</span>
                        ) : (
                          granted.map((p) => (
                            <span key={p.module} className="text-[11px] px-2 py-0.5 rounded-full bg-blush/10 text-blushdark font-medium">
                              {MODULE_LABELS[p.module] ?? p.module}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      <Button onClick={() => openEdit(s)} data-testid="staff-edit-permissions" variant="secondary" size="sm">
                        Permisos
                      </Button>
                      {s.type !== "Professional" && (
                        <Button onClick={() => openPassword(s)} variant="secondary" size="sm">
                          Contraseña
                        </Button>
                      )}
                      <Button onClick={() => deleteStaff(s)} data-testid="staff-delete-button" variant="danger" size="sm">
                        {s.type === "Professional" ? "Sacar permisos" : "Revocar"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: nueva cuenta Staff */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-ivory border border-mauve/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-charcoal">Nueva cuenta Staff</h2>
              <button onClick={() => setShowCreateForm(false)} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>
            <form ref={createFormRef} onSubmit={createStaff} className="space-y-4">
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  className="form-input mt-1.5"
                  data-testid="staff-form-email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="empleado@negocio.com"
                  required
                />
              </div>
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Usuario (opcional)</label>
                <input
                  className="form-input mt-1.5"
                  value={createForm.username}
                  onChange={(e) => setCreateForm((p) => ({ ...p, username: e.target.value }))}
                  placeholder="Alternativa al email para loguearse"
                />
              </div>
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Contraseña</label>
                <input
                  type="password"
                  className="form-input mt-1.5"
                  data-testid="staff-form-password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={creating} data-testid="staff-form-submit" variant="primary" className="flex-1">
                  {creating ? "Creando..." : "Crear cuenta"}
                </Button>
                <Button type="button" onClick={() => setShowCreateForm(false)} variant="secondary">
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: elegir profesional del Equipo para vincular */}
      {showLinkPicker && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowLinkPicker(false)}>
          <div className="bg-ivory border border-mauve/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-charcoal">Vincular profesional</h2>
              <button onClick={() => setShowLinkPicker(false)} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>
            <p className="text-charcoal/50 text-xs mb-4">
              Elegí un profesional del Equipo para sumarle acceso al panel admin. Va a seguir entrando con el mismo usuario y contraseña que ya tiene para su agenda.
            </p>
            {linkableProfessionals.length === 0 ? (
              <p className="text-charcoal/40 text-sm text-center py-6">
                No hay profesionales disponibles. Activales el acceso primero desde Equipo, o ya tienen permisos asignados acá.
              </p>
            ) : (
              <div className="space-y-1.5">
                {linkableProfessionals.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => linkProfessional(p)}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-mauve/10 hover:border-blush/40 hover:bg-blush/5 transition"
                  >
                    <p className="text-charcoal text-sm font-medium">{p.firstName} {p.lastName}</p>
                    <p className="text-charcoal/40 text-xs">{p.accountEmail}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: grilla de permisos */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setEditingStaff(null)}>
          <div data-testid="staff-permissions-modal" className="bg-ivory border border-mauve/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-mauve/5">
              <div>
                <h2 className="text-charcoal font-semibold text-lg">
                  Permisos de {editingStaff.type === "Professional" ? editingStaff.professionalName : editingStaff.email}
                </h2>
                <p className="text-charcoal/40 text-xs mt-0.5">Marcar "Ver" alcanza para consultar; las demás columnas habilitan escribir sobre ese módulo.</p>
              </div>
              <button onClick={() => setEditingStaff(null)} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>

            <div className="px-6 py-5 overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b border-mauve/10 text-charcoal/40 text-xs uppercase tracking-wider">
                    <th className="text-left py-2 font-medium">Módulo</th>
                    {ACTION_LABELS.map((a) => (
                      <th key={a.key} className="text-center py-2 font-medium w-20">{a.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modules.map((m) => (
                    <tr key={m} data-testid="staff-permission-row" className="border-b border-mauve/5 last:border-0">
                      <td className="py-2.5 text-charcoal">{MODULE_LABELS[m] ?? m}</td>
                      {ACTION_LABELS.map((a) => (
                        <td key={a.key} className="text-center py-2.5">
                          <input
                            type="checkbox"
                            data-testid={`staff-permission-${m}-${a.key}`}
                            checked={editGrid[m]?.[a.key] ?? false}
                            onChange={() => toggleCell(m, a.key)}
                            className="w-4 h-4 accent-blush cursor-pointer"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-mauve/5 flex gap-3">
              <Button onClick={savePermissions} disabled={savingGrid} data-testid="staff-permissions-save" variant="primary" className="flex-1">
                {savingGrid ? "Guardando..." : "Guardar permisos"}
              </Button>
              <Button type="button" onClick={() => setEditingStaff(null)} variant="secondary">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: cambiar contraseña */}
      {passwordStaff && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPasswordStaff(null)}>
          <div className="bg-ivory border border-mauve/10 rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-charcoal">Cambiar contraseña</h2>
              <button onClick={() => setPasswordStaff(null)} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>
            <p className="text-charcoal/50 text-xs mb-4">{passwordStaff.email}</p>
            <form ref={passwordFormRef} onSubmit={changePassword} className="space-y-3">
              <input
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nueva contraseña (mínimo 6 caracteres)"
                minLength={6}
                required
              />
              <Button type="submit" disabled={savingPassword} variant="primary" className="w-full">
                {savingPassword ? "Guardando..." : "Actualizar contraseña"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
