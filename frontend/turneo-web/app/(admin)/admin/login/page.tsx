"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setLoggedIn, verifySession } from "@/src/lib/auth";
import PasswordInput from "@/src/components/ui/PasswordInput";
import { Button } from "@/src/components/shared/Button";

export default function LoginPage() {
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
        router.push("/admin/turnos");
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

      setLoggedIn(data.email, data.role);
      router.push("/admin/turnos");
    } catch (err: any) {
      setError(err.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  // Mostrar loader mientras verifica sesión
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
          <h1 className="text-3xl font-bold text-charcoal">Panel Admin</h1>
          <p className="mt-2 text-charcoal/60">Ingresá tus credenciales</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-champagne/10 border border-champagne/30 p-4" data-testid="admin-login-error">
              <p className="text-sm text-champagne text-center">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-charcoal/70">Email o usuario</label>
            <input
              type="text"
              data-testid="admin-login-email"
              className="form-input"
              placeholder="admin@turneo.com"
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
            <PasswordInput
              className="form-input"
              data-testid="admin-login-password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            data-testid="admin-login-submit"
            variant="primary"
            shape="pill"
            className="w-full"
          >
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </Button>
        </form>
      </div>
    </div>
  );
}
