"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Guard del panel interno: a diferencia de /admin (que confía en localStorage
// para la UI, ver src/lib/auth.ts), acá se verifica contra el backend en cada
// carga — es un panel de bajo tráfico, un solo operador, y no vale la pena
// mezclar su estado de sesión con el de admin de tenant en el mismo browser.
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/platform/login";
  // Página legal pública: un prospecto de tenant tiene que poder leerla antes
  // de tener cuenta (Thiago la comparte por link al dar de alta el negocio).
  const isPublicLegal = pathname === "/platform/terminos-saas";
  const skipAuth = isLogin || isPublicLegal;
  const [checked, setChecked] = useState(skipAuth);

  useEffect(() => {
    if (skipAuth) return;

    fetch("/api/platform/auth/me", { credentials: "include" })
      .then((res) => {
        if (res.ok) setChecked(true);
        else router.push("/platform/login");
      })
      .catch(() => router.push("/platform/login"));
  }, [skipAuth, router]);

  if (skipAuth) return <>{children}</>;

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <div className="text-white/60">Verificando sesión...</div>
      </div>
    );
  }

  return <div className="min-h-screen bg-charcoal">{children}</div>;
}
