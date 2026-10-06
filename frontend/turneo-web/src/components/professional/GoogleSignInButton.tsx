// Solo se muestra si el login con Google está configurado en este deploy
// (ver GOOGLE_* en .env.example). Es un link, no un fetch: el flujo es por
// redirección completa a Google y vuelta (app/api/auth/google/*).
export const GOOGLE_AUTH_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

export default function GoogleSignInButton({ label = "Continuar con Google" }: { label?: string }) {
  if (!GOOGLE_AUTH_ENABLED) return null;

  return (
    <a
      href="/api/auth/google/start"
      data-testid="professional-google-button"
      className="flex w-full items-center justify-center gap-3 rounded-full border border-mauve/15 bg-white px-6 py-3.5 font-semibold text-charcoal transition hover:bg-porcelain"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.36c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.29 9.14 5.36 12 5.36z" />
      </svg>
      {label}
    </a>
  );
}

export function AuthDivider() {
  if (!GOOGLE_AUTH_ENABLED) return null;

  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-charcoal/40">
      <span className="h-px flex-1 bg-mauve/15" />
      o
      <span className="h-px flex-1 bg-mauve/15" />
    </div>
  );
}
