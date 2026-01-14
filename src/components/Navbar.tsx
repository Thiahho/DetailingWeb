"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LogIn, LogOut, Menu, X, Calendar } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Verificar autenticación al cargar y cuando cambia
  useEffect(() => {
    const checkAuth = () => {
      const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
      setIsLoggedIn(isLoggedIn);
    };

    checkAuth();

    // Escuchar cambios en localStorage (para sincronizar entre tabs)
    window.addEventListener("storage", checkAuth);
    // Escuchar evento personalizado de auth
    window.addEventListener("auth-change", checkAuth);

    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("auth-change", checkAuth);
    };
  }, [pathname]);

  const handleLogout = async () => {
    // Importar dinámicamente para evitar errores de SSR
    const { logout } = await import("../lib/auth");
    setMobileMenuOpen(false);
    await logout();
  };

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string
  ) => {
    // Si ya estamos en el Home ("/")
    if (pathname === "/") {
      e.preventDefault();
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
    // Si estamos en cualquier otra página (como /admin/login)
    else {
      // El comportamiento por defecto del <Link> nos llevará a "/#id"
      // pero cerramos el menú mobile por si acaso
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-midnight/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        {/* LOGO */}
        <Link
          href="/"
          className="flex items-center gap-3 transition hover:opacity-80"
        >
          <div className="relative h-12 w-12 rounded-full border border-white/10 bg-white/5">
            <img
              src="/img/logowhite.webp"
              alt="Logo"
              className="h-full w-full object-contain p-1.5"
            />
          </div>
          <h1 className="text-lg font-semibold text-white">LK DETAILING</h1>
        </Link>

        {/* NAV DESKTOP */}
        <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
          <Link
            href="/#servicios"
            onClick={(e) => handleNavClick(e, "servicios")}
            className="transition hover:text-white"
          >
            Servicios
          </Link>
          <Link
            href="/#trabajos"
            onClick={(e) => handleNavClick(e, "trabajos")}
            className="transition hover:text-white"
          >
            Trabajos
          </Link>
          <Link
            href="/#contacto"
            onClick={(e) => handleNavClick(e, "contacto")}
            className="rounded-full border border-white/10 px-4 py-2 transition hover:border-lux/60 hover:text-white"
          >
            Contacto
          </Link>
          {isLoggedIn ? (
            <>
              <button
                onClick={() => router.push("/admin/turnos")}
                className={`flex items-center gap-2 transition hover:text-white ${
                  pathname === "/admin/turnos" ? "text-electric" : ""
                }`}
              >
                <Calendar size={18} />
                Turnos
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-red-400 transition hover:text-red-300"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push("/admin/login")}
              className="transition hover:text-white"
            >
              <LogIn size={20} />
            </button>
          )}
        </nav>

        {/* MOBILE TOGGLE */}
        <button
          className="md:hidden text-white"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* MENÚ MOBILE */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col p-6 md:hidden bg-[#0a0a0c]">
          <div className="flex justify-between items-center mb-10">
            <h1 className="text-lg font-bold text-white">MENÚ</h1>
            <button onClick={() => setMobileMenuOpen(false)}>
              <X size={28} className="text-white" />
            </button>
          </div>
          <nav className="flex flex-col gap-4 text-lg">
            <Link
              href="/#servicios"
              onClick={(e) => handleNavClick(e, "servicios")}
              className="py-4 px-6 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-lux/50 transition text-center"
            >
              Servicios
            </Link>
            <Link
              href="/#trabajos"
              onClick={(e) => handleNavClick(e, "trabajos")}
              className="py-4 px-6 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-lux/50 transition text-center"
            >
              Trabajos
            </Link>
            <Link
              href="/#contacto"
              onClick={(e) => handleNavClick(e, "contacto")}
              className="py-4 px-6 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-lux/50 transition text-center"
            >
              Contacto
            </Link>
            {isLoggedIn ? (
              <>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push("/admin/turnos");
                  }}
                  className={`flex items-center justify-center gap-2 py-4 px-6 rounded-xl border transition ${
                    pathname === "/admin/turnos"
                      ? "bg-electric/20 border-electric text-electric"
                      : "bg-lux/10 border-lux/50 text-lux"
                  }`}
                >
                  <Calendar size={20} />
                  Gestión de Turnos
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition"
                >
                  <LogOut size={20} />
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  router.push("/admin/login");
                }}
                className="py-4 px-6 rounded-xl bg-lux/10 border border-lux/50 text-lux hover:bg-lux/20 transition"
              >
                Admin Login
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
