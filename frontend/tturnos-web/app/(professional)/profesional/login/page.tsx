"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setLoggedIn, verifySession } from "@/src/lib/auth";

export default function ProfessionalLoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Verificar con el backend si hay sesión activa
  useEffect(() => {
    const checkSession = async () => {
      const isValid = await verifySession();
      if (isValid) {
        router.push("/profesional/agenda");
      } else {
        setChecking(false);
      }
    };
    checkSession();
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error al iniciar sesión");
      }

      if (data.role !== "Professional") {
        throw new Error("Esta cuenta no tiene acceso al panel de profesionales");
      }

      setLoggedIn(data.email, data.role);
      router.push("/profesional/agenda");
    } catch (err: any) {
      setError(err.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-cream">
        <div className="text-charcoal/60">Verificando sesión...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-cream px-6">
      <div className="glass-card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-charcoal">Mi Agenda</h1>
          <p className="mt-2 text-charcoal/60">Ingresá con tu email y contraseña</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-charcoal/70">Email o usuario</label>
            <input
              type="text"
              className="w-full rounded-xl border border-mauve/15 bg-white px-4 py-3 text-charcoal focus:border-blush outline-none transition"
              placeholder="vos@studionails.com o tu usuario"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-charcoal/70">
              Contraseña
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-mauve/15 bg-white px-4 py-3 text-charcoal focus:border-blush outline-none transition"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-blush px-6 py-4 font-semibold text-white shadow-glow transition hover:scale-[1.02] disabled:opacity-50"
          >
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
