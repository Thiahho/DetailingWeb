import { NextRequest, NextResponse } from "next/server";
import { tenantHeader } from "@/src/lib/tenantHeader";
import { relayResponse } from "@/src/lib/proxyResponse";
import { API_URL } from "@/src/lib/apiUrl";

// Proxy for the catalog admin endpoints (backend api/catalog/...): categories,
// attributes, attribute-values, products, media and variants. Forwards the
// auth cookie as a Bearer token, the tenant host and the query string, and
// relays the backend status and body as-is (empty bodies included, see
// relayResponse). Admin data is never cached here.
async function forward(request: NextRequest, path: string[], method: string) {
  const token =
    request.cookies.get("admin_token")?.value ||
    request.cookies.get("client_token")?.value ||
    request.cookies.get("token")?.value;
  // Some actions (variants/generate) are POSTs without a body.
  const body = method === "GET" || method === "DELETE" ? "" : await request.text();

  try {
    const response = await fetch(`${API_URL}/api/catalog/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`, {
      method,
      headers: {
        ...tenantHeader(request),
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
      body: body === "" ? undefined : body,
      cache: "no-store",
    });
    return await relayResponse(response);
  } catch {
    return NextResponse.json({ message: "Error de conexión con el servidor" }, { status: 500 });
  }
}

type Context = { params: { path: string[] } };

export async function GET(request: NextRequest, { params }: Context) {
  return forward(request, params.path, "GET");
}

export async function POST(request: NextRequest, { params }: Context) {
  return forward(request, params.path, "POST");
}

export async function PUT(request: NextRequest, { params }: Context) {
  return forward(request, params.path, "PUT");
}

export async function PATCH(request: NextRequest, { params }: Context) {
  return forward(request, params.path, "PATCH");
}

export async function DELETE(request: NextRequest, { params }: Context) {
  return forward(request, params.path, "DELETE");
}
