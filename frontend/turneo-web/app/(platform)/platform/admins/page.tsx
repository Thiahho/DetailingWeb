"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import PasswordInput from "@/src/components/ui/PasswordInput";
import { Button } from "@/src/components/shared/Button";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";

// Vista temporal: alta manual de un Admin en un tenant que YA existe (a
// diferencia de /platform/tenants, que crea tenant + admin juntos). Pensada
// para reponer un admin borrado o sumar uno nuevo sin tocar la base a mano.
interface Tenant {
  id: number;
  name: string;
  slug: string;
}

const emptyForm = { tenantId: "", email: "", password: "" };

export default function PlatformAdminsPage() {
  const { toasts, showToast, removeToast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/platform/tenants", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then(setTenants);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/platform/tenants/${form.tenantId}/admins`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast("error", "No se pudo crear el admin", data.message);
        return;
      }

      showToast("success", "Admin creado", `${data.adminEmail} — tenant ${data.slug}`);
      setForm(emptyForm);
    } catch {
      showToast("error", "Error de conexión", "No se pudo contactar al servidor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-6 py-12 text-white">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="flex items-center gap-4 text-sm text-white/50">
        <Link href="/platform/tenants" className="hover:text-white">Tenants</Link>
        <span className="font-semibold text-white">Admins</span>
        <Link href="/platform/roulette" className="hover:text-white">Ruleta</Link>
        <Link href="/platform/takedown" className="hover:text-white">Takedown</Link>
      </div>

      <h1 className="mt-2 text-2xl font-bold">Crear Admin</h1>
      <p className="mt-1 text-white/50 text-sm">
        Alta manual de un usuario Admin en un tenant ya existente. Vista temporal.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="space-y-1">
          <label className="text-xs font-medium text-white/60">Tenant</label>
          <select
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
            value={form.tenantId}
            onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
          >
            <option value="" className="text-charcoal">Elegí un tenant</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id} className="text-charcoal">
                {t.name} ({t.slug})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-white/60">Email</label>
          <input
            type="email"
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-white/60">Contraseña</label>
          <PasswordInput
            required
            minLength={6}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

        <Button type="submit" disabled={saving} variant="primary" shape="pill">
          {saving ? "Creando..." : "Crear admin"}
        </Button>
      </form>
    </div>
  );
}
