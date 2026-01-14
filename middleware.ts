import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Next.js lee la cookie desde el servidor
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  // 1. Si intenta entrar a /admin y no tiene token, mandarlo al login
  if (pathname.startsWith("/admin") && !pathname.includes("/login") && !token) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  // 2. Si ya está logueado e intenta ir al login, mandarlo a turnos
  if (pathname.includes("/admin/login") && token) {
    return NextResponse.redirect(new URL("/admin/turnos", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"], // Solo protege rutas de administración
};
