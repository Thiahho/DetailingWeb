"use client";

import { useState } from "react";
import Link from "next/link";
import { LogIn, Menu, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

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
          <Link href="/admin/login" className="transition hover:text-white">
            <LogIn size={20} />
          </Link>
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
        <div className="fixed inset-0 z-50 bg-midnight/95 flex flex-col p-6 md:hidden">
          <div className="flex justify-between items-center mb-10">
            <h1 className="text-lg font-bold">MENÚ</h1>
            <X size={28} onClick={() => setMobileMenuOpen(false)} />
          </div>
          <nav className="flex flex-col gap-8 text-xl text-center">
            <Link
              href="/#servicios"
              onClick={(e) => handleNavClick(e, "servicios")}
            >
              Servicios
            </Link>
            <Link
              href="/#trabajos"
              onClick={(e) => handleNavClick(e, "trabajos")}
            >
              Trabajos
            </Link>
            <Link
              href="/#contacto"
              onClick={(e) => handleNavClick(e, "contacto")}
            >
              Contacto
            </Link>
            <Link
              href="/admin/login"
              onClick={() => setMobileMenuOpen(false)}
              className="text-lux"
            >
              Admin Login
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
