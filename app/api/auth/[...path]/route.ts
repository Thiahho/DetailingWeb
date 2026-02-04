// app/api/auth/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_URL =
  //process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5048";

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join("/");

  // Logout: borrar cookie y retornar
  if (path === "logout") {
    const response = NextResponse.json({ message: "Sesión cerrada" });
    response.cookies.delete("token");
    return response;
  }

  // Para otras rutas (login), parsear el body
  const body = await request.json();

  try {
    const response = await fetch(`${API_URL}/api/auth/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Si es login exitoso, crear cookie en Next.js
    if (response.ok && path === "login" && data.email) {
      const nextResponse = NextResponse.json(data);

      // Obtener el token de la cookie del backend
      const backendCookie = response.headers.get("set-cookie");

      if (backendCookie) {
        // Re-setear la cookie en el dominio de Next.js
        nextResponse.cookies.set(
          "token",
          extractTokenFromCookie(backendCookie),
          {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge: 60 * 60, // 1 hora
            path: "/",
          }
        );
      }

      return nextResponse;
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join("/");
  const token = request.cookies.get("token")?.value;

  try {
    const response = await fetch(`${API_URL}/api/auth/${path}`, {
      method: "GET",
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ message: "Error de conexión" }, { status: 500 });
  }
}

// Función helper para extraer el token
function extractTokenFromCookie(cookieHeader: string): string {
  const match = cookieHeader.match(/token=([^;]+)/);
  return match ? match[1] : "";
}
