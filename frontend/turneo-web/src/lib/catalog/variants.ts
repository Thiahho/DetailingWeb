// Variant picker logic for the public product page: one value per attribute,
// values that cannot combine with the current choice are disabled.
import type { PublicAttribute, PublicMedia, PublicVariant } from "./publicTypes";

// attributeId → chosen valueId.
export type Selection = Record<number, number | undefined>;

function chosenIds(selection: Selection, exceptAttributeId?: number): number[] {
  return Object.entries(selection)
    .filter(([attrId, v]) => v !== undefined && Number(attrId) !== exceptAttributeId)
    .map(([, v]) => v as number);
}

// The variant matching the selection, only once every attribute is chosen.
export function findVariant(
  attributes: PublicAttribute[],
  variants: PublicVariant[],
  selection: Selection
): PublicVariant | undefined {
  if (attributes.some((a) => selection[a.id] === undefined)) return undefined;
  const ids = chosenIds(selection);
  return variants.find((v) => ids.every((id) => v.valueIds.includes(id)));
}

// A value can be picked when some variant combines it with the other chosen values.
export function isValueEnabled(variants: PublicVariant[], selection: Selection, attributeId: number, valueId: number): boolean {
  const others = chosenIds(selection, attributeId);
  return variants.some((v) => v.valueIds.includes(valueId) && others.every((id) => v.valueIds.includes(id)));
}

// Applies a choice and clears the other choices that stop being compatible.
export function selectValue(
  attributes: PublicAttribute[],
  variants: PublicVariant[],
  selection: Selection,
  attributeId: number,
  valueId: number
): Selection {
  const next: Selection = { ...selection, [attributeId]: valueId };
  for (const attr of attributes) {
    const current = next[attr.id];
    if (attr.id !== attributeId && current !== undefined && !isValueEnabled(variants, next, attr.id, current)) {
      next[attr.id] = undefined;
    }
  }
  return next;
}

// Attributes with a single possible value start selected.
export function initialSelection(attributes: PublicAttribute[]): Selection {
  return Object.fromEntries(attributes.filter((a) => a.values.length === 1).map((a) => [a.id, a.values[0].id]));
}

// "M / Rojo", in the category's attribute order (same format as the cart sync).
export function selectionLabel(attributes: PublicAttribute[], selection: Selection): string {
  return attributes
    .map((a) => a.values.find((v) => v.id === selection[a.id])?.label)
    .filter(Boolean)
    .join(" / ");
}

// Media linked to a chosen value (e.g. the red photo) goes first, followed by
// the generic media; media of other values is hidden while one matches.
export function galleryItems(media: PublicMedia[], selectedValueIds: number[]): PublicMedia[] {
  const matching = media.filter((m) => m.attributeValueId !== null && selectedValueIds.includes(m.attributeValueId));
  if (matching.length === 0) return media;
  return [...matching, ...media.filter((m) => m.attributeValueId === null)];
}
