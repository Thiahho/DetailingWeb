"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth, isAdminAuthenticated, getRole } from "../../../src/lib/auth";
import { Eye, EyeOff } from "lucide-react";

type MessageType = "success" | "error" | "warning";

export default function CuentaPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
    }
  }, [router]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("success");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
          <p className="text-charcoal/50 text-sm mt-1">Actualizá tu contraseña de administrador</p>
        </div>

        <div className="bg-ivory border border-mauve/5 rounded-2xl p-5 md:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <div
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
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-mauve/10 bg-porcelain/5 px-4 py-3 pr-11 text-charcoal focus:border-blush/50 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-charcoal/70 transition"
                >
                  {showCurrent ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-charcoal/70">Nueva contraseña</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  minLength={6}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-mauve/10 bg-porcelain/5 px-4 py-3 pr-11 text-charcoal focus:border-blush/50 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-charcoal/70 transition"
                >
                  {showNew ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-charcoal/70">Confirmar nueva contraseña</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  minLength={6}
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-mauve/10 bg-porcelain/5 px-4 py-3 pr-11 text-charcoal focus:border-blush/50 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-charcoal/70 transition"
                >
                  {showConfirm ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-blush px-6 py-3.5 font-semibold text-charcoal shadow-glow transition hover:scale-[1.02] disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Cambiar contraseña"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
