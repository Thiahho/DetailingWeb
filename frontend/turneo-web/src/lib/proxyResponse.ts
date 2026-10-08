import { NextResponse } from "next/server";

// El backend no siempre responde JSON: hay endpoints que devuelven 200 sin
// cuerpo (`return Ok()`), 401/403 vacíos y el rate limiter responde texto
// plano. Parsear a ciegas con response.json() convertía esas respuestas en un
// 500 "Error de conexión con el servidor" falso.
export async function relayResponse(response: Response) {
  const text = await response.text();
  // 204/304 no admiten cuerpo, y los clientes siempre hacen res.json().
  const status =
    response.status === 204 || response.status === 304 ? 200 : response.status;

  if (!text) return NextResponse.json({}, { status });

  try {
    return NextResponse.json(JSON.parse(text), { status });
  } catch {
    return NextResponse.json({ message: text }, { status });
  }
}
