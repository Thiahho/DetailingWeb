"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth, isProfessionalAuthenticated, getRole } from "@/src/lib/auth";
import { Button } from "@/src/components/shared/Button";

type MessageType = "success" | "error";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim();

export default function ProfesionalCuentaPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isProfessionalAuthenticated()) {
      router.push(getRole() === "Admin" ? "/admin/turnos" : "/profesional/login");
    }
  }, [router]);

  // ── Mis datos (nombre, especialidad, email de acceso) ──
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", specialty: "", email: "" });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileMessageType, setProfileMessageType] = useState<MessageType>("success");

  useEffect(() => {
    Promise.all([
      fetchWithAuth("/api/professionals/me").then((r) => r.json()),
      fetchWithAuth("/api/auth/me").then((r) => r.json()),
    ])
      .then(([profile, account]) => {
        setProfileForm({
          firstName: profile.firstName ?? "",
          lastName: profile.lastName ?? "",
          specialty: profile.specialty ?? "",
          email: account.email ?? "",
        });
      })
      .finally(() => setLoadingProfile(false));
  }, []);

  const handleProfileSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage("");

    try {
      const [profileRes, emailRes] = await Promise.all([
        fetchWithAuth("/api/professionals/me", {
          method: "PUT",
          body: JSON.stringify({
            firstName: profileForm.firstName.trim(),
            lastName: profileForm.lastName.trim(),
            specialty: profileForm.specialty.trim() || null,
          }),
        }),
        fetchWithAuth("/api/auth/me", {
          method: "PUT",
          body: JSON.stringify({ email: profileForm.email.trim() }),
        }),
      ]);

      const [profileData, emailData] = await Promise.all([profileRes.json(), emailRes.json()]);

      if (profileRes.ok && emailRes.ok) {
        setProfileMessageType("success");
        setProfileMessage("Datos actualizados.");
        return;
      }

      setProfileMessageType("error");
      setProfileMessage(!profileRes.ok ? profileData.message : emailData.message || "No se pudo guardar. Intentá nuevamente.");
    } catch {
      setProfileMessageType("error");
      setProfileMessage("Error de conexión. Intentá nuevamente.");
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Chat ID de Telegram ──
  const [telegramChatId, setTelegramChatId] = useState("");
  const [loadingTelegram, setLoadingTelegram] = useState(true);
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState("");
  const [telegramMessageType, setTelegramMessageType] = useState<MessageType>("success");

  useEffect(() => {
    fetchWithAuth("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setTelegramChatId(data.telegramChatId ?? ""))
      .finally(() => setLoadingTelegram(false));
  }, []);

  const handleTelegramSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingTelegram(true);
    setTelegramMessage("");

    try {
      const response = await fetchWithAuth("/api/auth/telegram-chat-id", {
        method: "POST",
        body: JSON.stringify({ telegramChatId: telegramChatId.trim() || null }),
      });

      const data = await response.json();

      if (response.ok) {
        setTelegramMessageType("success");
        setTelegramMessage(telegramChatId.trim() ? "Listo, ya vas a recibir avisos por Telegram." : "Avisos por Telegram desactivados.");
        return;
      }

      setTelegramMessageType("error");
      setTelegramMessage(data.message || "No se pudo guardar. Intentá nuevamente.");
    } catch {
      setTelegramMessageType("error");
      setTelegramMessage("Error de conexión. Intentá nuevamente.");
    } finally {
      setSavingTelegram(false);
    }
  };

  return (
    <div className="p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Mi cuenta</h1>
          <p className="text-charcoal/50 text-sm mt-1">Tus datos y cómo te avisamos cuando te asignan un turno</p>
        </div>

        {/* Mis datos */}
        <div className="bg-ivory border border-mauve/5 rounded-2xl p-5 md:p-6 mb-4">
          <p className="text-charcoal/70 text-sm font-medium mb-4">Mis datos</p>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {profileMessage && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  profileMessageType === "success"
                    ? "bg-green-500/10 border-green-500/20 text-green-400"
                    : "bg-red-500/10 border-red-500/20 text-red-600"
                }`}
              >
                {profileMessage}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm text-charcoal/70">Nombre</label>
                <input
                  className="form-input"
                  placeholder={loadingProfile ? "Cargando..." : "Nombre"}
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  disabled={loadingProfile}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-charcoal/70">Apellido</label>
                <input
                  className="form-input"
                  placeholder={loadingProfile ? "Cargando..." : "Apellido"}
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  disabled={loadingProfile}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-charcoal/70">Especialidad</label>
              <input
                className="form-input"
                placeholder={loadingProfile ? "Cargando..." : "Ej: Fade, barba, color"}
                value={profileForm.specialty}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, specialty: e.target.value }))}
                disabled={loadingProfile}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-charcoal/70">Email de acceso</label>
              <input
                type="email"
                className="form-input"
                placeholder={loadingProfile ? "Cargando..." : "tu@email.com"}
                value={profileForm.email}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                disabled={loadingProfile}
                required
              />
              <p className="text-charcoal/40 text-xs">Es el email con el que iniciás sesión. Si lo cambiás, la próxima vez usalo para entrar.</p>
            </div>

            <Button
              type="submit"
              disabled={savingProfile || loadingProfile}
              variant="primary"
              shape="pill"
              className="w-full"
            >
              {savingProfile ? "Guardando..." : "Guardar datos"}
            </Button>
          </form>
        </div>

        {/* Telegram */}
        <div className="bg-ivory border border-mauve/5 rounded-2xl p-5 md:p-6 mb-4">
          <p className="text-charcoal/70 text-sm font-medium mb-1">Avisos por Telegram</p>
          <p className="text-charcoal/50 text-xs mb-3">Recibí un mensaje cada vez que te asignen un turno nuevo</p>
          <ol className="text-charcoal/60 text-sm space-y-2 list-decimal list-inside">
            <li>
              Abrí{" "}
              {BOT_USERNAME ? (
                <a
                  href={`https://t.me/${BOT_USERNAME}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blush hover:text-blushdark font-medium underline"
                >
                  nuestro bot de Telegram
                </a>
              ) : (
                "el bot de Telegram del negocio"
              )}{" "}
              y tocá &ldquo;Iniciar&rdquo; (o mandale cualquier mensaje). Sin este paso el bot no te puede escribir.
            </li>
            <li>
              Buscá{" "}
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blush hover:text-blushdark font-medium underline"
              >
                @userinfobot
              </a>
              , mandale un mensaje y copiá el número &ldquo;Id&rdquo; que te devuelve.
            </li>
            <li>Pegalo abajo y guardá.</li>
          </ol>
        </div>

        <div className="bg-ivory border border-mauve/5 rounded-2xl p-5 md:p-6">
          <form onSubmit={handleTelegramSubmit} className="space-y-4">
            {telegramMessage && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  telegramMessageType === "success"
                    ? "bg-green-500/10 border-green-500/20 text-green-400"
                    : "bg-red-500/10 border-red-500/20 text-red-600"
                }`}
              >
                {telegramMessage}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm text-charcoal/70">Chat ID de Telegram</label>
              <input
                className="form-input"
                placeholder={loadingTelegram ? "Cargando..." : "Ej: 123456789"}
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                disabled={loadingTelegram}
              />
              <p className="text-charcoal/40 text-xs">Dejalo vacío y guardá para desactivar los avisos por Telegram.</p>
            </div>

            <Button
              type="submit"
              disabled={savingTelegram || loadingTelegram}
              variant="primary"
              shape="pill"
              className="w-full"
            >
              {savingTelegram ? "Guardando..." : "Guardar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
