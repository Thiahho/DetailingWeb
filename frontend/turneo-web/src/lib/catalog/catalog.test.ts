import { describe, expect, it } from "vitest";
import {
  AVAILABILITY_OPTIONS,
  availabilityLabel,
  mediaTypeLabel,
  toAvailability,
} from "@/src/lib/catalog/enums";
import { formatPrice, parsePriceInput, priceToInput } from "@/src/lib/catalog/price";
import {
  apiErrorMessage,
  buildCategoryPayload,
  buildProductPayload,
  buildValuePayload,
} from "@/src/lib/catalog/payloads";
import {
  attributesForCategory,
  cloudinaryPublicId,
  moveItem,
  toggleId,
  variantLabel,
} from "@/src/lib/catalog/ordering";
import type { CatalogAttribute } from "@/src/lib/catalog/types";

describe("availability enum", () => {
  it("maps the backend integers to Spanish labels", () => {
    expect(availabilityLabel(0)).toBe("Disponible");
    expect(availabilityLabel(1)).toBe("A pedido");
  });

  it("offers both options in backend order", () => {
    expect(AVAILABILITY_OPTIONS.map((o) => o.value)).toEqual([0, 1]);
  });

  it("parses select values and rejects unknown ones", () => {
    expect(toAvailability("1")).toBe(1);
    expect(toAvailability("0")).toBe(0);
    expect(toAvailability("2")).toBeNull();
    expect(toAvailability("")).toBeNull();
  });
});

describe("media type enum", () => {
  it("maps image and video", () => {
    expect(mediaTypeLabel(0)).toBe("Imagen");
    expect(mediaTypeLabel(1)).toBe("Video");
  });
});

describe("parsePriceInput", () => {
  it("treats an empty input as no price", () => {
    expect(parsePriceInput("")).toEqual({ ok: true, value: null });
    expect(parsePriceInput("   ")).toEqual({ ok: true, value: null });
  });

  it("accepts plain and decimal numbers", () => {
    expect(parsePriceInput("1500")).toEqual({ ok: true, value: 1500 });
    expect(parsePriceInput("12.5")).toEqual({ ok: true, value: 12.5 });
    expect(parsePriceInput("12,5")).toEqual({ ok: true, value: 12.5 });
  });

  it("reads Argentine thousand separators", () => {
    expect(parsePriceInput("$ 1.500")).toEqual({ ok: true, value: 1500 });
    expect(parsePriceInput("1.234.567")).toEqual({ ok: true, value: 1234567 });
    expect(parsePriceInput("1.500,75")).toEqual({ ok: true, value: 1500.75 });
  });

  it("rejects negatives and garbage", () => {
    expect(parsePriceInput("-5").ok).toBe(false);
    expect(parsePriceInput("abc").ok).toBe(false);
    expect(parsePriceInput("1,2,3").ok).toBe(false);
  });
});

describe("formatPrice / priceToInput", () => {
  it("shows the fallback label without a price", () => {
    expect(formatPrice(null)).toBe("Consultar precio");
    expect(formatPrice(undefined)).toBe("Consultar precio");
  });

  it("formats a price in es-AR", () => {
    expect(formatPrice(1500)).toBe(`$${(1500).toLocaleString("es-AR")}`);
  });

  it("round-trips the input value", () => {
    expect(priceToInput(null)).toBe("");
    expect(priceToInput(1500.5)).toBe("1500.5");
    expect(parsePriceInput(priceToInput(1500.5))).toEqual({ ok: true, value: 1500.5 });
  });
});

describe("payload builders", () => {
  it("builds the product payload with an optional price and unique value ids", () => {
    expect(
      buildProductPayload({
        categoryId: 3,
        name: "  Remera  ",
        description: " ",
        price: null,
        sortOrder: 2,
        isActive: true,
        allowedValueIds: [5, 4, 5],
      })
    ).toEqual({
      categoryId: 3,
      name: "Remera",
      description: null,
      price: null,
      sortOrder: 2,
      isActive: true,
      allowedValueIds: [4, 5],
    });
  });

  it("keeps the attribute order of a category", () => {
    expect(
      buildCategoryPayload({ name: " Ropa ", description: "", sortOrder: 0, isActive: false, attributeIds: [7, 2, 7] })
    ).toEqual({ name: "Ropa", description: null, sortOrder: 0, isActive: false, attributeIds: [7, 2] });
  });

  it("normalizes the value color", () => {
    expect(buildValuePayload({ label: " Rojo ", sortOrder: 1, colorHex: "#ff0000" })).toEqual({
      label: "Rojo",
      sortOrder: 1,
      colorHex: "#FF0000",
    });
    expect(buildValuePayload({ label: "M", sortOrder: 0, colorHex: "" }).colorHex).toBeNull();
  });
});

describe("apiErrorMessage", () => {
  it("prefers the backend message", () => {
    expect(apiErrorMessage({ success: false, message: "Ya existe" }, "x")).toBe("Ya existe");
  });

  it("reads the first ProblemDetails validation error", () => {
    expect(apiErrorMessage({ title: "One or more validation errors occurred.", errors: { Name: ["El nombre es requerido"] } }, "x")).toBe(
      "El nombre es requerido"
    );
  });

  it("falls back when there is nothing usable", () => {
    expect(apiErrorMessage({}, "No se pudo guardar")).toBe("No se pudo guardar");
    expect(apiErrorMessage(null, "No se pudo guardar")).toBe("No se pudo guardar");
  });
});

describe("ordering helpers", () => {
  it("moves an item and ignores out-of-range moves", () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(moveItem([1, 2, 3], 2, 1)).toEqual([1, 3, 2]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, 3)).toEqual([1, 2, 3]);
  });

  it("toggles an id in a list", () => {
    expect(toggleId([1, 2], 2)).toEqual([1]);
    expect(toggleId([1], 3)).toEqual([1, 3]);
  });

  const attributes: CatalogAttribute[] = [
    { id: 1, name: "Talle", slug: "talle", sortOrder: 0, values: [{ id: 10, attributeId: 1, label: "M", sortOrder: 1, colorHex: null }, { id: 11, attributeId: 1, label: "S", sortOrder: 0, colorHex: null }] },
    { id: 2, name: "Color", slug: "color", sortOrder: 1, values: [{ id: 20, attributeId: 2, label: "Rojo", sortOrder: 0, colorHex: "#FF0000" }] },
  ];

  it("returns the category attributes in combination order with sorted values", () => {
    const result = attributesForCategory([2, 1, 99], attributes);
    expect(result.map((a) => a.id)).toEqual([2, 1]);
    expect(result[1].values.map((v) => v.label)).toEqual(["S", "M"]);
  });

  it("labels a variant by its values in category order", () => {
    expect(variantLabel([10, 20], [2, 1], attributes)).toBe("Rojo / M");
    expect(variantLabel([], [2, 1], attributes)).toBe("Única");
  });
});

describe("cloudinaryPublicId", () => {
  it("extracts the public id from a delivery URL", () => {
    expect(cloudinaryPublicId("https://res.cloudinary.com/demo/image/upload/v1712/Turneo/catalogo/abc123.jpg")).toBe(
      "Turneo/catalogo/abc123"
    );
    expect(cloudinaryPublicId("https://res.cloudinary.com/demo/video/upload/w_480/v1/x/clip.mp4")).toBe("x/clip");
  });

  it("returns null for other hosts", () => {
    expect(cloudinaryPublicId("https://example.com/a.jpg")).toBeNull();
  });
});
