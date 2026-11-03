// Shared classes of the /reservar booking wizard (dark section).
export const OPTION = "rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98]";
export const OPTION_ON = "border-blush bg-blush text-ink";
export const OPTION_OFF = "border-cream/20 text-cream hover:border-cream/45";
export const FIELD =
  "mt-2 w-full rounded-2xl border border-cream/20 bg-ink px-4 py-3.5 text-base text-cream placeholder:text-mist/50 focus:border-blush focus:outline-none focus:ring-1 focus:ring-blush/40";
export const FIELD_LABEL = "block text-xs font-semibold text-mist";

// Address step themes: "dark" for the /reservar wizard, "light" for the Smart
// Tag single-screen form (glass card on cream, `form-input` fields).
export type AddressTone = "dark" | "light";

export const ADDRESS_THEMES: Record<
  AddressTone,
  {
    field: string;
    label: string;
    muted: string;
    panel: string;
    notice: string;
    secondaryButton: string;
    primaryButton: string;
    list: string;
    listItem: string;
    alert: string;
    icon: string;
  }
> = {
  dark: {
    field: FIELD,
    label: FIELD_LABEL,
    muted: "text-mist",
    panel: "rounded-2xl border border-cream/15 px-4 py-4",
    notice: "rounded-2xl border border-blush/50 bg-blush/10 px-4 py-4 text-cream",
    secondaryButton: "rounded-2xl border border-cream/30 text-cream hover:border-cream/60",
    primaryButton: "bg-blush text-ink",
    list: "rounded-2xl border border-cream/20 bg-ink",
    listItem: "text-cream hover:bg-cream/10",
    alert: "text-blush",
    icon: "text-mist/60",
  },
  light: {
    field: "form-input mt-2",
    label: "block text-xs uppercase tracking-[0.2em] text-charcoal/50",
    muted: "text-charcoal/60",
    panel: "rounded-xl border border-mauve/15 bg-white px-4 py-4",
    notice: "rounded-xl border border-blush/40 bg-blush/10 px-4 py-4 text-charcoal",
    secondaryButton: "rounded-xl border border-mauve/30 text-charcoal hover:border-mauve/50",
    primaryButton: "bg-blush text-white",
    list: "rounded-xl border border-mauve/15 bg-ivory",
    listItem: "text-charcoal hover:bg-blush/10",
    alert: "text-red-600",
    icon: "text-charcoal/40",
  },
};
