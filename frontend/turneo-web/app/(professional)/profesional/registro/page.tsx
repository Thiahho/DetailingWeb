"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setLoggedIn } from "@/src/lib/auth";
import PasswordInput from "@/src/components/ui/PasswordInput";
import GoogleSignInButton, { AuthDivider } from "@/src/components/professional/GoogleSignInButton";

// Alta del propio profesional, solo para correos que el admin invitó desde la
// ficha: 1) email → 2) código que llega por correo → 3) elegir contraseña.
type Step = "email" | "code" | "password";

const MIN_PASSWORD_LENGTH = 8;

const inputClass =
  "w-full rounded-xl border border-mauve/15 bg-white px-4 py-3 text-charcoal focus:border-blush outline-none transition";

async function postAuth(path: string, body: unknown) {
  const response = await fetch(`/api/auth/${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "No se pudo completar el paso. Probá de nuevo en un minuto.");
  return data;
}

export default function ProfessionalRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setError("");
    setLoading(true);
    try {
      await action();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const requestCode = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await postAuth("professional/register/request", { email: email.trim() });
      setCode("");
      setStep("code");
    });
  };

  const verifyCode = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const data = await postAuth("professional/register/verify", { email: email.trim(), otpCode: code });
      setRegistrationToken(data.registrationToken);
      setStep("password");
    });
  };

  const completeRegistration = (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    run(async () => {
      const data = await postAuth("professional/register/complete", { registrationToken, password, confirmPassword });
      setLoggedIn(data.email, data.role, data.hasPanelAccess);
      router.push("/profesional/agenda");
    });
  };

  const subtitle: Record<Step, string> = {
    email: "Ingresá el correo que el administrador cargó en tu ficha",
    code: "Si tu correo está invitado, te enviamos un código de 6 dígitos",
    password: "Último paso: elegí tu contraseña",
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-cream px-6 py-10">
      <div className="glass-card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-charcoal">Activá tu cuenta</h1>
          <p className="mt-2 text-charcoal/60">{subtitle[step]}</p>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4" data-testid="professional-register-error">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </div>
          )}

          {step === "email" && (
            <>
              <GoogleSignInButton label="Registrarme con Google" />
              <AuthDivider />
              <form onSubmit={requestCode} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-charcoal/70">Email</label>
                  <input
                    type="email"
                    data-testid="professional-register-email"
                    className={inputClass}
                    placeholder="vos@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <SubmitButton loading={loading} testId="professional-register-request">
                  Enviarme el código
                </SubmitButton>
              </form>
            </>
          )}

          {step === "code" && (
            <form onSubmit={verifyCode} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-charcoal/70">Código enviado a {email.trim()}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  data-testid="professional-register-code"
                  className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                />
                <p className="text-xs text-charcoal/50">
                  Vence en 15 minutos. Si no llega, revisá spam o confirmá con el administrador que tu correo esté cargado en tu ficha.
                </p>
              </div>
              <SubmitButton loading={loading} disabled={code.length !== 6} testId="professional-register-verify">
                Verificar código
              </SubmitButton>
              <button
                type="button"
                onClick={() => { setError(""); setStep("email"); }}
                className="w-full text-sm text-blushdark hover:text-blush transition"
              >
                Usar otro correo o pedir un código nuevo
              </button>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={completeRegistration} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-charcoal/70">Contraseña</label>
                <PasswordInput
                  className={inputClass}
                  data-testid="professional-register-password"
                  placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-charcoal/70">Repetir contraseña</label>
                <PasswordInput
                  className={inputClass}
                  data-testid="professional-register-confirm"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
              </div>
              <SubmitButton loading={loading} testId="professional-register-complete">
                Crear mi cuenta
              </SubmitButton>
            </form>
          )}

          <p className="text-center text-sm text-charcoal/60">
            ¿Ya tenés cuenta?{" "}
            <Link href="/profesional/login" className="font-medium text-blushdark hover:text-blush transition">
              Iniciá sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function SubmitButton({ loading, disabled, testId, children }: { loading: boolean; disabled?: boolean; testId: string; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      data-testid={testId}
      className="w-full rounded-full bg-blush px-6 py-4 font-semibold text-white shadow-glow transition [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02] disabled:opacity-50"
    >
      {loading ? "Procesando..." : children}
    </button>
  );
}
