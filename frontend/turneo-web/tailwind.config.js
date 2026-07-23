/** @type {import('tailwindcss').Config} */
export default {
  // Agregamos la ruta ./src para que reconozca el Navbar y otros componentes
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base — oscuros, urbanos. Ink es el fondo de página; ivory
        // (superficie de cards) queda apenas más clara para dar
        // sensación de elevación real, no un tono casi idéntico.
        cream: "#0E0E10",
        ivory: "#19191C",
        porcelain: "#232326",
        // Principal — bronce/cuero (CTAs, focus, acentos activos)
        blush: "#B9853B",
        blushdark: "#8F6427",
        // Secundarios
        mauve: "#3A3A3F",
        lavender: "#6E6E73",
        champagne: "#9C2B2B",
        warmgray: "#8A8A8F",
        // Texto principal — hueso cálido, no blanco puro
        charcoal: "#EDEAE3",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(185, 133, 59, 0.25)",
        gold: "0 0 30px rgba(156, 43, 43, 0.2)",
        soft: "0 1px 2px rgba(0, 0, 0, 0.3), 0 6px 20px rgba(0, 0, 0, 0.35)",
        elevated: "0 8px 24px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3)",
      },
    },
  },
  plugins: [],
};
