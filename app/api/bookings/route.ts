import { NextRequest, NextResponse } from "next/server";

// GET: Obtener todas las reservas (admin)
export async function GET(request: NextRequest) {
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";
  const token = request.cookies.get("token")?.value;

  try {
    const response = await fetch(`${API_URL}/api/bookings`, {
      headers: {
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

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface BookingPayload {
  timeSlotId?: number;
  customerName?: string;
  customerPhone?: string;
  email?: string;
  vehicle?: string;
  service?: string;
  message?: string;
}

interface BookingResponse {
  success?: boolean;
  booking?: {
    id?: number;
    startDateTime?: string;
    endDateTime?: string;
    customerName?: string;
    email?: string;
    vehicle?: string;
    service?: string;
  };
}

function formatDateTime(iso?: string): string {
  if (!iso) return "No informado";
  // Parsear sin conversión UTC para respetar la hora local del negocio
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

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME || "AutoDetail Studio";
  if (!apiKey || !fromEmail) {
    console.error("[Brevo] Faltan variables de entorno BREVO_API_KEY o BREVO_FROM_EMAIL");
    return;
  }
  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`[Brevo] Error al enviar a ${to}: ${res.status} ${err}`);
  } else {
    console.log(`[Brevo] Email enviado a ${to}`);
  }
}

async function notifyAdminNewBooking(booking: BookingPayload, bookingData: BookingResponse) {
  const adminEmail = process.env.BREVO_ADMIN_EMAIL;
  if (!adminEmail) return;

  const safe = {
    customerName: booking.customerName || "No informado",
    customerPhone: booking.customerPhone || "No informado",
    vehicle: booking.vehicle || "No informado",
    service: booking.service || "No informado",
    turno: formatDateTime(bookingData.booking?.startDateTime),
    message: booking.message || "Sin mensaje adicional",
  };

  await sendEmail(
    adminEmail,
    "Nuevo turno reservado",
    `<h2>📅 Nuevo turno reservado</h2>
    <p><strong>Cliente:</strong> ${safe.customerName}</p>
    <p><strong>WhatsApp:</strong> ${safe.customerPhone}</p>
    <p><strong>Vehículo:</strong> ${safe.vehicle}</p>
    <p><strong>Servicio:</strong> ${safe.service}</p>
    <p><strong>Turno:</strong> ${safe.turno}</p>
    <p><strong>Mensaje:</strong> ${safe.message}</p>`
  );
}

async function notifyClientBookingReceived(booking: BookingPayload, bookingData: BookingResponse) {
  const customerEmail = booking.email;
  if (!customerEmail || customerEmail === process.env.BREVO_FROM_EMAIL) return;

  const turno = formatDateTime(bookingData.booking?.startDateTime);
  const name = booking.customerName || "Cliente";

  await sendEmail(
    customerEmail,
    "Reserva recibida — AutoDetail Studio",
    `<!DOCTYPE html>
    <html lang="es">
    <body style="margin:0;padding:0;background:#0f1115;font-family:Arial,sans-serif;">
      <div style="max-width:520px;margin:40px auto;background:#161b22;border-radius:12px;overflow:hidden;border:1px solid #30363d;">
        <div style="background:#1c2128;padding:32px 32px 24px;border-bottom:1px solid #30363d;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">AutoDetail Studio</h1>
          <p style="margin:8px 0 0;color:#8b949e;font-size:14px;">Detailing profesional</p>
        </div>
        <div style="padding:32px;">
          <h2 style="margin:0 0 8px;color:#ffffff;font-size:18px;">¡Hola, ${name}!</h2>
          <p style="color:#8b949e;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Recibimos tu solicitud de turno. En breve te contactamos para confirmar.
          </p>
          <div style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:20px;margin-bottom:24px;">
            <p style="margin:0 0 12px;color:#8b949e;font-size:13px;text-transform:uppercase;letter-spacing:.1em;">Detalle de tu reserva</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="color:#8b949e;font-size:14px;padding:6px 0;">Turno</td><td style="color:#ffffff;font-size:14px;text-align:right;padding:6px 0;">${turno}</td></tr>
              <tr><td style="color:#8b949e;font-size:14px;padding:6px 0;">Vehículo</td><td style="color:#ffffff;font-size:14px;text-align:right;padding:6px 0;">${booking.vehicle || "—"}</td></tr>
              <tr><td style="color:#8b949e;font-size:14px;padding:6px 0;">Servicio</td><td style="color:#ffffff;font-size:14px;text-align:right;padding:6px 0;">${booking.service || "—"}</td></tr>
            </table>
          </div>
          <p style="color:#8b949e;font-size:13px;margin:0;">
            Si tenés alguna duda, respondé este email o contactanos por WhatsApp.
          </p>
        </div>
        <div style="padding:20px 32px;border-top:1px solid #30363d;">
          <p style="margin:0;color:#484f58;font-size:12px;">© AutoDetail Studio — Este es un email automático.</p>
        </div>
      </div>
    </body>
    </html>`
  );
}

// POST: Crear una reserva
export async function POST(request: NextRequest) {
  const body = (await request.json()) as BookingPayload;

  try {
    const response = await fetch(`${API_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok) {
      const bookingData = data as BookingResponse;
      notifyAdminNewBooking(body, bookingData).catch((e) => console.error("[Brevo] Admin notify error:", e));
      notifyClientBookingReceived(body, bookingData).catch((e) => console.error("[Brevo] Client notify error:", e));
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}
