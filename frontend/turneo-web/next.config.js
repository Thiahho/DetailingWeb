// Report-Only: no bloquea nada, solo reporta violaciones en la consola del
// navegador (DevTools > Console/Network). Objetivo de esta fase: confirmar
// contra el flujo real (reserva + pago con MercadoPago + mapa embebido) que
// la lista de orígenes de abajo está completa, antes de pasar a
// Content-Security-Policy real (que si bloquea). 'unsafe-inline' en
// script-src/style-src es necesario hoy porque Next.js App Router inyecta
// scripts de hidratación inline y React compila estilos inline a atributos
// style — pasar a nonces es una mejora futura, no parte de esta fase.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com https://http2.mlstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "font-src 'self' data:",
  "frame-src https://www.google.com https://www.mercadopago.com https://www.mercadopago.com.ar https://www.mercadolibre.com",
  "connect-src 'self' https://sdk.mercadopago.com https://api.mercadopago.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.mercadopago.com https://www.mercadopago.com.ar",
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Evita que estas libs pesadas se agreguen enteras al grafo de módulos
    // de cada página que las importa: solo entra lo que realmente se usa.
    optimizePackageImports: ["react-big-calendar", "date-fns", "lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
        ],
      },
    ];
  },
};

export default nextConfig;
