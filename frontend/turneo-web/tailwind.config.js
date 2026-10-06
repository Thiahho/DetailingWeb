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
        // Rediseño de /reservar: secciones oscuras (ciruela casi negro) que
        // alternan con las crema. mist = texto secundario sobre ink;
        // rosewood = acento de texto sobre fondos claros (blush no llega a
        // contraste AA como texto chico).
        ink: "#2A2025",
        inksoft: "#33272D",
        mist: "#CDBFC4",
        rosewood: "#8F4C5D",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        // Solo como acento itálico en títulos (ver .accent-serif en globals.css)
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
      },
      keyframes: {
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        floaty: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-14px)" } },
        rise: { from: { opacity: "0", transform: "translateY(28px)" }, to: { opacity: "1", transform: "none" } },
        // Halo que late alrededor de un botón. Con box-shadow y no con un
        // elemento escalado (animate-ping): la sombra no agranda el área
        // desplazable, así que no provoca scroll horizontal en celular.
        halo: {
          "0%": { boxShadow: "0 0 0 0 rgba(214, 154, 166, 0.6)" },
          "70%, 100%": { boxShadow: "0 0 0 14px rgba(214, 154, 166, 0)" },
        },
        pane: { from: { opacity: "0", transform: "translateX(18px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        marquee: "marquee 46s linear infinite",
        floaty: "floaty 7s ease-in-out infinite",
        rise: "rise .9s cubic-bezier(.2,.7,.2,1) both",
        halo: "halo 2.4s ease-out infinite",
        pane: "pane .5s cubic-bezier(.2,.7,.2,1) both",
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
