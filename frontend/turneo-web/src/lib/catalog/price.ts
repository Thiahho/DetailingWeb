// The product price is optional: empty means the public catalog shows
// "Consultar precio" and the WhatsApp order carries no amount.

export const NO_PRICE_LABEL = "Consultar precio";

export type PriceParse = { ok: true; value: number | null } | { ok: false };

// Accepts "1500", "12.5", "12,5", "$ 1.500", "1.500,75". With only dots, a
// dot followed by exactly three digits in every group is a thousand separator
// (Argentine usage); otherwise it is the decimal point.
export function parsePriceInput(raw: string): PriceParse {
  const text = raw.replace(/[\s$]/g, "");
  if (text === "") return { ok: true, value: null };
  if (!/^[0-9.,]+$/.test(text)) return { ok: false };

  let normalized: string;
  const commas = text.split(",").length - 1;
  if (commas > 1) return { ok: false };

  if (commas === 1) {
    // "1.500,75": dots are thousands, the comma is the decimal separator.
    const [intPart, decPart] = text.split(",");
    if (intPart.includes(".") && !isThousandsGrouped(intPart)) return { ok: false };
    normalized = `${intPart.replace(/\./g, "")}.${decPart}`;
  } else if (text.includes(".")) {
    normalized = isThousandsGrouped(text) ? text.replace(/\./g, "") : text;
  } else {
    normalized = text;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return { ok: false };
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? { ok: true, value } : { ok: false };
}

function isThousandsGrouped(text: string): boolean {
  return /^\d{1,3}(\.\d{3})+$/.test(text);
}

export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return NO_PRICE_LABEL;
  return `$${price.toLocaleString("es-AR")}`;
}

// Value for the form input: plain number with a dot, empty when there is no price.
export function priceToInput(price: number | null | undefined): string {
  return price === null || price === undefined ? "" : String(price);
}
