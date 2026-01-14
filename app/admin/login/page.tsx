"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ArrowLeft, Menu, X } from "lucide-react";
import Link from "next/link";
import { API_BASE_URL } from "../../../src/lib/config";

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error al iniciar sesión");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("email", data.email);
      localStorage.setItem("role", data.role);

      router.push("/admin/turnos");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-midnight">
      {/* HEADER */}
      <header className="w-full border-b border-white/5 bg-midnight/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link
            href="/"
            className="flex items-center gap-3 transition hover:opacity-80"
          >
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
              <img
                src="/img/logowhite.webp"
                alt="LK Detailing Logo"
                className="h-full w-full object-contain p-1.5"
              />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-white/60 text-[10px] md:text-sm">
                Detailing premium
              </p>
              <h1 className="text-base font-semibold md:text-lg">
                Zona Oeste | Moreno
              </h1>
            </div>
          </Link>

          {/* Botón hamburguesa - solo mobile */}
          <button
            className="flex items-center justify-center p-2 text-white/70 transition hover:text-white md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menú"
          >
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>

          {/* Nav desktop */}
          <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <Link className="transition hover:text-white" href="/#servicios">
              Servicios
            </Link>
            <Link className="transition hover:text-white" href="/#trabajos">
              Trabajos
            </Link>
            <Link className="transition hover:text-white" href="/#faq">
              FAQ
            </Link>
            <Link
              className="rounded-full border border-white/10 px-4 py-2 transition hover:border-lux/60"
              href="/#contacto"
            >
              Contacto
            </Link>
          </nav>
        </div>
      </header>

      {/* Menú mobile desplegable */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-midnight/95 backdrop-blur-sm md:hidden">
          <div className="flex items-center justify-between px-6 py-6 border-b border-white/5">
            <Link
              href="/"
              className="flex items-center gap-3"
              onClick={closeMobileMenu}
            >
              <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                <img
                  src="/img/logowhite.webp"
                  alt="LK Detailing Logo"
                  className="h-full w-full object-contain p-1.5"
                />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/60">
                  Detailing premium
                </p>
                <h1 className="text-base font-semibold">Zona Oeste | Moreno</h1>
              </div>
            </Link>
            <button
              className="p-2 text-white/70 transition hover:text-white"
              onClick={closeMobileMenu}
              aria-label="Cerrar menú"
            >
              <X size={28} />
            </button>
          </div>

          <nav className="flex flex-col items-center gap-6 px-6 pt-10 text-lg">
            <Link
              className="w-full text-center py-3 text-white/70 transition hover:text-white border-b border-white/10"
              href="/#servicios"
              onClick={closeMobileMenu}
            >
              Servicios
            </Link>
            <Link
              className="w-full text-center py-3 text-white/70 transition hover:text-white border-b border-white/10"
              href="/#trabajos"
              onClick={closeMobileMenu}
            >
              Trabajos
            </Link>
            <Link
              className="w-full text-center py-3 text-white/70 transition hover:text-white border-b border-white/10"
              href="/#faq"
              onClick={closeMobileMenu}
            >
              FAQ
            </Link>
            <Link
              className="w-full text-center py-3 rounded-full border border-lux/60 text-lux transition hover:bg-lux/10"
              href="/#contacto"
              onClick={closeMobileMenu}
            >
              Contacto
            </Link>
            <Link
              className="w-full text-center py-3 text-white/70 transition hover:text-white border-b border-white/10"
              href="/"
              onClick={closeMobileMenu}
            >
              ← Volver al inicio
            </Link>
          </nav>
        </div>
      )}

      {/* CONTENIDO DEL LOGIN CENTRADO */}
      <main className="flex flex-1 items-center justify-center px-6">
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

          <div className="mt-8 rounded-xl bg-white/5 p-4 text-center border border-white/5">
            <p className="text-xs uppercase tracking-widest text-white/30 mb-2">
              Acceso de prueba
            </p>
            <p className="text-sm text-white/50">
              admin@detailing.com / Admin123!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
