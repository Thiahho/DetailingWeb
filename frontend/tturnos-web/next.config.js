/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Evita que estas libs pesadas se agreguen enteras al grafo de módulos
    // de cada página que las importa: solo entra lo que realmente se usa.
    optimizePackageImports: ["react-big-calendar", "date-fns", "lucide-react"],
  },
};

export default nextConfig;
