// CSP + headers de seguridad — allowlist basado en un audit real de a qué
// dominios pega el frontend (ver decision_security_hardening en memoria):
// API propia (el backend al que apunta NEXT_PUBLIC_API_URL), uploads/imágenes de Cloudinary,
// fotos de perfil de reseñas de Google, y el iframe de Google Maps (ahora validado server-side en
// src/lib/siteConfig.ts para que no pueda ser cualquier URL). No hay scripts
// ni estilos de terceros — Google Fonts se sirve self-hosted vía next/font.
// The backend URL is required: failing the build/dev server here is better
// than silently allowing a dead host in the CSP (see src/lib/apiUrl.ts).
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
if (!API_ORIGIN) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. It must point to the backend API " +
      "(e.g. https://<backend>.onrender.com). Define it in .env.local or in the " +
      "deployment environment variables."
  );
}

const CSP_DIRECTIVES = [
  "default-src 'self'",
  // Next.js App Router inyecta el payload de hidratación de RSC vía <script>
  // inline (self.__next_f.push(...)) en cada página — sin 'unsafe-inline' acá
  // el browser los bloquea sin tirar error visible y React nunca hidrata (el
  // sitio queda 100% inerte: ni clicks ni useEffect corren). El fix correcto
  // es CSP con nonce por request vía middleware, pero requiere reescribir
  // middleware.ts (hoy solo matchea /admin/:path*) — queda para hacerlo con
  // tiempo de probarlo antes de otro apagón como este.
  "script-src 'self' 'unsafe-inline'",
  // styled-jsx (usado en BookingForms.tsx, etc.) inyecta <style> inline en
  // runtime — no hay forma de evitar 'unsafe-inline' acá sin migrar de
  // styled-jsx a otra solución de CSS-in-JS con soporte de nonce.
  "style-src 'self' 'unsafe-inline'",
  // *.googleusercontent.com: fotos de perfil de las reseñas de Google Maps
  // (`profile_photo_url` de Places, servidas desde lh3–lh6.googleusercontent.com).
  // Sin esto el <img> del autor queda roto en la sección de reseñas.
  "img-src 'self' data: https://res.cloudinary.com https://*.googleusercontent.com",
  // Sin esto, <video>/<audio> caen al fallback de default-src 'self' y
  // bloquean silenciosamente cualquier video de Cloudinary — el navegador no
  // tira error visible, el <video> simplemente nunca carga (solo se ve el
  // poster, que sí carga porque img-src ya permitía res.cloudinary.com).
  "media-src 'self' https://res.cloudinary.com",
  "font-src 'self' data:",
  `connect-src 'self' ${API_ORIGIN} https://api.cloudinary.com`,
  "frame-src https://www.google.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
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
          { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
