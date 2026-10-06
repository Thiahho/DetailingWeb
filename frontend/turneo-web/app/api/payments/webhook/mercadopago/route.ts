import { NextRequest, NextResponse } from "next/server";
import { clientIpHeaders } from "@/src/lib/tenantHeader";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

// El backend valida la firma HMAC de MercadoPago con estos dos headers (más
// `data.id` del query string): sin reenviarlos, toda notificación que entre
// por este proxy se rechaza con 401.
const SIGNATURE_HEADERS = ["x-signature", "x-request-id"];

// POST: MercadoPago webhook - proxy to backend
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const queryString = request.nextUrl.search;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...clientIpHeaders(request),
    };
    for (const name of SIGNATURE_HEADERS) {
      const value = request.headers.get(name);
      if (value) headers[name] = value;
    }

    const response = await fetch(
      `${API_URL}/api/payments/webhook/mercadopago${queryString}`,
      {
        method: "POST",
        headers,
        body,
      }
    );

    return NextResponse.json({}, { status: response.status });
  } catch {
    // Always return 200 for webhooks to prevent retries
    return NextResponse.json({}, { status: 200 });
  }
}
