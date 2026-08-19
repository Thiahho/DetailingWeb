"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import PasswordInput from "@/src/components/ui/PasswordInput";
import { Button } from "@/src/components/shared/Button";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";

// Coincide con Tenancy:BaseDomain en appsettings.json del backend — solo para
// mostrarle a Thiago el subdominio resultante, no afecta la resolución real.
const BASE_DOMAIN = "Turneo.app";

const VERTICALS = ["Beauty"];

interface Tenant {
  id: number;
  name: string;
  slug: string;
  vertical: string;
  commercialModel: number;
  status: number;
  planId: number | null;
  createdAt: string;
}

interface Plan {
  id: number;
  name: string;
  priceMonthly: number | null;
  priceYearly: number | null;
}

const emptyForm = {
  name: "",
  slug: "",
  vertical: VERTICALS[0],
  commercialModel: 0, // CommercialModel.SaaS
  planId: "",
  adminEmail: "",
  adminPassword: "",
  acceptedTerms: false,
};

export default function PlatformTenantsPage() {
  const { toasts, showToast, removeToast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadTenants = async () => {
    const res = await fetch("/api/platform/tenants", { credentials: "include" });
    if (res.ok) setTenants(await res.json());
  };

  const loadPlans = async () => {
    const res = await fetch("/api/platform/plans", { credentials: "include" });
    if (res.ok) setPlans(await res.json());
  };

  useEffect(() => {
    Promise.all([loadTenants(), loadPlans()]).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/platform/tenants", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          planId: form.planId ? Number(form.planId) : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast("error", "No se pudo crear el tenant", data.message);
        return;
      }

      showToast("success", "Tenant creado", `${data.slug}.${BASE_DOMAIN} — admin: ${data.adminEmail}`);
      setForm(emptyForm);
      await loadTenants();
    } catch {
      showToast("error", "Error de conexión", "No se pudo contactar al servidor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 text-white">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="flex items-center gap-4 text-sm text-white/50">
        <span className="font-semibold text-white">Tenants</span>
        <Link href="/platform/roulette" className="hover:text-white">Ruleta</Link>
        <Link href="/platform/takedown" className="hover:text-white">Takedown</Link>
      </div>

      <h1 className="mt-2 text-2xl font-bold">Tenants</h1>
      <p className="mt-1 text-white/50 text-sm">Alta de negocios nuevos en Turneo.</p>

      <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-white/60">Turneo APP</label>
          <input
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-white/60">Slug (subdominio)</label>
          <input
            required
            pattern="[a-z0-9-]+"
            title="Solo minúsculas, números y guiones"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
          />
          {form.slug && <p className="text-xs text-white/40">{form.slug}.{BASE_DOMAIN}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-white/60">Rubro</label>
          <select
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
            value={form.vertical}
            onChange={(e) => setForm({ ...form, vertical: e.target.value })}
          >
            {VERTICALS.map((v) => (
              <option key={v} value={v} className="text-charcoal">{v}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-white/60">Plan (opcional)</label>
          <select
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
            value={form.planId}
            onChange={(e) => setForm({ ...form, planId: e.target.value })}
          >
            <option value="" className="text-charcoal">Sin plan</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id} className="text-charcoal">{p.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-white/60">Email del admin inicial</label>
          <input
            type="email"
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
            value={form.adminEmail}
            onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-white/60">Contraseña inicial</label>
          <PasswordInput
            required
            minLength={6}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
            value={form.adminPassword}
            onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-start gap-2 text-xs text-white/60">
            <input
              type="checkbox"
              required
              className="mt-0.5"
              checked={form.acceptedTerms}
              onChange={(e) => setForm({ ...form, acceptedTerms: e.target.checked })}
            />
            <span>
              El titular del negocio leyó y aceptó los{" "}
              <Link href="/platform/terminos-saas" target="_blank" className="font-medium text-white hover:underline">
                Términos del Servicio SaaS
              </Link>{" "}
              (incluye cláusula de arbitraje).
            </span>
          </label>
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving} variant="primary" shape="pill">
            {saving ? "Creando..." : "Crear tenant"}
          </Button>
        </div>
      </form>

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Tenants existentes</h2>
        {loading ? (
          <p className="mt-4 text-white/50 text-sm">Cargando...</p>
        ) : tenants.length === 0 ? (
          <p className="mt-4 text-white/50 text-sm">Todavía no hay tenants.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-white/60">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Subdominio</th>
                  <th className="px-4 py-3">Rubro</th>
                  <th className="px-4 py-3">Creado</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-t border-white/10">
                    <td className="px-4 py-3">{t.name}</td>
                    <td className="px-4 py-3 text-white/70">{t.slug}.{BASE_DOMAIN}</td>
                    <td className="px-4 py-3 text-white/70">{t.vertical}</td>
                    <td className="px-4 py-3 text-white/50">{new Date(t.createdAt).toLocaleDateString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
