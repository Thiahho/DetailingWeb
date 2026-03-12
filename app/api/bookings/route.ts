import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";
const RESEND_API_URL = "https://api.resend.com/emails";

interface BookingPayload {
  timeSlotId?: number;
  customerName?: string;
  customerPhone?: string;
  vehicle?: string;
  service?: string;
  message?: string;
}

async function notifyAdminNewBooking(booking: BookingPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.RESEND_ADMIN_EMAIL;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !adminEmail || !fromEmail) {
    return;
  }

  const safe = {
    customerName: booking.customerName || "No informado",
    customerPhone: booking.customerPhone || "No informado",
    vehicle: booking.vehicle || "No informado",
    service: booking.service || "No informado",
    timeSlotId:
      typeof booking.timeSlotId === "number"
        ? booking.timeSlotId.toString()
        : "No informado",
    message: booking.message || "Sin mensaje adicional",
  };

  const html = `
    <h2>📅 Nuevo turno reservado</h2>
    <p><strong>Cliente:</strong> ${safe.customerName}</p>
    <p><strong>WhatsApp:</strong> ${safe.customerPhone}</p>
    <p><strong>Vehículo:</strong> ${safe.vehicle}</p>
    <p><strong>Servicio:</strong> ${safe.service}</p>
    <p><strong>Turno (slot id):</strong> ${safe.timeSlotId}</p>
    <p><strong>Mensaje:</strong> ${safe.message}</p>
  `;

  await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [adminEmail],
      subject: "Nuevo turno reservado",
      html,
    }),
  });
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
      notifyAdminNewBooking(body).catch(() => {
        // Evita romper la reserva del cliente si falla el envío de email.
      });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}
