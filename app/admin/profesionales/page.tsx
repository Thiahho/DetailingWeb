"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "../../../src/lib/auth";
import { logError } from "../../../src/lib/logger";
import CloudinaryUpload from "../../../src/components/CloudinaryUpload";

interface ServiceOption {
  id: number;
  title: string;
}

interface Professional {
  id: number;
  firstName: string;
  lastName: string;
  photoUrl: string;
  calendarColor: string;
  specialty: string | null;
  commission: number;
  schedule: string | null;
  isActive: boolean;
  order: number;
  services: ServiceOption[];
}

interface WeeklyScheduleDay {
  dayOfWeek: number; // 0=Domingo..6=Sábado
  start: string;
  end: string;
  enabled: boolean;
}

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const defaultSchedule = (): WeeklyScheduleDay[] =>
  Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    start: "08:00",
    end: "18:00",
    enabled: dayOfWeek >= 1 && dayOfWeek <= 5,
  }));

const emptyForm = {
  firstName: "",
  lastName: "",
  photoUrl: "",
  calendarColor: "#7c3aed",
  specialty: "",
  commission: 0,
  isActive: true,
  order: 0,
  serviceIds: [] as number[],
};

// --- Toast ---
type ToastType = "success" | "error" | "warning";
interface Toast { id: number; type: ToastType; title: string; message?: string }

function ToastNotification({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), 3700);
    const t2 = setTimeout(onClose, 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onClose]);

  const colors = {
    success: "from-green-600 to-green-500 border-green-400 shadow-green-500/30",
    error: "from-red-600 to-red-500 border-red-400 shadow-red-500/30",
    warning: "from-orange-600 to-orange-500 border-orange-400 shadow-orange-500/30",
  };

  return (
    <div className={`bg-gradient-to-r ${colors[toast.type]} border rounded-xl p-4 pr-12 min-w-[300px] shadow-lg transition-all duration-300 ${exiting ? "translate-x-[120%] opacity-0" : "translate-x-0 opacity-100"}`}>
      <p className="font-bold text-white">{toast.title}</p>
      {toast.message && <p className="text-white/80 text-sm mt-1">{toast.message}</p>}
      <button onClick={() => { setExiting(true); setTimeout(onClose, 300); }} className="absolute top-3 right-3 text-white/60 hover:text-white">✕</button>
    </div>
  );
}

export default function ProfesionalesAdminPage() {
  const router = useRouter();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [allServices, setAllServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [schedule, setSchedule] = useState<WeeklyScheduleDay[]>(defaultSchedule());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    setToasts((prev) => [...prev, { id: Date.now(), type, title, message }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/admin/login");
      return;
    }
    loadProfessionals();
    loadServices();
  }, [router]);

  const loadProfessionals = async () => {
    try {
      const res = await fetch("/api/professionals/all");
      if (res.ok) setProfessionals(await res.json());
    } catch (error) {
      logError("Error cargando profesionales:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async () => {
    try {
      const res = await fetch("/api/services/all");
      if (res.ok) setAllServices(await res.json());
    } catch (error) {
      logError("Error cargando servicios:", error);
    }
  };

  const openCreate = () => {
    setEditingProfessional(null);
    setFormData({ ...emptyForm });
    setSchedule(defaultSchedule());
    setShowForm(true);
  };

  const openEdit = (professional: Professional) => {
    setEditingProfessional(professional);
    setFormData({
      firstName: professional.firstName,
      lastName: professional.lastName,
      photoUrl: professional.photoUrl,
      calendarColor: professional.calendarColor,
      specialty: professional.specialty ?? "",
      commission: professional.commission,
      isActive: professional.isActive,
      order: professional.order,
      serviceIds: professional.services.map((s) => s.id),
    });
    try {
      setSchedule(professional.schedule ? JSON.parse(professional.schedule) : defaultSchedule());
    } catch {
      setSchedule(defaultSchedule());
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingProfessional(null);
    setFormData({ ...emptyForm });
    setSchedule(defaultSchedule());
  };

  const updateScheduleDay = (dayOfWeek: number, patch: Partial<WeeklyScheduleDay>) => {
    setSchedule((prev) => prev.map((d) => d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d));
  };

  const toggleService = (id: number) => {
    setFormData((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(id)
        ? prev.serviceIds.filter((s) => s !== id)
        : [...prev.serviceIds, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...formData,
      schedule: JSON.stringify(schedule),
    };

    try {
      const url = editingProfessional ? `/api/professionals/${editingProfessional.id}` : "/api/professionals";
      const method = editingProfessional ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", editingProfessional ? "Profesional actualizado" : "Profesional creado", data.message);
        closeForm();
        loadProfessionals();
      } else {
        showToast("error", "Error", data.message || "No se pudo guardar el profesional");
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/professionals/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showToast("warning", "Profesional eliminado", data.message);
        setDeleteConfirmId(null);
        loadProfessionals();
      } else {
        showToast("error", "Error", data.message || "No se pudo eliminar");
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1115]">
        <p className="text-white">Cargando profesionales...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1115] p-4 md:p-6 font-sans">
      {/* Toasts */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3">
        {toasts.map((t) => (
          <ToastNotification key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 md:mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Gestión de Profesionales</h1>
            <p className="text-white/50 text-sm mt-1">
              Administrá el equipo del salón y qué servicios ofrece cada uno
            </p>
          </div>
          <button
            onClick={openCreate}
            className="shrink-0 bg-green-600 hover:bg-green-500 text-white px-4 md:px-5 py-2.5 rounded-lg font-semibold transition flex items-center gap-2 text-sm md:text-base"
          >
            <span className="text-xl leading-none">+</span>
            <span className="hidden sm:inline">Nuevo Profesional</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        </div>

        {/* Grid de profesionales */}
        {professionals.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-xl">
            <p className="text-white/40 text-lg">No hay profesionales cargados</p>
            <button onClick={openCreate} className="mt-4 text-green-400 hover:text-green-300 transition text-sm">
              + Crear el primero
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {professionals.map((professional) => (
              <div
                key={professional.id}
                className={`bg-[#161b22] border rounded-xl overflow-hidden transition ${
                  professional.isActive ? "border-white/5" : "border-orange-900/30 opacity-60"
                }`}
              >
                {/* Imagen */}
                {professional.photoUrl && (
                  <div className="h-36 overflow-hidden">
                    <img
                      src={professional.photoUrl}
                      alt={`${professional.firstName} ${professional.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="shrink-0 h-3 w-3 rounded-full border border-white/20"
                        style={{ backgroundColor: professional.calendarColor }}
                        title={professional.calendarColor}
                      />
                      <h3 className="text-white font-semibold text-[15px] leading-tight truncate">
                        {professional.firstName} {professional.lastName}
                      </h3>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        professional.isActive
                          ? "bg-green-500/20 text-green-400"
                          : "bg-orange-500/20 text-orange-400"
                      }`}
                    >
                      {professional.isActive ? "ACTIVO" : "INACTIVO"}
                    </span>
                  </div>

                  {professional.specialty && (
                    <p className="text-white/60 text-sm">{professional.specialty}</p>
                  )}

                  {professional.services.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {professional.services.map((s) => (
                        <li key={s.id} className="text-white/40 text-xs flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5">✓</span> {s.title}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => openEdit(professional)}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white text-sm py-2 rounded-lg transition"
                    >
                      Editar
                    </button>
                    {deleteConfirmId === professional.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDelete(professional.id)}
                          className="bg-red-600 hover:bg-red-500 text-white text-sm px-3 py-2 rounded-lg transition"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="bg-white/5 text-white text-sm px-3 py-2 rounded-lg transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(professional.id)}
                        className="bg-red-900/20 hover:bg-red-900/40 text-red-400 text-sm px-3 py-2 rounded-lg transition"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={closeForm}>
          <div
            className="bg-[#161b22] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {editingProfessional ? "Editar Profesional" : "Nuevo Profesional"}
              </h2>
              <button onClick={closeForm} className="text-white/40 hover:text-white transition text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nombre y Apellido */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Nombre</label>
                  <input
                    className="w-full mt-1.5 bg-[#0d1117] border border-white/10 rounded-lg p-3 text-white focus:border-green-500 focus:outline-none transition"
                    value={formData.firstName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Juan"
                    required
                  />
                </div>
                <div>
                  <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Apellido</label>
                  <input
                    className="w-full mt-1.5 bg-[#0d1117] border border-white/10 rounded-lg p-3 text-white focus:border-green-500 focus:outline-none transition"
                    value={formData.lastName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Pérez"
                    required
                  />
                </div>
              </div>

              {/* Foto */}
              <div>
                <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Foto</label>
                <div className="mt-1.5">
                  <CloudinaryUpload
                    value={formData.photoUrl}
                    onChange={(url) => setFormData((prev) => ({ ...prev, photoUrl: url }))}
                  />
                </div>
              </div>

              {/* Color de calendario y Especialidad */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Color en calendario</label>
                  <input
                    type="color"
                    className="w-full mt-1.5 h-11 bg-[#0d1117] border border-white/10 rounded-lg p-1 cursor-pointer"
                    value={formData.calendarColor}
                    onChange={(e) => setFormData((prev) => ({ ...prev, calendarColor: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Especialidad</label>
                  <input
                    className="w-full mt-1.5 bg-[#0d1117] border border-white/10 rounded-lg p-3 text-white focus:border-green-500 focus:outline-none transition"
                    value={formData.specialty}
                    onChange={(e) => setFormData((prev) => ({ ...prev, specialty: e.target.value }))}
                    placeholder="Colorista"
                  />
                </div>
              </div>

              {/* Servicios asociados */}
              <div>
                <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Servicios que ofrece</label>
                {allServices.length === 0 ? (
                  <p className="text-white/30 text-xs italic mt-1.5">No hay servicios cargados todavía.</p>
                ) : (
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto bg-[#0d1117] border border-white/10 rounded-lg p-3">
                    {allServices.map((service) => (
                      <label key={service.id} className="flex items-center gap-1.5 text-white/70 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.serviceIds.includes(service.id)}
                          onChange={() => toggleService(service.id)}
                          className="accent-green-500"
                        />
                        {service.title}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Horario semanal */}
              <div>
                <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Horario semanal</label>
                <div className="mt-1.5 space-y-1.5">
                  {schedule.map((day) => (
                    <div key={day.dayOfWeek} className="flex items-center gap-2 bg-[#0d1117] border border-white/10 rounded-lg p-2">
                      <label className="flex items-center gap-1.5 w-28 shrink-0 text-white/70 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={day.enabled}
                          onChange={(e) => updateScheduleDay(day.dayOfWeek, { enabled: e.target.checked })}
                          className="accent-green-500"
                        />
                        {DAY_LABELS[day.dayOfWeek]}
                      </label>
                      <input
                        type="time"
                        disabled={!day.enabled}
                        className="flex-1 bg-black/30 border border-white/10 rounded p-1.5 text-white text-sm disabled:opacity-30"
                        value={day.start}
                        onChange={(e) => updateScheduleDay(day.dayOfWeek, { start: e.target.value })}
                      />
                      <span className="text-white/30 text-xs">a</span>
                      <input
                        type="time"
                        disabled={!day.enabled}
                        className="flex-1 bg-black/30 border border-white/10 rounded p-1.5 text-white text-sm disabled:opacity-30"
                        value={day.end}
                        onChange={(e) => updateScheduleDay(day.dayOfWeek, { end: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Comisión, Orden y Estado */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Comisión %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    className="w-full mt-1.5 bg-[#0d1117] border border-white/10 rounded-lg p-3 text-white focus:border-green-500 focus:outline-none transition"
                    value={formData.commission}
                    onChange={(e) => setFormData((prev) => ({ ...prev, commission: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Orden</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full mt-1.5 bg-[#0d1117] border border-white/10 rounded-lg p-3 text-white focus:border-green-500 focus:outline-none transition"
                    value={formData.order}
                    onChange={(e) => setFormData((prev) => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <label className="text-white/60 text-xs font-medium uppercase tracking-wider">Estado</label>
                  <select
                    className="w-full mt-1.5 bg-[#0d1117] border border-white/10 rounded-lg p-3 text-white focus:border-green-500 focus:outline-none transition"
                    value={formData.isActive ? "true" : "false"}
                    onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.value === "true" }))}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {saving ? "Guardando..." : editingProfessional ? "Guardar cambios" : "Crear profesional"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-6 bg-white/5 text-white py-3 rounded-lg font-semibold hover:bg-white/10 transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
