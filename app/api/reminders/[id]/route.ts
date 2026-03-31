import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";

function getToken(request: NextRequest) {
  return request.cookies.get("admin_token")?.value ?? request.cookies.get("token")?.value ?? "";
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const res = await fetch(`${API_URL}/api/reminders/${params.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${getToken(request)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "Error de conexión" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = await fetch(`${API_URL}/api/reminders/${params.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken(request)}` },
    });
    return new NextResponse(null, { status: res.status });
  } catch {
    return NextResponse.json({ message: "Error de conexión" }, { status: 500 });
  }
}
