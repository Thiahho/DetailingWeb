import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pin = (lat: number, lng: number) => `https://www.google.com/maps/@${lat},${lng},17z`;
const nominatimBody = { address: { road: "Thames", house_number: "1800", suburb: "Palermo", "ISO3166-2-lvl4": "AR-C" } };

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

// Fresh module per test: the throttle and the cache are module-level state.
async function loadModule() {
  vi.resetModules();
  return import("@/src/lib/geo/geoServer");
}

describe("resolveMapsUrl", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reverse geocodes the link coordinates with an identifying User-Agent", async () => {
    fetchMock.mockResolvedValue(jsonResponse(nominatimBody));
    const { resolveMapsUrl } = await loadModule();
    const lugar = await resolveMapsUrl(pin(-34.58, -58.42));
    expect(lugar).toMatchObject({ direccion: "Thames 1800", localidad: "Palermo", lat: -34.58, lng: -58.42 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("https://nominatim.openstreetmap.org/reverse?");
    expect(new Headers(init?.headers).get("User-Agent")).toMatch(/^Turneo\/1\.0 \(\+https?:\/\//);
  });

  it("caches identical reverse lookups instead of calling Nominatim again", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(nominatimBody));
    const { resolveMapsUrl } = await loadModule();
    await resolveMapsUrl(pin(-34.58, -58.42));
    await resolveMapsUrl(pin(-34.58, -58.42));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("spaces distinct Nominatim calls by at least one second", async () => {
    const started: number[] = [];
    fetchMock.mockImplementation(async () => {
      started.push(Date.now());
      return jsonResponse(nominatimBody);
    });
    const { resolveMapsUrl } = await loadModule();
    const both = Promise.all([resolveMapsUrl(pin(-34.1, -58.1)), resolveMapsUrl(pin(-34.2, -58.2))]);
    await vi.advanceTimersByTimeAsync(1_000);
    await both;
    expect(started).toHaveLength(2);
    expect(started[1] - started[0]).toBeGreaterThanOrEqual(1_000);
  });

  it("answers sin-servicio instead of queueing when the Nominatim throttle is full", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(nominatimBody));
    const { resolveMapsUrl } = await loadModule();
    // Starts at 0s, 1s, 2s and 3s fit in the 3 s wait budget; the fifth would start at 4s.
    const calls = [1, 2, 3, 4, 5].map((i) => resolveMapsUrl(pin(-34 - i / 10, -58)));
    await vi.advanceTimersByTimeAsync(5_000);
    const results = await Promise.all(calls);
    expect(results.filter((r) => r === "sin-servicio")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  // SSRF guard of the short-link redirect walk. Each case breaks exactly one rule, and every
  // later call answers like Nominatim, so following the bad hop would produce a place.
  const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });
  const redirectThenNominatim = (location: string) => {
    fetchMock.mockResolvedValueOnce(redirect(location));
    fetchMock.mockImplementation(async () => jsonResponse(nominatimBody));
  };

  it("does not follow a redirect that downgrades to http", async () => {
    redirectThenNominatim("http://maps.google.com/maps/@-34.6,-58.4,17z");
    const { resolveMapsUrl } = await loadModule();
    await expect(resolveMapsUrl("https://maps.app.goo.gl/AbCdEf123")).resolves.toBe("sin-coordenadas");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not follow a redirect to a non-Google host", async () => {
    redirectThenNominatim("https://evilgoogle.com/next");
    const { resolveMapsUrl } = await loadModule();
    await expect(resolveMapsUrl("https://maps.app.goo.gl/AbCdEf123")).resolves.toBe("sin-coordenadas");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not follow a redirect to an explicit port", async () => {
    redirectThenNominatim("https://maps.google.com:8443/next");
    const { resolveMapsUrl } = await loadModule();
    await expect(resolveMapsUrl("https://maps.app.goo.gl/AbCdEf123")).resolves.toBe("sin-coordenadas");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops after 5 redirects even when a later hop would carry coordinates", async () => {
    // The link plus 5 redirects = 6 fetches, all redirecting again; a 7th hop would reach coordinates.
    for (let i = 1; i <= 6; i++) fetchMock.mockResolvedValueOnce(redirect(`https://maps.app.goo.gl/hop${i}`));
    fetchMock.mockResolvedValueOnce(redirect("https://www.google.com/maps/@-34.6,-58.4,17z"));
    fetchMock.mockImplementation(async () => jsonResponse(nominatimBody));
    const { resolveMapsUrl } = await loadModule();
    await expect(resolveMapsUrl("https://maps.app.goo.gl/AbCdEf123")).resolves.toBe("sin-coordenadas");
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("rejects text that is not a Maps link without any outbound call", async () => {
    const { resolveMapsUrl } = await loadModule();
    await expect(resolveMapsUrl("https://evil.example/maps")).resolves.toBe("link-invalido");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
