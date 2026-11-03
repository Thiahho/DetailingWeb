import { describe, expect, it } from "vitest";
import {
  addressFromResolvedPlace,
  buildHomeAddressPayload,
  coverageWhatsAppMessage,
  homeServicePriceBreakdown,
  isHomeAddressComplete,
  matchCoverageLocality,
  parseActiveCoverageLocalities,
  parseServicePrice,
  type ActiveCoverageLocality,
  type HomeAddressForm,
} from "@/src/lib/homeService/bookingAddress";

const localities: ActiveCoverageLocality[] = [
  { id: 1, name: "Quilmes", province: "Buenos Aires", surcharge: 1500 },
  { id: 2, name: "Bernal", province: "Buenos Aires", surcharge: null },
  { id: 3, name: "San Martín", province: "Buenos Aires", surcharge: 0 },
  { id: 4, name: "San Martín", province: "Mendoza", surcharge: 800 },
  { id: 5, name: "Palermo", province: "Ciudad Autónoma de Buenos Aires", surcharge: 2000 },
];

const form = (patch: Partial<HomeAddressForm> = {}): HomeAddressForm => ({
  coverageLocalityId: 1,
  street: "Mitre 123",
  details: "",
  notes: "",
  ...patch,
});

describe("parseActiveCoverageLocalities", () => {
  it("keeps well-formed rows and normalizes a missing surcharge to null", () => {
    expect(
      parseActiveCoverageLocalities([
        { id: 1, name: "Quilmes", province: "Buenos Aires", surcharge: 1500 },
        { id: 2, name: "Bernal", province: "Buenos Aires" },
      ])
    ).toEqual([
      { id: 1, name: "Quilmes", province: "Buenos Aires", surcharge: 1500 },
      { id: 2, name: "Bernal", province: "Buenos Aires", surcharge: null },
    ]);
  });

  it("drops malformed rows and non-array bodies", () => {
    expect(parseActiveCoverageLocalities({ message: "error" })).toEqual([]);
    expect(parseActiveCoverageLocalities([{ id: "x", name: "A" }, null, { id: 3, name: "" }])).toEqual([]);
  });
});

describe("matchCoverageLocality", () => {
  it("matches the locality ignoring accents and case", () => {
    const place = { localidad: "san martin", partido: "", provincia: "Buenos Aires" };
    expect(matchCoverageLocality(place, localities)?.id).toBe(3);
  });

  it("uses the province to pick between same-name localities", () => {
    const place = { localidad: "San Martin", partido: "", provincia: "MENDOZA" };
    expect(matchCoverageLocality(place, localities)?.id).toBe(4);
  });

  it("falls back to the partido when the locality name does not match", () => {
    const place = { localidad: "Quilmes Oeste", partido: "Quilmes", provincia: "Buenos Aires" };
    expect(matchCoverageLocality(place, localities)?.id).toBe(1);
  });

  it("prefers the locality over the partido", () => {
    const place = { localidad: "Bernal", partido: "Quilmes", provincia: "Buenos Aires" };
    expect(matchCoverageLocality(place, localities)?.id).toBe(2);
  });

  it("returns null when nothing matches or the province differs", () => {
    expect(matchCoverageLocality({ localidad: "Lanús", partido: "Lanús", provincia: "Buenos Aires" }, localities)).toBeNull();
    expect(matchCoverageLocality({ localidad: "Quilmes", partido: "", provincia: "Córdoba" }, localities)).toBeNull();
  });

  it("returns null for an ambiguous name without a province", () => {
    expect(matchCoverageLocality({ localidad: "San Martín", partido: "", provincia: "" }, localities)).toBeNull();
    expect(matchCoverageLocality({ localidad: "Bernal", partido: "", provincia: "" }, localities)?.id).toBe(2);
  });
});

describe("buildHomeAddressPayload", () => {
  it("trims fields and omits empty optional ones", () => {
    expect(buildHomeAddressPayload(form({ street: "  Mitre 123 ", details: " ", notes: "" }))).toEqual({
      ok: true,
      value: { street: "Mitre 123", coverageLocalityId: 1 },
    });
  });

  it("sends details and notes when present", () => {
    expect(buildHomeAddressPayload(form({ details: "2B", notes: "Timbre roto" }))).toEqual({
      ok: true,
      value: { street: "Mitre 123", details: "2B", notes: "Timbre roto", coverageLocalityId: 1 },
    });
  });

  it("requires a locality and a street", () => {
    expect(buildHomeAddressPayload(form({ coverageLocalityId: null }))).toEqual({
      ok: false,
      message: "Elegí la localidad del servicio a domicilio",
    });
    expect(buildHomeAddressPayload(form({ street: "   " }))).toEqual({
      ok: false,
      message: "Ingresá la dirección (calle y número) para el servicio a domicilio",
    });
  });

  it("rejects fields over the backend limits", () => {
    const tooLong = { ok: false, message: "La dirección supera el largo permitido" };
    expect(buildHomeAddressPayload(form({ street: "a".repeat(201) }))).toEqual(tooLong);
    expect(buildHomeAddressPayload(form({ details: "a".repeat(101) }))).toEqual(tooLong);
    expect(buildHomeAddressPayload(form({ notes: "a".repeat(501) }))).toEqual(tooLong);
    expect(buildHomeAddressPayload(form({ street: "a".repeat(200), details: "b".repeat(100), notes: "c".repeat(500) })).ok).toBe(true);
  });

  it("isHomeAddressComplete mirrors the payload validation", () => {
    expect(isHomeAddressComplete(form())).toBe(true);
    expect(isHomeAddressComplete(form({ coverageLocalityId: null }))).toBe(false);
    expect(isHomeAddressComplete(form({ street: "" }))).toBe(false);
  });
});

describe("parseServicePrice", () => {
  it("parses plain and Argentine-formatted prices like the backend", () => {
    expect(parseServicePrice("15000")).toBe(15000);
    expect(parseServicePrice("15.000")).toBe(15000);
    expect(parseServicePrice("$ 12.345,50")).toBe(12345.5);
  });

  it("returns null for free text, zero or empty", () => {
    expect(parseServicePrice("Consultar")).toBeNull();
    expect(parseServicePrice("0")).toBeNull();
    expect(parseServicePrice("")).toBeNull();
    expect(parseServicePrice(undefined)).toBeNull();
  });
});

describe("homeServicePriceBreakdown", () => {
  it("adds the surcharge to the service price", () => {
    expect(homeServicePriceBreakdown({ servicePrice: "15.000", promotionPrice: null, surcharge: 1500 })).toEqual({
      base: 15000,
      surcharge: 1500,
      total: 16500,
    });
  });

  it("uses the promotion price when there is one", () => {
    expect(homeServicePriceBreakdown({ servicePrice: "15000", promotionPrice: 12000, surcharge: 1500 }).total).toBe(13500);
  });

  it("treats a missing surcharge as zero", () => {
    expect(homeServicePriceBreakdown({ servicePrice: "15000", promotionPrice: null, surcharge: null })).toEqual({
      base: 15000,
      surcharge: 0,
      total: 15000,
    });
  });

  it("has no total when the base price is not a number", () => {
    expect(homeServicePriceBreakdown({ servicePrice: "Consultar", promotionPrice: null, surcharge: 500 })).toEqual({
      base: null,
      surcharge: 500,
      total: null,
    });
  });
});

describe("coverageWhatsAppMessage", () => {
  it("includes the service, the address and the locality", () => {
    expect(coverageWhatsAppMessage({ serviceTitle: "Lavado premium", street: "Mitre 123", locality: "Lanús" })).toBe(
      "Hola, quiero consultar si pueden hacer el servicio \"Lavado premium\" a domicilio en Mitre 123, Lanús. Mi zona no figura en la lista de cobertura."
    );
  });

  it("skips the parts that are missing", () => {
    expect(coverageWhatsAppMessage({ serviceTitle: "Lavado", street: " ", locality: "" })).toBe(
      "Hola, quiero consultar si pueden hacer el servicio \"Lavado\" a domicilio. Mi zona no figura en la lista de cobertura."
    );
  });
});

describe("addressFromResolvedPlace", () => {
  const place = { direccion: "Mitre 456", localidad: "Bernal", partido: "Quilmes", provincia: "Buenos Aires" };

  it("fills the street and the matching coverage locality, keeping the other fields", () => {
    const prev = form({ coverageLocalityId: null, street: "", details: "2B", notes: "Timbre" });
    expect(addressFromResolvedPlace(prev, place, localities)).toEqual({
      address: { coverageLocalityId: 2, street: "Mitre 456", details: "2B", notes: "Timbre" },
      outsideName: null,
    });
  });

  it("keeps the current street when the place has no address", () => {
    const prev = form({ street: "Typed while loading 99" });
    expect(addressFromResolvedPlace(prev, { ...place, direccion: "" }, localities).address.street).toBe(
      "Typed while loading 99"
    );
  });

  it("clears the locality and names the place when it is out of coverage", () => {
    const outside = { direccion: "Hipólito Yrigoyen 1", localidad: "Lanús Oeste", partido: "Lanús", provincia: "Buenos Aires" };
    expect(addressFromResolvedPlace(form(), outside, localities)).toEqual({
      address: { ...form(), coverageLocalityId: null, street: "Hipólito Yrigoyen 1" },
      outsideName: "Lanús Oeste",
    });
    expect(addressFromResolvedPlace(form(), { ...outside, localidad: "", partido: "" }, localities).outsideName).toBe(
      "esa zona"
    );
  });
});
