import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const geoServer = vi.hoisted(() => ({
  searchLocalidades: vi.fn(),
  searchDirecciones: vi.fn(),
  resolveMapsUrl: vi.fn(),
}));
vi.mock("@/src/lib/geo/geoServer", () => geoServer);

const request = (path: string, ip: string) => new NextRequest(`http://localhost${path}`, { headers: { "x-forwarded-for": ip } });

// Fresh modules per test: the rate limiters are module-level state.
async function loadRoutes() {
  vi.resetModules();
  const [localidades, direcciones, ubicacion] = await Promise.all([
    import("@/app/api/geo/localidades/route"),
    import("@/app/api/geo/direcciones/route"),
    import("@/app/api/geo/ubicacion/route"),
  ]);
  return { localidades: localidades.GET, direcciones: direcciones.GET, ubicacion: ubicacion.GET };
}

beforeEach(() => {
  geoServer.searchLocalidades.mockReset().mockResolvedValue([]);
  geoServer.searchDirecciones.mockReset().mockResolvedValue([]);
  geoServer.resolveMapsUrl.mockReset();
});

describe("GET /api/geo/localidades", () => {
  it("returns no items for short queries without calling the provider", async () => {
    const { localidades } = await loadRoutes();
    const res = await localidades(request("/api/geo/localidades?q=m", "1.1.1.1"));
    expect(await res.json()).toEqual({ items: [] });
    expect(geoServer.searchLocalidades).not.toHaveBeenCalled();
  });

  it("trims the query and caps it at 80 characters", async () => {
    const { localidades } = await loadRoutes();
    await localidades(request(`/api/geo/localidades?q=${encodeURIComponent(`  ${"a".repeat(100)}  `)}`, "1.1.1.1"));
    expect(geoServer.searchLocalidades).toHaveBeenCalledWith("a".repeat(80));
  });

  it("answers 502 with empty items when the provider fails", async () => {
    geoServer.searchLocalidades.mockRejectedValue(new Error("down"));
    const { localidades } = await loadRoutes();
    const res = await localidades(request("/api/geo/localidades?q=moreno", "1.1.1.1"));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ items: [], error: "sin-servicio" });
  });

  it("answers 429 with a Spanish message once the per-IP limit is spent", async () => {
    const { localidades } = await loadRoutes();
    for (let i = 0; i < 60; i++) {
      expect((await localidades(request("/api/geo/localidades?q=moreno", "9.9.9.9"))).status).toBe(200);
    }
    const res = await localidades(request("/api/geo/localidades?q=moreno", "9.9.9.9"));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    const body = await res.json();
    expect(body).toMatchObject({ items: [], error: "demasiadas-solicitudes" });
    expect(body.message).toMatch(/Esperá/);
    expect(geoServer.searchLocalidades).toHaveBeenCalledTimes(60);

    // Another visitor keeps its own budget.
    expect((await localidades(request("/api/geo/localidades?q=moreno", "8.8.8.8"))).status).toBe(200);
  });
});

describe("GET /api/geo/direcciones", () => {
  it("passes a valid lat/lng bias and ignores an invalid one", async () => {
    const { direcciones } = await loadRoutes();
    await direcciones(request("/api/geo/direcciones?q=thames&lat=-34.58&lng=-58.42", "1.1.1.1"));
    expect(geoServer.searchDirecciones).toHaveBeenLastCalledWith("thames", { lat: -34.58, lng: -58.42 });
    await direcciones(request("/api/geo/direcciones?q=thames&lat=-134&lng=-58.42", "1.1.1.1"));
    expect(geoServer.searchDirecciones).toHaveBeenLastCalledWith("thames", null);
  });

  it("returns no items for queries under 3 characters", async () => {
    const { direcciones } = await loadRoutes();
    const res = await direcciones(request("/api/geo/direcciones?q=th", "1.1.1.1"));
    expect(await res.json()).toEqual({ items: [] });
    expect(geoServer.searchDirecciones).not.toHaveBeenCalled();
  });

  it("is rate limited per IP", async () => {
    const { direcciones } = await loadRoutes();
    for (let i = 0; i < 60; i++) await direcciones(request("/api/geo/direcciones?q=thames", "7.7.7.7"));
    expect((await direcciones(request("/api/geo/direcciones?q=thames", "7.7.7.7"))).status).toBe(429);
  });
});

describe("GET /api/geo/ubicacion", () => {
  it("rejects missing or oversized links with 422", async () => {
    const { ubicacion } = await loadRoutes();
    expect((await ubicacion(request("/api/geo/ubicacion", "1.1.1.1"))).status).toBe(422);
    const long = encodeURIComponent(`https://maps.google.com/${"a".repeat(2001)}`);
    const res = await ubicacion(request(`/api/geo/ubicacion?url=${long}`, "1.1.1.1"));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "link-invalido" });
    expect(geoServer.resolveMapsUrl).not.toHaveBeenCalled();
  });

  it("maps resolver results to status codes", async () => {
    const { ubicacion } = await loadRoutes();
    const url = `/api/geo/ubicacion?url=${encodeURIComponent("https://maps.app.goo.gl/x")}`;
    geoServer.resolveMapsUrl.mockResolvedValueOnce("sin-servicio");
    expect((await ubicacion(request(url, "1.1.1.1"))).status).toBe(502);
    geoServer.resolveMapsUrl.mockResolvedValueOnce("sin-coordenadas");
    expect((await ubicacion(request(url, "1.1.1.1"))).status).toBe(422);
    const lugar = { lat: -34.6, lng: -58.4, direccion: "Thames 1800", tieneAltura: true, localidad: "Palermo", partido: "", provincia: "", enZona: true };
    geoServer.resolveMapsUrl.mockResolvedValueOnce(lugar);
    const ok = await ubicacion(request(url, "1.1.1.1"));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ lugar });
  });

  it("allows 10 lookups per minute per IP", async () => {
    geoServer.resolveMapsUrl.mockResolvedValue("sin-coordenadas");
    const { ubicacion } = await loadRoutes();
    const url = `/api/geo/ubicacion?url=${encodeURIComponent("https://maps.app.goo.gl/x")}`;
    for (let i = 0; i < 10; i++) await ubicacion(request(url, "6.6.6.6"));
    const res = await ubicacion(request(url, "6.6.6.6"));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "demasiadas-solicitudes" });
    expect(geoServer.resolveMapsUrl).toHaveBeenCalledTimes(10);
  });
});
