import { describe, expect, it } from "vitest";
import {
  CART_TTL_MS,
  MAX_QTY,
  addItem,
  applyVariants,
  cartStorageKey,
  cartTotals,
  clampQty,
  deserializeCart,
  removeItem,
  serializeCart,
  setItemQty,
  totalUnits,
  type CartItem,
} from "@/src/lib/catalog/cart";
import {
  MAX_ADDRESS_LENGTH,
  MAX_NOTES_LENGTH,
  buildOrderMessage,
  phoneDigits,
  truncate,
  validateContact,
  whatsappUrl,
} from "@/src/lib/catalog/whatsapp";
import {
  findVariant,
  galleryItems,
  initialSelection,
  isValueEnabled,
  selectValue,
  selectionLabel,
} from "@/src/lib/catalog/variants";
import type { PublicAttribute, PublicMedia, PublicVariant, PublicVariantStatus } from "@/src/lib/catalog/publicTypes";

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    variantId: 1,
    productSlug: "remera",
    productName: "Remera",
    categoryName: "Ropa",
    valuesLabel: "M / Rojo",
    availability: 0,
    price: 1500,
    imageUrl: null,
    qty: 1,
    ...overrides,
  };
}

function status(overrides: Partial<PublicVariantStatus> = {}): PublicVariantStatus {
  return {
    id: 1,
    sku: "P1-1-2",
    availability: 0,
    productSlug: "remera",
    productName: "Remera",
    price: 1500,
    categoryName: "Ropa",
    values: ["M", "Rojo"],
    ...overrides,
  };
}

describe("cart reducers", () => {
  it("adds a new line with a clamped quantity", () => {
    const items = addItem([], item({ qty: 0 }), 3);
    expect(items).toHaveLength(1);
    expect(items[0].qty).toBe(3);
  });

  it("merges the same variant and refreshes its data", () => {
    const first = addItem([], item(), 2);
    const merged = addItem(first, item({ productName: "Remera lisa", price: 2000 }), 3);
    expect(merged).toHaveLength(1);
    expect(merged[0].qty).toBe(5);
    expect(merged[0].productName).toBe("Remera lisa");
    expect(merged[0].price).toBe(2000);
  });

  it("keeps different variants as separate lines", () => {
    const items = addItem(addItem([], item(), 1), item({ variantId: 2 }), 1);
    expect(items.map((i) => i.variantId)).toEqual([1, 2]);
  });

  it("clamps quantities between 1 and MAX_QTY", () => {
    expect(clampQty(0)).toBe(1);
    expect(clampQty(-5)).toBe(1);
    expect(clampQty(Number.NaN)).toBe(1);
    expect(clampQty(2.7)).toBe(2);
    expect(clampQty(MAX_QTY + 10)).toBe(MAX_QTY);
    expect(addItem([item({ qty: MAX_QTY })], item(), 5)[0].qty).toBe(MAX_QTY);
    expect(setItemQty([item()], 1, 0)[0].qty).toBe(1);
    expect(setItemQty([item()], 1, 7)[0].qty).toBe(7);
  });

  it("removes a line", () => {
    const items = removeItem([item(), item({ variantId: 2 })], 1);
    expect(items.map((i) => i.variantId)).toEqual([2]);
  });

  it("counts units and sums only priced lines", () => {
    const items = [item({ qty: 2, price: 1000 }), item({ variantId: 2, qty: 3, price: null })];
    expect(totalUnits(items)).toBe(5);
    expect(cartTotals(items)).toEqual({ total: 2000, pricedLines: 1, unpricedLines: 1 });
  });
});

describe("cart persistence", () => {
  it("uses one storage key per tenant host", () => {
    expect(cartStorageKey("demo.turneo.app")).toBe("turneo-cart:demo.turneo.app");
    expect(cartStorageKey("otro.turneo.app")).not.toBe(cartStorageKey("demo.turneo.app"));
  });

  it("round-trips a fresh cart", () => {
    const raw = serializeCart([item({ qty: 4 })], 1000);
    expect(deserializeCart(raw, 1000 + 60_000)).toEqual([item({ qty: 4 })]);
  });

  it("drops an expired cart", () => {
    const raw = serializeCart([item()], 1000);
    expect(deserializeCart(raw, 1000 + CART_TTL_MS + 1)).toEqual([]);
  });

  it("ignores missing, malformed or foreign data", () => {
    expect(deserializeCart(null, 0)).toEqual([]);
    expect(deserializeCart("not json", 0)).toEqual([]);
    expect(deserializeCart(JSON.stringify({ savedAt: 0, items: "x" }), 0)).toEqual([]);
    const mixed = JSON.stringify({ savedAt: 10, items: [item(), { variantId: "x" }, null] });
    expect(deserializeCart(mixed, 20)).toEqual([item()]);
  });
});

describe("cart sync against variants by ids", () => {
  it("drops inactive or unknown variants and refreshes names and prices", () => {
    const items = [item({ variantId: 1, qty: 2 }), item({ variantId: 2 })];
    const synced = applyVariants(items, [
      status({ id: 1, productName: "Remera nueva", price: null, availability: 1, values: ["L", "Azul"] }),
    ]);
    expect(synced).toEqual([
      item({ variantId: 1, qty: 2, productName: "Remera nueva", price: null, availability: 1, valuesLabel: "L / Azul" }),
    ]);
  });

  it("returns an empty cart when nothing is active anymore", () => {
    expect(applyVariants([item()], [])).toEqual([]);
  });
});

describe("whatsapp order message", () => {
  const contact = { name: "Ana Pérez", phone: "11 5555-1234", address: "", notes: "" };

  it("greets the business and lists priced items grouped by category with a total", () => {
    const text = buildOrderMessage(
      [
        item({ variantId: 1, qty: 2, price: 1500 }),
        item({ variantId: 2, productName: "Gorra", categoryName: "Accesorios", valuesLabel: "", price: 800 }),
        item({ variantId: 3, productName: "Buzo", valuesLabel: "L", qty: 1, price: 4000 }),
      ],
      contact,
      "Tienda Sol"
    );
    expect(text).toBe(
      [
        "¡Hola Tienda Sol! Quiero hacer el siguiente pedido:",
        "",
        "*Ropa*",
        "• 2 × Remera — M / Rojo — $3.000",
        "• 1 × Buzo — L — $4.000",
        "",
        "*Accesorios*",
        "• 1 × Gorra — $800",
        "",
        "*Total: $7.800*",
        "",
        "*Mis datos*",
        "Nombre: Ana Pérez",
        "Teléfono: 11 5555-1234",
      ].join("\n")
    );
  });

  it("says 'consultar precio' and omits the total when no item has a price", () => {
    const text = buildOrderMessage([item({ price: null, qty: 3 })], contact);
    expect(text.startsWith("¡Hola! Quiero hacer el siguiente pedido:")).toBe(true);
    expect(text).toContain("• 3 × Remera — M / Rojo — consultar precio");
    expect(text).not.toContain("Total");
  });

  it("labels the total as partial when prices are mixed", () => {
    const text = buildOrderMessage([item({ price: 1000 }), item({ variantId: 2, price: null })], contact);
    expect(text).toContain("*Total de productos con precio: $1.000*");
    expect(text).toContain("Los productos sin precio los cotizamos por acá.");
  });

  it("adds address and notes only when present", () => {
    const withExtras = buildOrderMessage([item()], { ...contact, address: "Calle 123", notes: "Para regalo" });
    expect(withExtras).toContain("Dirección: Calle 123");
    expect(withExtras).toContain("Notas: Para regalo");
    const without = buildOrderMessage([item()], { ...contact, address: "   ", notes: "" });
    expect(without).not.toContain("Dirección");
    expect(without).not.toContain("Notas");
  });

  it("truncates long notes and addresses", () => {
    const longNotes = "a".repeat(MAX_NOTES_LENGTH + 100);
    const text = buildOrderMessage([item()], { ...contact, notes: longNotes, address: "b".repeat(MAX_ADDRESS_LENGTH + 5) });
    const notesLine = text.split("\n").find((l) => l.startsWith("Notas: "))!;
    expect(notesLine.length).toBe("Notas: ".length + MAX_NOTES_LENGTH);
    expect(notesLine.endsWith("…")).toBe(true);
    const addressLine = text.split("\n").find((l) => l.startsWith("Dirección: "))!;
    expect(addressLine.length).toBe("Dirección: ".length + MAX_ADDRESS_LENGTH);
    expect(truncate("corto", 10)).toBe("corto");
  });

  it("keeps a typical order URL under practical limits", () => {
    const items = Array.from({ length: 10 }, (_, i) => item({ variantId: i + 1, productName: `Producto ${i + 1}` }));
    const url = whatsappUrl("+54 9 11 5555-1234", buildOrderMessage(items, { ...contact, notes: "x".repeat(5000) }));
    expect(url.length).toBeLessThan(4000);
  });

  it("builds the wa.me URL with digits only and an encoded text", () => {
    expect(phoneDigits("+54 9 (11) 5555-1234")).toBe("5491155551234");
    expect(whatsappUrl("+54 9 11 5555-1234", "Hola & chau\n• 1 × Remera")).toBe(
      "https://wa.me/5491155551234?text=Hola%20%26%20chau%0A%E2%80%A2%201%20%C3%97%20Remera"
    );
  });
});

describe("order contact validation", () => {
  it("requires a name and a phone with enough digits", () => {
    expect(validateContact({ name: "", phone: "", address: "", notes: "" })).toEqual({
      name: "Ingresá tu nombre",
      phone: "Ingresá tu teléfono",
    });
    expect(validateContact({ name: "A", phone: "12-34", address: "", notes: "" })).toEqual({
      name: "Ingresá tu nombre",
      phone: "Ingresá un teléfono válido",
    });
    expect(validateContact({ name: "Ana", phone: "11 5555-1234", address: "", notes: "" })).toEqual({});
  });
});

describe("variant picker", () => {
  const attributes: PublicAttribute[] = [
    {
      id: 10,
      name: "Talle",
      slug: "talle",
      values: [
        { id: 1, label: "S", colorHex: null, sortOrder: 0 },
        { id: 2, label: "M", colorHex: null, sortOrder: 1 },
      ],
    },
    {
      id: 20,
      name: "Color",
      slug: "color",
      values: [
        { id: 3, label: "Rojo", colorHex: "#FF0000", sortOrder: 0 },
        { id: 4, label: "Azul", colorHex: "#0000FF", sortOrder: 1 },
      ],
    },
  ];
  // S/Azul does not exist.
  const variants: PublicVariant[] = [
    { id: 100, sku: "a", valueIds: [1, 3], availability: 0 },
    { id: 101, sku: "b", valueIds: [2, 3], availability: 1 },
    { id: 102, sku: "c", valueIds: [2, 4], availability: 0 },
  ];

  it("finds a variant only when every attribute is chosen", () => {
    expect(findVariant(attributes, variants, { 10: 2 })).toBeUndefined();
    expect(findVariant(attributes, variants, { 10: 2, 20: 3 })?.id).toBe(101);
  });

  it("finds the single variant of a product without attributes", () => {
    expect(findVariant([], [{ id: 5, sku: "P5", valueIds: [], availability: 0 }], {})?.id).toBe(5);
  });

  it("disables values that do not combine with the current choice", () => {
    expect(isValueEnabled(variants, { 10: 1 }, 20, 4)).toBe(false);
    expect(isValueEnabled(variants, { 10: 2 }, 20, 4)).toBe(true);
  });

  it("clears incompatible choices when another value is picked", () => {
    expect(selectValue(attributes, variants, { 10: 2, 20: 4 }, 10, 1)).toEqual({ 10: 1, 20: undefined });
  });

  it("preselects attributes with a single value and labels the selection in order", () => {
    const single: PublicAttribute[] = [{ ...attributes[0], values: [attributes[0].values[1]] }, attributes[1]];
    expect(initialSelection(single)).toEqual({ 10: 2 });
    expect(selectionLabel(attributes, { 20: 3, 10: 2 })).toBe("M / Rojo");
  });

  it("puts the photos of the chosen values first", () => {
    const media: PublicMedia[] = [
      { id: 1, url: "https://x/a.jpg", type: 0, attributeValueId: null },
      { id: 2, url: "https://x/rojo.jpg", type: 0, attributeValueId: 3 },
      { id: 3, url: "https://x/azul.jpg", type: 0, attributeValueId: 4 },
    ];
    expect(galleryItems(media, [4]).map((m) => m.id)).toEqual([3, 1]);
    expect(galleryItems(media, []).map((m) => m.id)).toEqual([1, 2, 3]);
  });
});
