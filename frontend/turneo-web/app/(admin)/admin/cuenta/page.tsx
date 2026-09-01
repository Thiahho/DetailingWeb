"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth, isAdminAuthenticated, getRole } from "@/src/lib/auth";
import PasswordInput from "@/src/components/ui/PasswordInput";
import { Button } from "@/src/components/shared/Button";

type MessageType = "success" | "error" | "warning";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim();

export default function CuentaPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
    }
  }, [router]);

  // ── Chat ID de Telegram — avisos de turno nuevo al dueño/administrador.
  // Mismo patrón que profesional/cuenta/page.tsx: el backend ya manda el aviso
  // a todos los Admin del tenant (NotificationService.TryNotifyAdminsAsync),
  // esto solo carga el Chat ID por el que Telegram nos deja escribirle.
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

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("success");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetchWithAuth("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessageType("success");
        setMessage(data.message || "Contraseña actualizada correctamente.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        return;
      }

      if (response.status === 401) {
        setMessageType("warning");
        setMessage(data.message || "La contraseña actual es incorrecta.");
        return;
      }

      if (response.status === 400) {
        setMessageType("error");
        setMessage(data.message || "Revisá los datos ingresados.");
        return;
      }

      setMessageType("error");
      setMessage(data.message || "No se pudo actualizar la contraseña.");
    } catch {
      setMessageType("error");
      setMessage("Error de conexión. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Cuenta</h1>
          <p className="text-charcoal/50 text-sm mt-1">Tu contraseña y cómo te avisamos cuando entra un turno nuevo</p>
        </div>

        <div className="bg-ivory border border-mauve/5 rounded-2xl p-5 md:p-6 mb-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <div
                data-testid="cuenta-message"
                className={`rounded-lg border p-3 text-sm ${
                  messageType === "success"
                    ? "bg-green-500/10 border-green-500/20 text-green-700"
                    : messageType === "warning"
                    ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-700"
                    : "bg-red-500/10 border-red-500/20 text-red-600"
                }`}
              >
                {message}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm text-charcoal/70">Contraseña actual</label>
              <PasswordInput
                required
                data-testid="cuenta-current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-charcoal/70">Nueva contraseña</label>
              <PasswordInput
                minLength={6}
                required
                data-testid="cuenta-new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-charcoal/70">Confirmar nueva contraseña</label>
              <PasswordInput
                minLength={6}
                required
                data-testid="cuenta-confirm-password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="form-input"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              data-testid="cuenta-submit"
              variant="primary"
              shape="pill"
              className="w-full"
            >
              {loading ? "Guardando..." : "Cambiar contraseña"}
            </Button>
          </form>
        </div>

        {/* Telegram */}
        <div className="bg-ivory border border-mauve/5 rounded-2xl p-5 md:p-6 mb-4">
          <p className="text-charcoal/70 text-sm font-medium mb-1">Avisos por Telegram</p>
          <p className="text-charcoal/50 text-xs mb-3">Recibí un mensaje cada vez que entra un turno nuevo</p>
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
                data-testid="cuenta-telegram-message"
                className={`rounded-lg border p-3 text-sm ${
                  telegramMessageType === "success"
                    ? "bg-green-500/10 border-green-500/20 text-green-700"
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
                data-testid="cuenta-telegram-chat-id"
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
              data-testid="cuenta-telegram-submit"
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
