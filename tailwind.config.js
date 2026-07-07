/** @type {import('tailwindcss').Config} */
export default {
  // Agregamos la ruta ./src para que reconozca el Navbar y otros componentes
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base — cálidos, no grises fríos. Cream más profundo que ivory
        // a propósito: las cards (ivory/white) necesitan contraste real
        // contra el fondo de página, no un tono casi idéntico.
        cream: "#F5EBE5",
        ivory: "#FFFFFF",
        porcelain: "#EFE1D9",
        // Principal — rosa empolvado (CTAs, focus, acentos activos)
        blush: "#D69AA6",
        blushdark: "#C07E8C",
        // Secundarios
        mauve: "#9C7C88",
        lavender: "#C9BFE0",
        champagne: "#C6A26E",
        warmgray: "#8A7A7E",
        // Texto principal — marrón muy oscuro, no negro puro
        charcoal: "#2E2328",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(214, 154, 166, 0.25)",
        gold: "0 0 30px rgba(198, 162, 110, 0.2)",
        soft: "0 1px 2px rgba(46, 35, 40, 0.05), 0 6px 20px rgba(46, 35, 40, 0.09)",
        elevated: "0 8px 24px rgba(46, 35, 40, 0.10), 0 2px 6px rgba(46, 35, 40, 0.06)",
      },
    },
  },
  plugins: [],
};
