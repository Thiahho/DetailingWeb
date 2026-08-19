"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/src/components/shared/Button";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";

interface TakedownResult {
  referencesRemoved: string[];
  cloudinaryDeleted: boolean;
  cloudinaryError: string | null;
}

export default function PlatformTakedownPage() {
  const { toasts, showToast, removeToast } = useToast();
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TakedownResult | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setRunning(true);
    setResult(null);

    try {
      const res = await fetch("/api/platform/content-takedown", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast("error", "No se pudo procesar el takedown", data.message);
        return;
      }

      setResult(data);
      showToast(
        data.cloudinaryDeleted ? "success" : "warning",
        data.cloudinaryDeleted ? "Archivo eliminado de Cloudinary" : "No se pudo eliminar de Cloudinary",
        data.cloudinaryError ?? undefined
      );
    } catch {
      showToast("error", "Error de conexión", "No se pudo contactar al servidor");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-white">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="flex items-center gap-4 text-sm text-white/50">
        <Link href="/platform/tenants" className="hover:text-white">Tenants</Link>
        <Link href="/platform/admins" className="hover:text-white">Admins</Link>
        <Link href="/platform/roulette" className="hover:text-white">Ruleta</Link>
        <span className="font-semibold text-white">Takedown</span>
      </div>

      <h1 className="mt-2 text-2xl font-bold">Takedown de contenido</h1>
      <p className="mt-1 text-white/50 text-sm">
        Respuesta a reclamos de{" "}
        <Link href="/derechos-de-autor" target="_blank" className="underline hover:text-white">
          derechos de autor
        </Link>
        . Pegá la URL de Cloudinary reportada — se elimina la referencia en la base de
        cualquier negocio que la use y se borra el archivo real de Cloudinary.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="space-y-1">
          <label className="text-xs font-medium text-white/60">URL de Cloudinary reportada</label>
          <input
            required
            type="url"
            placeholder="https://res.cloudinary.com/..."
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <Button type="submit" disabled={running} variant="primary" shape="pill">
          {running ? "Procesando..." : "Ejecutar takedown"}
        </Button>
      </form>

      {result && (
        <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm">
          <div>
            <span className="font-medium text-white/70">Cloudinary: </span>
            {result.cloudinaryDeleted ? (
              <span className="text-green-400">archivo eliminado</span>
            ) : (
              <span className="text-amber-400">{result.cloudinaryError ?? "no se pudo eliminar"}</span>
            )}
          </div>
          <div>
            <span className="font-medium text-white/70">Referencias en base de datos:</span>
            {result.referencesRemoved.length === 0 ? (
              <p className="mt-1 text-white/50">Ninguna referencia encontrada.</p>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-white/70">
                {result.referencesRemoved.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
