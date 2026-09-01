"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LogIn, LogOut, Menu, X, LayoutDashboard } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { getSiteConfig } from "@/src/lib/siteConfig";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [businessName, setBusinessName] = useState(
    process.env.NEXT_PUBLIC_BUSINESS_NAME || ""
  );
  const logoUrl = "/img/LogoPortada.png";
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = () => {
      setIsLoggedIn(localStorage.getItem("isLoggedIn") === "true");
    };
    checkAuth();
    window.addEventListener("storage", checkAuth);
    window.addEventListener("auth-change", checkAuth);
    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("auth-change", checkAuth);
    };
  }, [pathname]);

  useEffect(() => {
    getSiteConfig().then((config) => {
      if (config.businessName) setBusinessName(config.businessName);
    });
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (pathname === "/reservar") {
      e.preventDefault();
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
    setMobileMenuOpen(false);
  };

  const close = () => setMobileMenuOpen(false);

  const handleLogout = async () => {
    const { logout } = await import("@/src/lib/auth");
    await logout();
    close();
    router.push("/reservar");
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-mauve/10 bg-cream/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:py-6">
          {/* LOGO */}
          <Link href="/reservar" className="flex items-center transition hover:opacity-80">
            <img
              src={logoUrl}
              alt={businessName || "Logo"}
              className="h-10 md:h-14 w-auto object-contain"
            />
          </Link>

          {/* NAV DESKTOP */}
          <nav className="hidden items-center gap-6 text-sm text-charcoal/70 md:flex">
            <Link href="/reservar#servicios" onClick={(e) => handleNavClick(e, "servicios")} className="transition hover:text-charcoal">
              Servicios
            </Link>
            <Link href="/reservar#trabajos" onClick={(e) => handleNavClick(e, "trabajos")} className="transition hover:text-charcoal">
              Trabajos
            </Link>
            <Link href="/reservar#nosotros" onClick={(e) => handleNavClick(e, "nosotros")} className="transition hover:text-charcoal">
              Nosotros
            </Link>
            <Link href="/reservar#preguntas" onClick={(e) => handleNavClick(e, "preguntas")} className="transition hover:text-charcoal">
              Preguntas
            </Link>
            <Link
              href="/mis-turnos"
              className="transition hover:text-charcoal"
            >
              Mis turnos
            </Link>
            <Link
              href="/reservar#contacto"
              onClick={(e) => handleNavClick(e, "contacto")}
              className="rounded-full border border-mauve/20 px-4 py-2 transition hover:border-blush hover:text-charcoal"
            >
              Contacto
            </Link>
            {isLoggedIn ? (
              <button
                onClick={() => router.push("/admin")}
                className="flex items-center gap-2 text-sm text-charcoal/60 hover:text-charcoal transition"
              >
                <LayoutDashboard size={17} />
                Panel
              </button>
            ) : (
              <button onClick={() => router.push("/admin/login")} className="transition hover:text-charcoal">
                <LogIn size={20} />
              </button>
            )}
          </nav>

          {/* MOBILE TOGGLE */}
          <button className="md:hidden p-1.5 text-charcoal" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998] bg-black/60 md:hidden"
            onClick={close}
          />
          {/* Drawer from right */}
          <div className="fixed top-0 right-0 h-full w-72 bg-ivory border-l border-mauve/10 z-[9999] flex flex-col md:hidden shadow-elevated">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-5 border-b border-mauve/10">
              <span className="text-charcoal font-semibold text-sm">Menú</span>
              <button onClick={close} className="p-1.5 text-charcoal/40 hover:text-charcoal transition">
                <X size={20} />
              </button>
            </div>

            {/* Links */}
            <nav className="flex-1 px-4 py-5 space-y-2">
              <Link
                href="/reservar#servicios"
                onClick={(e) => handleNavClick(e, "servicios")}
                className="flex items-center px-4 py-3.5 rounded-xl bg-white border border-mauve/10 text-charcoal hover:bg-blush/10 hover:border-blush/40 transition text-sm font-medium"
              >
                Servicios
              </Link>
              <Link
                href="/reservar#trabajos"
                onClick={(e) => handleNavClick(e, "trabajos")}
                className="flex items-center px-4 py-3.5 rounded-xl bg-white border border-mauve/10 text-charcoal hover:bg-blush/10 hover:border-blush/40 transition text-sm font-medium"
              >
                Trabajos
              </Link>
              <Link
                href="/reservar#nosotros"
                onClick={(e) => handleNavClick(e, "nosotros")}
                className="flex items-center px-4 py-3.5 rounded-xl bg-white border border-mauve/10 text-charcoal hover:bg-blush/10 hover:border-blush/40 transition text-sm font-medium"
              >
                Nosotros
              </Link>
              <Link
                href="/reservar#preguntas"
                onClick={(e) => handleNavClick(e, "preguntas")}
                className="flex items-center px-4 py-3.5 rounded-xl bg-white border border-mauve/10 text-charcoal hover:bg-blush/10 hover:border-blush/40 transition text-sm font-medium"
              >
                Preguntas
              </Link>
              <Link
                href="/mis-turnos"
                onClick={close}
                className="flex items-center px-4 py-3.5 rounded-xl bg-white border border-mauve/10 text-charcoal hover:bg-blush/10 hover:border-blush/40 transition text-sm font-medium"
              >
                Mis turnos
              </Link>
              <Link
                href="/reservar#contacto"
                onClick={(e) => handleNavClick(e, "contacto")}
                className="flex items-center px-4 py-3.5 rounded-xl bg-white border border-mauve/10 text-charcoal hover:bg-blush/10 hover:border-blush/40 transition text-sm font-medium"
              >
                Contacto
              </Link>

              {isLoggedIn ? (
                <>
                  <button
                    onClick={() => { close(); router.push("/admin"); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-white border border-mauve/10 text-charcoal hover:bg-blush/10 transition text-sm font-medium"
                  >
                    <LayoutDashboard size={17} />
                    Panel Admin
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-white border border-mauve/10 text-red-600/70 hover:text-red-600 hover:bg-red-50 transition text-sm font-medium"
                  >
                    <LogOut size={17} />
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { close(); router.push("/admin/login"); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-champagne/10 border border-champagne/30 text-champagne hover:bg-champagne/20 transition text-sm font-medium"
                >
                  <LogIn size={17} />
                  Acceso Admin
                </button>
              )}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
