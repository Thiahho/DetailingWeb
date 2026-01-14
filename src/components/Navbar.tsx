"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LogIn, Menu, X, ShieldCheck, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pathname = usePathname();

  // Verificar si hay sesión activa mediante el endpoint /me
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/auth/me", {
          credentials: "include", // Necesario para enviar la cookie HttpOnly
        });
        setIsLoggedIn(res.ok);
      } catch {
        setIsLoggedIn(false);
      }
    };
    checkAuth();
  }, [pathname]); // Re-verificar si cambia la ruta

  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Función para manejar el scroll suave en la misma página
  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (pathname === "/") {
      e.preventDefault();
      const element = document.getElementById(id);
      element?.scrollIntoView({ behavior: "smooth" });
      closeMobileMenu();
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-midnight/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* LOGO - Siempre vuelve arriba */}
        <Link
          href="/"
          className="flex items-center gap-3 transition hover:opacity-80"
        >
          <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
            <img
              src="/img/logowhite.webp"
              alt="Logo"
              className="h-full w-full object-contain p-1.5"
            />
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/50">
              Detailing premium
            </p>
            <h1 className="text-sm font-semibold text-white">LK DETAILING</h1>
          </div>
        </Link>

        {/* NAV DESKTOP */}
        <nav className="hidden items-center gap-8 text-sm font-medium text-white/70 md:flex">
          <a
            href="#servicios"
            onClick={(e) => handleScroll(e, "servicios")}
            className="transition hover:text-white"
          >
            Servicios
          </a>
          <a
            href="#trabajos"
            onClick={(e) => handleScroll(e, "trabajos")}
            className="transition hover:text-white"
          >
            Trabajos
          </a>

          {isLoggedIn ? (
            <>
              <Link
                href="/admin/turnos"
                className="flex items-center gap-2 text-lux font-bold transition hover:opacity-80"
              >
                <ShieldCheck size={18} />
                Panel Admin
              </Link>
            </>
          ) : (
            <a
              href="#contacto"
              onClick={(e) => handleScroll(e, "contacto")}
              className="rounded-full border border-white/10 px-4 py-2 transition hover:border-lux/60 hover:text-white"
            >
              Contacto
            </a>
          )}

          <Link
            href="/admin/login"
            className="transition hover:text-white"
            title="Acceso Admin"
          >
            <LogIn size={20} className={isLoggedIn ? "text-lux" : ""} />
          </Link>
        </nav>

        {/* MOBILE BUTTON */}
        <button
          className="md:hidden text-white"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-midnight/95 border-b border-white/10 p-6 flex flex-col gap-6 md:hidden animate-in fade-in slide-in-from-top-4">
          <a
            href="#servicios"
            onClick={(e) => handleScroll(e, "servicios")}
            className="text-lg text-white/70"
          >
            Servicios
          </a>
          <a
            href="#trabajos"
            onClick={(e) => handleScroll(e, "trabajos")}
            className="text-lg text-white/70"
          >
            Trabajos
          </a>
          {isLoggedIn && (
            <Link
              href="/admin/turnos"
              onClick={closeMobileMenu}
              className="text-lg text-lux font-bold"
            >
              Panel Admin
            </Link>
          )}
          <Link
            href="/admin/login"
            onClick={closeMobileMenu}
            className="flex items-center gap-2 text-lg text-white/70"
          >
            <LogIn size={20} /> Iniciar Sesión
          </Link>
        </div>
      )}
    </header>
  );
}
