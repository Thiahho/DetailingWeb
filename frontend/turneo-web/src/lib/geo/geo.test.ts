import { describe, expect, it } from "vitest";
import { alturaEscrita, direccionesFromPhoton, filtrarPorCalle, localidadesFromGeoref, lugarFromNominatim, parseCoords } from "@/src/lib/geo/geo";

describe("localidadesFromGeoref", () => {
  it("deduplica por nombre y partido y conserva el id de Georef", () => {
    const items = localidadesFromGeoref([
      { id: "06560010000", nombre: "Moreno", departamento: { nombre: "Moreno" }, provincia: { nombre: "Buenos Aires" }, centroide: { lat: -34.64, lon: -58.78 } },
      { id: "06560010001", nombre: "Moreno", departamento: { nombre: "Moreno" }, provincia: { nombre: "Buenos Aires" }, centroide: { lat: -34.65, lon: -58.79 } },
      { nombre: "González Moreno", departamento: { nombre: "Rivadavia" }, provincia: { nombre: "Buenos Aires" }, centroide: { lat: -35.55, lon: -63.38 } },
      { nombre: "Sin centroide", departamento: { nombre: "X" } },
    ]);
    expect(items).toEqual([
      { id: "06560010000", nombre: "Moreno", partido: "Moreno", provincia: "Buenos Aires", lat: -34.64, lng: -58.78 },
      { id: null, nombre: "González Moreno", partido: "Rivadavia", provincia: "Buenos Aires", lat: -35.55, lng: -63.38 },
    ]);
  });

  it("mantiene localidades de cualquier provincia, aunque compartan nombre y partido", () => {
    const items = localidadesFromGeoref([
      { id: "14014010000", nombre: "Córdoba", departamento: { nombre: "Capital" }, provincia: { nombre: "Córdoba" }, centroide: { lat: -31.41, lon: -64.18 } },
      { id: "06371010000", nombre: "San Martín", departamento: { nombre: "General San Martín" }, provincia: { nombre: "Buenos Aires" }, centroide: { lat: -34.57, lon: -58.53 } },
      { id: "50070010000", nombre: "San Martín", departamento: { nombre: "General San Martín" }, provincia: { nombre: "Mendoza" }, centroide: { lat: -33.08, lon: -68.47 } },
    ]);
    expect(items.map((i) => [i.nombre, i.provincia, i.id])).toEqual([
      ["Córdoba", "Córdoba", "14014010000"],
      ["San Martín", "Buenos Aires", "06371010000"],
      ["San Martín", "Mendoza", "50070010000"],
    ]);
  });
});

describe("direccionesFromPhoton", () => {
  const street = (name: string, extra: object = {}) => ({
    properties: { type: "street", name, city: "Francisco Álvarez", county: "Partido de Moreno", state: "Buenos Aires", countrycode: "AR", ...extra },
    geometry: { coordinates: [-58.8686989, -34.6047422] as [number, number] },
  });

  it("devuelve calles de la zona sin repetidos", () => {
    const items = direccionesFromPhoton([street("Agustina de Aragón"), street("Agustina de Aragón"), street("Agustina de Araoz")]);
    expect(items.map((i) => i.calle)).toEqual(["Agustina de Aragón", "Agustina de Araoz"]);
    expect(items[0]).toMatchObject({ localidad: "Francisco Álvarez", partido: "Partido de Moreno", exacta: false, lat: -34.6047422, lng: -58.8686989 });
  });

  it("descarta otros países y lo que no es calle", () => {
    const items = direccionesFromPhoton([
      street("Colonia", { countrycode: "UY", state: "Colonia" }),
      street("Plaza Mitre", { type: "locality" }),
    ]);
    expect(items).toEqual([]);
  });

  it("devuelve calles de cualquier provincia argentina", () => {
    const items = direccionesFromPhoton([
      street("Av. Colón", { city: "Córdoba", county: "Capital", state: "Córdoba" }),
      street("San Martín", { city: "Paraná", county: "Paraná", state: "Entre Ríos" }),
    ]);
    expect(items.map((i) => [i.calle, i.localidad])).toEqual([
      ["Av. Colón", "Córdoba"],
      ["San Martín", "Paraná"],
    ]);
  });

  it("marca como exactas las puertas con número", () => {
    const [item] = direccionesFromPhoton([street("", { type: "house", street: "Av. Rivadavia", housenumber: "4500", name: undefined })]);
    expect(item).toMatchObject({ calle: "Av. Rivadavia", altura: "4500", exacta: true });
  });
});

describe("filtrarPorCalle", () => {
  const item = (calle: string) => ({ calle, localidad: "", partido: "", exacta: false, lat: 0, lng: 0 });
  const items = [item("Agustina de Aragón"), item("Agustín de Elía"), item("Juan Torres de Vera y Aragón")];

  it("deja las calles que contienen lo escrito, sin contar la altura", () => {
    expect(filtrarPorCalle(items, "agustina de aragon 520").map((i) => i.calle)).toEqual(["Agustina de Aragón"]);
    expect(filtrarPorCalle(items, "arag").map((i) => i.calle)).toEqual(["Agustina de Aragón", "Juan Torres de Vera y Aragón"]);
  });

  it("no filtra si nada coincide (abreviaturas, errores de tipeo)", () => {
    expect(filtrarPorCalle(items, "gral aragon")).toEqual(items);
  });
});

describe("lugarFromNominatim", () => {
  const coords = { lat: -34.6041348, lng: -58.8696918 };

  it("arma el lugar de un punto del conurbano sin altura", () => {
    const lugar = lugarFromNominatim(
      { address: { road: "Agustina de Aragón", town: "Francisco Álvarez", state_district: "Partido de Moreno", state: "Buenos Aires", "ISO3166-2-lvl4": "AR-B" } },
      coords,
    );
    expect(lugar).toEqual({ ...coords, direccion: "Agustina de Aragón", tieneAltura: false, localidad: "Francisco Álvarez", partido: "Partido de Moreno", provincia: "Buenos Aires", enZona: true });
  });

  it("usa el barrio como localidad en CABA", () => {
    const lugar = lugarFromNominatim({ address: { road: "Thames", house_number: "1800", suburb: "Palermo", city: "Buenos Aires", "ISO3166-2-lvl4": "AR-C" } }, coords);
    expect(lugar).toMatchObject({ direccion: "Thames 1800", tieneAltura: true, localidad: "Palermo", enZona: true });
  });

  it("marca fuera de zona a otras provincias", () => {
    const lugar = lugarFromNominatim({ address: { road: "Av. Colón", city: "Córdoba", state: "Córdoba", "ISO3166-2-lvl4": "AR-X" } }, coords);
    expect(lugar).toMatchObject({ provincia: "Córdoba", enZona: false });
  });
});

describe("alturaEscrita", () => {
  it("toma el número final de lo escrito", () => {
    expect(alturaEscrita("agustina de aragon 520", "Agustina de Aragón")).toBe("520");
    expect(alturaEscrita("25 de mayo 300 ", "25 de Mayo")).toBe("300");
  });

  it("no confunde el nombre de la calle con la altura", () => {
    expect(alturaEscrita("calle 25", "Calle 25")).toBeUndefined();
    expect(alturaEscrita("agustina de ara", "Agustina de Aragón")).toBeUndefined();
  });
});

describe("parseCoords", () => {
  it("parses a valid pair", () => {
    expect(parseCoords("-34.6", "-58.8")).toEqual({ lat: -34.6, lng: -58.8 });
  });

  it("ignores missing, blank, non-numeric or out-of-range values", () => {
    expect(parseCoords(null, "-58.8")).toBeNull();
    expect(parseCoords("-34.6", null)).toBeNull();
    expect(parseCoords("", "")).toBeNull();
    expect(parseCoords("abc", "-58.8")).toBeNull();
    expect(parseCoords("-91", "-58.8")).toBeNull();
    expect(parseCoords("-34.6", "181")).toBeNull();
    expect(parseCoords("Infinity", "0")).toBeNull();
  });
});
