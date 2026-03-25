import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function formatDateTime(iso?: string): string {
  if (!iso) return "No informado";
  const clean = iso.replace("Z", "");
  const [datePart, timePart] = clean.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  const date = new Date(y, m - 1, d, h, min);
  return date.toLocaleString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface BookingDetail {
  id?: number;
  customerName?: string;
  email?: string;
  customerPhone?: string;
  vehicle?: string;
  service?: string;
  startDateTime?: string;
  status?: string;
  timeSlot?: {
    startDateTime?: string;
  };
}

async function notifyClientBookingConfirmed(booking: BookingDetail, bookingId: string) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const customerEmail = booking.email;

  if (!user || !pass) { console.error("[confirm-email] Faltan variables GMAIL_USER o GMAIL_APP_PASSWORD"); return; }
  if (!customerEmail) { console.error("[confirm-email] El booking no tiene email"); return; }

  const turno = formatDateTime(booking.startDateTime ?? booking.timeSlot?.startDateTime);
  const name = booking.customerName || "Cliente";
  const cancelUrl = `https://detailing-web-five.vercel.app/cancelar?bookingId=${bookingId}`;

  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: `"AutoDetail Studio" <${user}>`,
    to: customerEmail,
    subject: "¡Turno confirmado! — AutoDetail Studio",
    html: `<!DOCTYPE html>
    <html lang="es">
    <body style="margin:0;padding:0;background:#0f1115;font-family:Arial,sans-serif;">
      <div style="max-width:520px;margin:40px auto;background:#161b22;border-radius:12px;overflow:hidden;border:1px solid #30363d;">
        <div style="background:#0f2918;padding:32px 32px 24px;border-bottom:1px solid #1a3a24;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">AutoDetail Studio</h1>
          <p style="margin:8px 0 0;color:#4ade80;font-size:14px;">✓ Turno confirmado</p>
        </div>
        <div style="padding:32px;">
          <h2 style="margin:0 0 8px;color:#ffffff;font-size:18px;">¡Todo listo, ${name}!</h2>
          <p style="color:#8b949e;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Tu turno fue <strong style="color:#4ade80;">confirmado</strong>. Te esperamos en el local.
          </p>
          <div style="background:#0d1117;border:1px solid #1a3a24;border-radius:8px;padding:20px;margin-bottom:24px;">
            <p style="margin:0 0 12px;color:#4ade80;font-size:13px;text-transform:uppercase;letter-spacing:.1em;">Detalle de tu turno</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="color:#8b949e;font-size:14px;padding:6px 0;">Fecha y hora</td><td style="color:#ffffff;font-size:14px;text-align:right;padding:6px 0;">${turno}</td></tr>
              <tr><td style="color:#8b949e;font-size:14px;padding:6px 0;">Vehículo</td><td style="color:#ffffff;font-size:14px;text-align:right;padding:6px 0;">${booking.vehicle || "—"}</td></tr>
              <tr><td style="color:#8b949e;font-size:14px;padding:6px 0;">Servicio</td><td style="color:#ffffff;font-size:14px;text-align:right;padding:6px 0;">${booking.service || "—"}</td></tr>
            </table>
          </div>
          <p style="color:#8b949e;font-size:13px;margin:0;line-height:1.6;">
            Ante cualquier cambio o consulta, respondé este email o escribinos por WhatsApp.
          </p>
          <div style="margin-top:24px;text-align:center;">
            <a href="${cancelUrl}" style="display:inline-block;padding:10px 20px;background:#1a1a1a;color:#f87171;border:1px solid #f87171;border-radius:6px;font-size:13px;text-decoration:none;">
              Cancelar turno
            </a>
          </div>
        </div>
        <div style="padding:20px 32px;border-top:1px solid #30363d;">
          <p style="margin:0;color:#484f58;font-size:12px;">© AutoDetail Studio — Este es un email automático.</p>
        </div>
      </div>
    </body>
    </html>`,
  });
  console.log(`[confirm-email] Gmail enviado a ${customerEmail} — messageId: ${info.messageId}`);
}

// GET: ej. /api/bookings/5
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join("/") || "";
  const token = request.cookies.get("admin_token")?.value || request.cookies.get("client_token")?.value || request.cookies.get("token")?.value;
  try {
    const response = await fetch(`${API_URL}/api/bookings/${path}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ message: "Error de conexión con el servidor" }, { status: 500 });
  }
}

// POST: ej. /api/bookings/5/cancel
export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join("/") || "";
  const token = request.cookies.get("admin_token")?.value || request.cookies.get("client_token")?.value || request.cookies.get("token")?.value;
  try {
    const response = await fetch(`${API_URL}/api/bookings/${path}`, {
      method: "POST",
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ message: "Error de conexión con el servidor" }, { status: 500 });
  }
}

// PATCH: ej. /api/bookings/5/confirm
export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join("/") || "";
  const token = request.cookies.get("admin_token")?.value || request.cookies.get("client_token")?.value || request.cookies.get("token")?.value;
  const isConfirm = params.path?.at(-1) === "confirm";

  // Leer el body para obtener el email enviado desde el frontend
  const body = isConfirm ? await request.json().catch(() => ({})) : {};

  try {
    const response = await fetch(`${API_URL}/api/bookings/${path}`, {
      method: "PATCH",
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();

    if (response.ok && isConfirm) {
      // Fire-and-forget: no bloquear la respuesta esperando el email
      notifyClientBookingConfirmed({
        email: body.email,
        customerName: body.customerName,
        vehicle: body.vehicle,
        service: body.service,
        startDateTime: body.startDateTime,
      }, params.path[0]).catch((emailErr) =>
        console.error("[confirm-email] Error al enviar email de confirmación:", emailErr)
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}
