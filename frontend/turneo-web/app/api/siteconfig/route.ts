import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { relayResponse } from "@/src/lib/proxyResponse";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${API_URL}/api/siteconfig`, {
      headers: tenantHeader(request),
      next: { revalidate: 300, tags: ["siteconfig"] },
    });
    return await relayResponse(response);
  } catch {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}

// Invalida el cache de 5 min del GET (tag "siteconfig") apenas se guarda un
// cambio real — si no, el admin puede recargar su propia página de
// Configuración y ver el valor viejo hasta por 5 minutos aunque el guardado
// haya funcionado.
export async function PUT(request: NextRequest) {
  const token =
    request.cookies.get("admin_token")?.value ||
    request.cookies.get("client_token")?.value ||
    request.cookies.get("token")?.value;
  const body = await request.json();
  try {
    const response = await fetch(`${API_URL}/api/siteconfig`, {
      method: "PUT",
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      revalidateTag("siteconfig");
    }
    return await relayResponse(response);
  } catch {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}
