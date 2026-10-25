import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { relayResponse } from "@/src/lib/proxyResponse";
import { API_URL } from "@/src/lib/apiUrl";

// GET: Payment status by booking ID
export async function GET(
  request: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const response = await fetch(
      `${API_URL}/api/payments/${params.bookingId}`,
      {
        headers: { ...tenantHeader(request), "Content-Type": "application/json" },
      }
    );

    return await relayResponse(response);
  } catch {
    return NextResponse.json(
      { success: false, message: "Error de conexión con el servidor" },
      { status: 500 }
    );
  }
}
