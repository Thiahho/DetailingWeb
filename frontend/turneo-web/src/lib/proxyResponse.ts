import { NextResponse } from "next/server";

// El backend no siempre responde JSON: hay endpoints que devuelven 200 sin
// cuerpo (`return Ok()`), 401/403 vacíos y el rate limiter responde texto
// plano. Parsear a ciegas con response.json() convertía esas respuestas en un
// 500 "Error de conexión con el servidor" falso.

// Para los handlers que necesitan leer el cuerpo antes de responder (cookies
// de login, emails de reservas). Sin cuerpo devuelve {}, así que los chequeos
// del tipo `data.email` siguen funcionando.
export async function readBackendBody(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function relayResponse(response: Response) {
  const data = await readBackendBody(response);
  // 204/304 no admiten cuerpo, y los clientes siempre hacen res.json().
  const status =
    response.status === 204 || response.status === 304 ? 200 : response.status;

  return NextResponse.json(data, { status });
}
