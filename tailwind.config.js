/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: "#0f1115",
        steel: "#161a21",
        midnight: "#0b0d12",
        lux: "#d6b46a",
        electric: "#5b8dff"
      },
      boxShadow: {
        glow: "0 0 30px rgba(91, 141, 255, 0.35)",
        gold: "0 0 30px rgba(214, 180, 106, 0.25)"
      }
    }
  },
  plugins: []
};
