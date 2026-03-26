import { NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

// POST: MercadoPago webhook - proxy to backend
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const queryString = request.nextUrl.search;

    const response = await fetch(
      `${API_URL}/api/payments/webhook/mercadopago${queryString}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      }
    );

    return NextResponse.json({}, { status: response.status });
  } catch {
    // Always return 200 for webhooks to prevent retries
    return NextResponse.json({}, { status: 200 });
  }
}
