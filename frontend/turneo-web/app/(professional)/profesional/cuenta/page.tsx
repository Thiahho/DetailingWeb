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

  const [telegramChatId, setTelegramChatId] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("success");

  useEffect(() => {
    fetchWithAuth("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setTelegramChatId(data.telegramChatId ?? ""))
      .finally(() => setLoadingInitial(false));
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetchWithAuth("/api/auth/telegram-chat-id", {
        method: "POST",
        body: JSON.stringify({ telegramChatId: telegramChatId.trim() || null }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessageType("success");
        setMessage(telegramChatId.trim() ? "Listo, ya vas a recibir avisos por Telegram." : "Avisos por Telegram desactivados.");
        return;
      }

      setMessageType("error");
      setMessage(data.message || "No se pudo guardar. Intentá nuevamente.");
    } catch {
      setMessageType("error");
      setMessage("Error de conexión. Intentá nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Mi cuenta</h1>
          <p className="text-charcoal/50 text-sm mt-1">Recibí un aviso por Telegram cada vez que te asignen un turno nuevo</p>
        </div>

        <div className="bg-ivory border border-mauve/5 rounded-2xl p-5 md:p-6 mb-4">
          <p className="text-charcoal/70 text-sm font-medium mb-3">Cómo conseguir tu Chat ID</p>
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  messageType === "success"
                    ? "bg-green-500/10 border-green-500/20 text-green-400"
                    : "bg-red-500/10 border-red-500/20 text-red-600"
                }`}
              >
                {message}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm text-charcoal/70">Chat ID de Telegram</label>
              <input
                className="form-input"
                placeholder={loadingInitial ? "Cargando..." : "Ej: 123456789"}
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                disabled={loadingInitial}
              />
              <p className="text-charcoal/40 text-xs">Dejalo vacío y guardá para desactivar los avisos por Telegram.</p>
            </div>

            <Button
              type="submit"
              disabled={saving || loadingInitial}
              variant="primary"
              shape="pill"
              className="w-full"
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
