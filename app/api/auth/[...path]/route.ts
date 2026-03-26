// app/api/auth/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

async function sendOtpEmail(email: string, code: string) {
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Mi Negocio";
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
        <p style="color:#999;margin:0 0 32px;font-size:14px">Código de acceso a Mis Turnos</p>
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

  // Logout: borrar cookie y retornar
  if (path === "logout") {
    const response = NextResponse.json({ message: "Sesión cerrada" });
    response.cookies.delete("admin_token");
    response.cookies.delete("client_token");
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
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Enviar OTP por email si el backend devolvió el código pendiente
    if (path === "client/access/request" && response.ok && data.pendingOtpCode) {
      try {
        await sendOtpEmail(data.email, data.pendingOtpCode);
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
        // Re-setear la cookie en el dominio de Next.js
        const cookieName = path === "login" ? "admin_token" : path.startsWith("client/") ? "client_token" : "token";
        nextResponse.cookies.set(
          cookieName,
          extractTokenFromCookie(backendCookie),
          {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge: 60 * 60 * 24, // 24 horas (igual que el JWT)
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
