// Order message sent to the business over WhatsApp (wa.me link). Orders are
// not persisted: this text is the order.
import { cartTotals, lineSubtotal, type CartItem } from "./cart";
import { formatPrice } from "./price";

export interface OrderContact {
  name: string;
  phone: string;
  address: string;
  notes: string;
}

// Free-text fields are capped so the wa.me URL stays well under the lengths
// browsers and WhatsApp handle reliably (a few thousand characters).
export const MAX_NOTES_LENGTH = 500;
export const MAX_ADDRESS_LENGTH = 200;
const MIN_PHONE_DIGITS = 6;

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${phoneDigits(phone)}?text=${encodeURIComponent(text)}`;
}

export function validateContact(contact: OrderContact): Partial<Record<"name" | "phone", string>> {
  const errors: Partial<Record<"name" | "phone", string>> = {};
  if (contact.name.trim().length < 2) errors.name = "Ingresá tu nombre";
  const digits = phoneDigits(contact.phone);
  if (digits.length === 0) errors.phone = "Ingresá tu teléfono";
  else if (digits.length < MIN_PHONE_DIGITS) errors.phone = "Ingresá un teléfono válido";
  return errors;
}

function itemLine(item: CartItem): string {
  const subtotal = lineSubtotal(item);
  const parts = [`• ${item.qty} × ${item.productName}`];
  if (item.valuesLabel) parts.push(item.valuesLabel);
  parts.push(subtotal === null ? "consultar precio" : formatPrice(subtotal));
  return parts.join(" — ");
}

export function buildOrderMessage(items: CartItem[], contact: OrderContact, businessName?: string | null): string {
  const name = businessName?.trim();
  const lines: string[] = [`¡Hola${name ? ` ${name}` : ""}! Quiero hacer el siguiente pedido:`];

  const byCategory = new Map<string, CartItem[]>();
  for (const item of items) {
    byCategory.set(item.categoryName, [...(byCategory.get(item.categoryName) ?? []), item]);
  }
  for (const [category, categoryItems] of byCategory) {
    lines.push("", `*${category}*`, ...categoryItems.map(itemLine));
  }

  const { total, pricedLines, unpricedLines } = cartTotals(items);
  if (pricedLines > 0 && unpricedLines === 0) {
    lines.push("", `*Total: ${formatPrice(total)}*`);
  } else if (pricedLines > 0) {
    lines.push("", `*Total de productos con precio: ${formatPrice(total)}*`, "Los productos sin precio los cotizamos por acá.");
  }

  lines.push("", "*Mis datos*", `Nombre: ${contact.name.trim()}`, `Teléfono: ${contact.phone.trim()}`);
  const address = contact.address.trim();
  if (address) lines.push(`Dirección: ${truncate(address, MAX_ADDRESS_LENGTH)}`);
  const notes = contact.notes.trim();
  if (notes) lines.push(`Notas: ${truncate(notes, MAX_NOTES_LENGTH)}`);

  return lines.join("\n");
}
