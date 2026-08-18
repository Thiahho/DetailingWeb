import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { tenantHeader } from "@/src/lib/tenantHeader";

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

interface RescheduledBooking {
  id?: number;
  customerName?: string;
  email?: string;
  customerPhone?: string;
  service?: string;
  subject?: string;
  startDateTime?: string;
}

async function notifyRescheduled(booking: RescheduledBooking) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || user;
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Turneo";

  if (!user || !pass) return;

  const turno = formatDateTime(booking.startDateTime);
  const transporter = createTransporter();
  const emails: Promise<void>[] = [];

  // Email al admin
  if (adminEmail) {
    emails.push(
      transporter.sendMail({
        from: `"${businessName}" <${user}>`,
        to: adminEmail,
        subject: `🔄 Turno reprogramado — #${booking.id}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f1115;color:#f1f1f1;border-radius:12px;border:1px solid #30363d;">
            <h2 style="margin:0 0 4px;font-size:20px;">${businessName}</h2>
            <p style="color:#60a5fa;font-size:14px;margin:0 0 24px;">🔄 Un cliente reprogramó su turno</p>
            <div style="background:#1a1f26;border:1px solid #2a2f36;border-radius:10px;padding:20px;">
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="color:#888;padding:6px 0;">Turno #</td><td style="color:#fff;text-align:right;">${booking.id}</td></tr>
                <tr><td style="color:#888;padding:6px 0;">Nuevo horario</td><td style="color:#fff;text-align:right;">${turno}</td></tr>
                <tr><td style="color:#888;padding:6px 0;">Cliente</td><td style="color:#fff;text-align:right;">${booking.customerName || "—"}</td></tr>
                <tr><td style="color:#888;padding:6px 0;">Teléfono</td><td style="color:#fff;text-align:right;">${booking.customerPhone || "—"}</td></tr>
                <tr><td style="color:#888;padding:6px 0;">Email</td><td style="color:#fff;text-align:right;">${booking.email || "—"}</td></tr>
                <tr><td style="color:#888;padding:6px 0;">Servicio</td><td style="color:#fff;text-align:right;">${booking.service || "—"}</td></tr>
                ${booking.subject ? `<tr><td style="color:#888;padding:6px 0;">Trabajo</td><td style="color:#fff;text-align:right;">${booking.subject}</td></tr>` : ""}
              </table>
            </div>
            <p style="color:#666;font-size:12px;text-align:center;margin-top:20px;">El turno quedó en estado Pendiente y aguarda confirmación.</p>
          </div>`,
      }).then(() => { console.log(`[reschedule-email] Admin notificado por turno #${booking.id}`); })
    );
  }

  // Email al cliente
  if (booking.email) {
    const name = booking.customerName || "Cliente";
    emails.push(
      transporter.sendMail({
        from: `"${businessName}" <${user}>`,
        to: booking.email,
        subject: `Turno reprogramado — ${businessName}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f1115;color:#f1f1f1;border-radius:12px;border:1px solid #30363d;">
            <h2 style="margin:0 0 4px;font-size:20px;">${businessName}</h2>
            <p style="color:#60a5fa;font-size:14px;margin:0 0 24px;">🔄 Tu turno fue reprogramado</p>
            <p style="color:#ccc;font-size:15px;margin:0 0 20px;">Hola <strong>${name}</strong>, tu turno fue reprogramado exitosamente.</p>
            <div style="background:#1a1f26;border:1px solid #2a2f36;border-radius:10px;padding:20px;margin-bottom:20px;">
              <p style="color:#60a5fa;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Nuevo horario</p>
              <p style="color:#fff;font-size:18px;font-weight:bold;margin:0;">${turno}</p>
              ${booking.service ? `<p style="color:#888;font-size:13px;margin:8px 0 0;">${booking.service}</p>` : ""}
            </div>
            <p style="color:#666;font-size:12px;">Ante cualquier consulta respondé este email o escribinos por WhatsApp.</p>
          </div>`,
      }).then(() => { console.log(`[reschedule-email] Cliente notificado: ${booking.email}`); })
    );
  }

  await Promise.allSettled(emails);
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
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
      },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ message: "Error de conexión con el servidor" }, { status: 500 });
  }
}

// POST: ej. /api/bookings/5/cancel | /api/bookings/5/reschedule
export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join("/") || "";
  const token = request.cookies.get("admin_token")?.value || request.cookies.get("client_token")?.value || request.cookies.get("token")?.value;

  const contentType = request.headers.get("content-type") || "";
  const hasBody = contentType.includes("application/json");
  const body = hasBody ? await request.text() : undefined;

  try {
    const response = await fetch(`${API_URL}/api/bookings/${path}`, {
      method: "POST",
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
        ...(hasBody && { "Content-Type": "application/json" }),
      },
      body,
    });
    const data = await response.json();

    const isReschedule = params.path?.at(-1) === "reschedule";
    if (response.ok && isReschedule && data.booking) {
      notifyRescheduled(data.booking).catch((err) =>
        console.error("[reschedule-email] Error al enviar emails:", err)
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ message: "Error de conexión con el servidor" }, { status: 500 });
  }
}

// PUT: ej. /api/bookings/5/detail (admin - productos/servicios usados + fotos antes/después)
export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path?.join("/") || "";
  const token = request.cookies.get("admin_token")?.value || request.cookies.get("client_token")?.value || request.cookies.get("token")?.value;
  const body = await request.text();

  try {
    const response = await fetch(`${API_URL}/api/bookings/${path}`, {
      method: "PUT",
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
      body,
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

  try {
    const response = await fetch(`${API_URL}/api/bookings/${path}`, {
      method: "PATCH",
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}
