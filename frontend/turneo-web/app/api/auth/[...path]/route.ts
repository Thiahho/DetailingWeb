// app/api/auth/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { relayResponse } from "@/src/lib/proxyResponse";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

// Rutas del backend que devuelven un código (pendingOtpCode) para mandar por
// email desde acá, con el texto que acompaña al código en cada caso.
const OTP_PATHS: Record<string, string> = {
  "client/access/request": "Código de acceso a Mis Turnos",
  "professional/register/request": "Código para activar tu cuenta de profesional",
};

async function sendOtpEmail(email: string, code: string, caption: string) {
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Turneo";
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  await transporter.sendMail({
    from: `"${businessName}" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Tu código de acceso - ${businessName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f1115;color:#f1f1f1;border-radius:12px">
        <h2 style="margin:0 0 8px;font-size:22px">${businessName}</h2>
        <p style="color:#999;margin:0 0 32px;font-size:14px">${caption}</p>
        <div style="background:#1a1f26;border:1px solid #2a2f36;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
          <p style="color:#999;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px">Tu código</p>
          <p style="font-size:42px;font-weight:bold;letter-spacing:10px;color:#f0b429;margin:0">${code}</p>
        </div>
        <p style="color:#666;font-size:12px;text-align:center">Este código expira en 15 minutos.<br>Si no solicitaste este código, podés ignorar este email.</p>
      </div>
    `,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join("/");
  const token = request.cookies.get("admin_token")?.value || request.cookies.get("client_token")?.value || request.cookies.get("token")?.value;

  // Logout: borrar cookie y retornar.
  // El path tiene que matchear exacto el de cookies.set() de más abajo (path: "/") —
  // sin eso el browser puede no reconocer que es la misma cookie y no la borra,
  // dejando la sesión viva aunque el usuario haya hecho logout.
  if (path === "logout") {
    const response = NextResponse.json({ message: "Sesión cerrada" });
    response.cookies.delete({ name: "admin_token", path: "/" });
    response.cookies.delete({ name: "client_token", path: "/" });
    response.cookies.delete({ name: "token", path: "/" });
    return response;
  }

  // Para otras rutas (login), parsear el body
  const body = await request.json();

  try {
    const response = await fetch(`${API_URL}/api/auth/${path}`, {
      method: "POST",
      headers: {
        ...tenantHeader(request),
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Enviar OTP por email si el backend devolvió el código pendiente
    if (OTP_PATHS[path] && response.ok && data.pendingOtpCode) {
      try {
        await sendOtpEmail(data.email, data.pendingOtpCode, OTP_PATHS[path]);
      } catch {
        // No bloquear el flujo si el email falla; el admin puede ver el código en los logs
      }
      // Omitir el OTP del response al cliente
      const { pendingOtpCode: _, ...safeData } = data;
      return NextResponse.json(safeData, { status: response.status });
    }

    // Si es login exitoso, crear cookie en Next.js
    if (response.ok && data.email) {
      const nextResponse = NextResponse.json(data);

      // Obtener el token de la cookie del backend
      const backendCookie = response.headers.get("set-cookie");

      if (backendCookie) {
        // Re-setear la cookie en el dominio de Next.js.
        // Profesionales (login con Role="Professional") usan el slot genérico "token";
        // Admin sigue en "admin_token"; rutas de cliente en "client_token".
        const cookieName =
          path === "login"
            ? data.role === "Professional" ? "token" : "admin_token"
            : path.startsWith("client/") ? "client_token" : "token";
        nextResponse.cookies.set(
          cookieName,
          extractTokenFromCookie(backendCookie),
          {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            // Sin maxAge/expires a propósito: cookie de sesión, el browser la
            // borra sola al cerrarse. El JWT en sí sigue válido hasta 24hs
            // (Jwt:ExpiryMinutes en el backend) si alguien lo reutiliza fuera
            // del browser, pero acá ya no sobrevive a cerrar la ventana.
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
  const token = request.cookies.get("admin_token")?.value || request.cookies.get("client_token")?.value || request.cookies.get("token")?.value;

  try {
    const response = await fetch(`${API_URL}/api/auth/${path}`, {
      method: "GET",
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
    });

    return await relayResponse(response);
  } catch (error) {
    return NextResponse.json({ message: "Error de conexión" }, { status: 500 });
  }
}

// Función helper para extraer el token
function extractTokenFromCookie(cookieHeader: string): string {
  const match = cookieHeader.match(/token=([^;]+)/);
  return match ? match[1] : "";
}
