import { describe, expect, it } from "vitest";
import { isGoogleHost, isMapsUrl, isShortMapsUrl, mapsLink, parseMapsUrl } from "@/src/lib/geo/mapsUrl";

const streetView =
  "https://www.google.com/maps/@-34.6041348,-58.8696918,32a,75y,36.19h,90t/data=!3m7!1e1!3m5!1sYpC2LPSkCliDOThs6N_qjw!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3DYpC2LPSkCliDOThs6N_qjw%26yaw%3D36.187496!7i13312!8i6656?entry=ttu&g_ep=EgoyMDI2MDkyOC4wIKXMDSoASAFQAw%3D%3D";

describe("parseMapsUrl", () => {
  it("lee el centro de la vista de un link de Street View", () => {
    expect(parseMapsUrl(streetView)).toEqual({ lat: -34.6041348, lng: -58.8696918 });
  });

  it("prefiere el pin del lugar sobre el centro de la vista", () => {
    const url = "https://www.google.com/maps/place/Obelisco/@-34.6040,-58.3830,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d-34.6037389!4d-58.3815704";
    expect(parseMapsUrl(url)).toEqual({ lat: -34.6037389, lng: -58.3815704 });
  });

  it("lee coordenadas de los parámetros y del path", () => {
    expect(parseMapsUrl("https://maps.google.com/?q=-34.65,-58.79")).toEqual({ lat: -34.65, lng: -58.79 });
    expect(parseMapsUrl("https://www.google.com/maps/search/?api=1&query=-34.65%2C-58.79")).toEqual({ lat: -34.65, lng: -58.79 });
    expect(parseMapsUrl("https://www.google.com.ar/maps/place/-34.65,-58.79")).toEqual({ lat: -34.65, lng: -58.79 });
  });

  it("devuelve null si no hay coordenadas o no es un link de Maps", () => {
    expect(parseMapsUrl("https://maps.google.com/?q=Av+Libertador+1200")).toBeNull();
    expect(parseMapsUrl("https://maps.app.goo.gl/AbCdEf123")).toBeNull();
    expect(parseMapsUrl("https://evil.example/maps/@-34.6,-58.8,17z")).toBeNull();
    expect(parseMapsUrl("https://www.google.com/search?q=-34.6,-58.8")).toBeNull();
    expect(parseMapsUrl("Agustina de Aragón 520")).toBeNull();
  });

  it("descarta coordenadas fuera de rango", () => {
    expect(parseMapsUrl("https://www.google.com/maps/@-134.6,-58.8,17z")).toBeNull();
    expect(parseMapsUrl("https://maps.google.com/?q=0,0")).toBeNull();
  });
});

describe("hosts", () => {
  it("reconoce links de Maps y links cortos", () => {
    expect(isMapsUrl(streetView)).toBe(true);
    expect(isMapsUrl("https://maps.app.goo.gl/AbCdEf123")).toBe(true);
    expect(isShortMapsUrl("https://maps.app.goo.gl/AbCdEf123")).toBe(true);
    expect(isShortMapsUrl("https://goo.gl/maps/AbCd")).toBe(true);
    expect(isShortMapsUrl("https://goo.gl/otra-cosa")).toBe(false);
    expect(isShortMapsUrl(streetView)).toBe(false);
  });

  it("rejects links with an explicit port", () => {
    expect(isMapsUrl("https://maps.google.com:8443/maps/@-34.6,-58.8,17z")).toBe(false);
    expect(isMapsUrl("https://maps.app.goo.gl:444/AbCdEf123")).toBe(false);
    expect(isShortMapsUrl("https://maps.app.goo.gl:444/AbCdEf123")).toBe(false);
    expect(parseMapsUrl("https://www.google.com:8080/maps/@-34.6,-58.8,17z")).toBeNull();
    // Default ports are normalized away by URL, so they stay valid.
    expect(isMapsUrl("https://maps.google.com:443/maps/@-34.6,-58.8,17z")).toBe(true);
  });

  it("solo sigue redirecciones hacia Google", () => {
    expect(isGoogleHost("www.google.com")).toBe(true);
    expect(isGoogleHost("maps.google.com.ar")).toBe(true);
    expect(isGoogleHost("google.com.evil.example")).toBe(false);
    expect(isGoogleHost("notgoogle.com")).toBe(false);
    expect(isGoogleHost("169.254.169.254")).toBe(false);
  });
});

describe("mapsLink", () => {
  it("arma un link al punto con 6 decimales", () => {
    expect(mapsLink({ lat: -34.6041348, lng: -58.8696918 })).toBe("https://www.google.com/maps?q=-34.604135,-58.869692");
  });
});
