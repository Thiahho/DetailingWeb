"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "../../../src/lib/config";
import { setLoggedIn, isAuthenticated } from "../../../src/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Si ya está autenticado, redirigir a turnos
  useEffect(() => {
    if (isAuthenticated()) {
      router.push("/admin/turnos");
    }
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log("Iniciando login...", API_BASE_URL);

      // const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      //   method: "POST",
      //   credentials: "include",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(formData),
      // });
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      console.log("Response status:", response.status);

      const data = await response.json();
      console.log("Response data:", data);

      if (!response.ok) {
        throw new Error(data.message || "Error al iniciar sesión");
      }

      // Marcar como logueado
      setLoggedIn(data.email);
      console.log("Login exitoso, redirigiendo...");
      router.push("/admin/turnos");
    } catch (err: any) {
      console.error("Error en login:", err);
      setError(err.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-midnight px-6">
      <div className="glass-card w-full max-w-md p-8 border border-white/10 shadow-glow">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Panel Admin</h1>
          <p className="mt-2 text-white/60">Ingresá tus credenciales</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
              <p className="text-sm text-red-400 text-center">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">Email</label>
            <input
              type="email"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-electric/50 outline-none transition"
              placeholder="admin@detailing.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">
              Contraseña
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-electric/50 outline-none transition"
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
            className="w-full rounded-full bg-electric px-6 py-4 font-semibold text-white shadow-glow transition hover:scale-[1.02] disabled:opacity-50"
          >
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
