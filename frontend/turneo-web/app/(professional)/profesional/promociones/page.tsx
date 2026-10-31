"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth, isProfessionalAuthenticated, getRole } from "@/src/lib/auth";
import { Button } from "@/src/components/shared/Button";

interface OwnService {
  id: number;
  title: string;
}

interface Promotion {
  id: number;
  name: string;
  discountType: "Percent" | "FixedAmount";
  value: number;
  serviceIds: number[];
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

interface PromotionForm {
  name: string;
  discountType: "Percent" | "FixedAmount";
  value: string;
  serviceIds: number[];
  startsAt: string;
  endsAt: string;
}

const PROMOTIONS_URL = "/api/professionals/me/promotions";

// <input type="date"> trabaja en YYYY-MM-DD; el backend recibe UTC.
const toDateInput = (iso: string) => iso.slice(0, 10);
const startOfDayUtc = (date: string) => `${date}T00:00:00Z`;
const endOfDayUtc = (date: string) => `${date}T23:59:59Z`;

const emptyForm = (): PromotionForm => {
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    name: "",
    discountType: "Percent",
    value: "",
    serviceIds: [],
    startsAt: today.toISOString().slice(0, 10),
    endsAt: nextWeek.toISOString().slice(0, 10),
  };
};

const describeDiscount = (p: Promotion) =>
  p.discountType === "Percent" ? `${p.value}% off` : `$${p.value.toLocaleString("es-AR")} off`;

export default function ProfesionalPromocionesPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isProfessionalAuthenticated()) {
      router.push(getRole() === "Admin" ? "/admin/turnos" : "/profesional/login");
    }
  }, [router]);

  const [services, setServices] = useState<OwnService[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PromotionForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const load = useCallback(async () => {
    try {
      const me = await fetchWithAuth("/api/professionals/me").then((r) => r.json());
      const [profile, list] = await Promise.all([
        fetchWithAuth(`/api/professionals/${me.id}`).then((r) => r.json()),
        fetchWithAuth(PROMOTIONS_URL).then((r) => (r.ok ? r.json() : [])),
      ]);
      setServices(profile.services ?? []);
      setPromotions(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const notify = (type: "success" | "error", text: string) => {
    setMessageType(type);
    setMessage(text);
  };

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const toggleService = (id: number) =>
    setForm((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(id) ? prev.serviceIds.filter((s) => s !== id) : [...prev.serviceIds, id],
    }));

  const body = (p: PromotionForm, isActive: boolean) =>
    JSON.stringify({
      name: p.name.trim(),
      discountType: p.discountType,
      value: Number(p.value),
      serviceIds: p.serviceIds,
      startsAt: startOfDayUtc(p.startsAt),
      endsAt: endOfDayUtc(p.endsAt),
      isActive,
    });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const current = promotions.find((p) => p.id === editingId);
      const res = await fetchWithAuth(editingId ? `${PROMOTIONS_URL}/${editingId}` : PROMOTIONS_URL, {
        method: editingId ? "PUT" : "POST",
        body: body(form, current?.isActive ?? true),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify("error", data.message || "No se pudo guardar la promoción.");
        return;
      }
      notify("success", editingId ? "Promoción actualizada." : "Promoción creada.");
      resetForm();
      await load();
    } catch {
      notify("error", "Error de conexión. Intentá nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (p: Promotion) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      discountType: p.discountType,
      value: String(p.value),
      serviceIds: p.serviceIds,
      startsAt: toDateInput(p.startsAt),
      endsAt: toDateInput(p.endsAt),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const togglePaused = async (p: Promotion) => {
    const res = await fetchWithAuth(`${PROMOTIONS_URL}/${p.id}`, {
      method: "PUT",
      body: body(
        {
          name: p.name,
          discountType: p.discountType,
          value: String(p.value),
          serviceIds: p.serviceIds,
          startsAt: toDateInput(p.startsAt),
          endsAt: toDateInput(p.endsAt),
        },
        !p.isActive
      ),
    });
    if (res.ok) await load();
    else notify("error", "No se pudo cambiar el estado.");
  };

  const remove = async (p: Promotion) => {
    if (!window.confirm(`¿Eliminar la promoción "${p.name}"?`)) return;
    const res = await fetchWithAuth(`${PROMOTIONS_URL}/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      if (editingId === p.id) resetForm();
      await load();
    } else {
      notify("error", "No se pudo eliminar la promoción.");
    }
  };

  const serviceTitle = (id: number) => services.find((s) => s.id === id)?.title ?? `#${id}`;
  const inputClass = "w-full rounded-xl border border-mauve/40 bg-white px-3 py-2 text-sm text-charcoal";

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Promociones</h1>
          <p className="text-charcoal/50 text-sm mt-1">
            Descuentos automáticos sobre tus servicios. Se aplican solos cuando un cliente reserva con vos.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mb-8 flex flex-col gap-4 rounded-2xl bg-white p-4 md:p-6">
          <h2 className="text-lg font-semibold text-charcoal">{editingId ? "Editar promoción" : "Nueva promoción"}</h2>

          <label className="flex flex-col gap-1 text-sm text-charcoal">
            Nombre
            <input
              className={inputClass}
              value={form.name}
              maxLength={100}
              required
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Promo de verano"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-charcoal">
              Tipo
              <select
                className={inputClass}
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value as PromotionForm["discountType"] })}
              >
                <option value="Percent">Porcentaje (%)</option>
                <option value="FixedAmount">Monto fijo ($)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-charcoal">
              Valor
              <input
                className={inputClass}
                type="number"
                min={1}
                max={form.discountType === "Percent" ? 100 : undefined}
                step="any"
                required
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-charcoal">
              Desde
              <input className={inputClass} type="date" required value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-charcoal">
              Hasta
              <input className={inputClass} type="date" required value={form.endsAt} min={form.startsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </label>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm text-charcoal">Servicios con descuento</legend>
            {loading ? (
              <p className="text-sm text-charcoal/50">Cargando…</p>
            ) : services.length === 0 ? (
              <p className="text-sm text-charcoal/50">Todavía no tenés servicios asignados.</p>
            ) : (
              services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-charcoal">
                  <input type="checkbox" checked={form.serviceIds.includes(s.id)} onChange={() => toggleService(s.id)} />
                  {s.title}
                </label>
              ))
            )}
          </fieldset>

          {message && (
            <p role="status" className={`text-sm ${messageType === "error" ? "text-red-600" : "text-green-700"}`}>
              {message}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={saving || form.serviceIds.length === 0}>
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear promoción"}
            </Button>
            {editingId && (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancelar
              </Button>
            )}
          </div>
        </form>

        <h2 className="mb-3 text-lg font-semibold text-charcoal">Mis promociones</h2>
        {loading ? (
          <p className="text-sm text-charcoal/50">Cargando…</p>
        ) : promotions.length === 0 ? (
          <p className="text-sm text-charcoal/50">Todavía no creaste ninguna promoción.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {promotions.map((p) => (
              <li key={p.id} className="rounded-2xl bg-white p-4" data-testid="promotion-item">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-charcoal">{p.name}</p>
                    <p className="text-sm text-rosewood">{describeDiscount(p)}</p>
                    <p className="text-xs text-charcoal/60">
                      {p.serviceIds.map(serviceTitle).join(", ")} · {toDateInput(p.startsAt)} → {toDateInput(p.endsAt)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${p.isActive ? "bg-green-100 text-green-800" : "bg-charcoal/10 text-charcoal/60"}`}>
                    {p.isActive ? "Activa" : "Pausada"}
                  </span>
                </div>
                <div className="mt-3 flex gap-4 text-sm">
                  <button type="button" className="text-rosewood underline" onClick={() => startEditing(p)}>Editar</button>
                  <button type="button" className="text-rosewood underline" onClick={() => togglePaused(p)}>
                    {p.isActive ? "Pausar" : "Reanudar"}
                  </button>
                  <button type="button" className="text-red-600 underline" onClick={() => remove(p)}>Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
