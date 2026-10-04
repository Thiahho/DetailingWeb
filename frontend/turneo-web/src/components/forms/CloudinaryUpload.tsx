"use client";

import { useState, useRef } from "react";

type ResourceType = "image" | "video";

interface Props {
  value: string;
  onChange: (url: string) => void;
  resourceType?: ResourceType;
  folder?: string;
  hint?: string;
}

export default function CloudinaryUpload({
  value,
  onChange,
  resourceType = "image",
  folder = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_FOLDER || "detailing/content",
  hint,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isImage = resourceType === "image";
  const validTypes = isImage
    ? ["image/webp", "image/jpeg", "image/png", "image/jpg"]
    : ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];

  const maxSize = isImage ? 5 * 1024 * 1024 : 80 * 1024 * 1024;
  const accept = isImage
    ? "image/webp,image/jpeg,image/png"
    : "video/mp4,video/quicktime,video/webm,video/x-msvideo";

  const handleFile = async (file: File) => {
    if (!file) return;

    if (!validTypes.includes(file.type)) {
      setError(
        isImage
          ? "Solo se permiten imágenes JPG, PNG o WEBP"
          : "Solo se permiten videos MP4, MOV, WEBM o AVI"
      );
      return;
    }

    if (file.size > maxSize) {
      setError(
        isImage
          ? "La imagen no puede superar 5MB"
          : "El video no puede superar 80MB"
      );
      return;
    }

    if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || !process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) {
      setError("Falta configurar NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME y NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET en .env.local (y reiniciar el dev server)");
      return;
    }

    setError("");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "upload_preset",
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!
    );
    formData.append("folder", folder);

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      if (data.secure_url) {
        // Celulares (sobre todo iPhone) suben video en .mov/.avi, que la mayoría
        // de los navegadores no puede reproducir en un <video> — la URL carga
        // bien (por eso "figura como cargado") pero nunca arranca a reproducir y
        // solo se ve el poster/thumbnail. Cloudinary transcodea al vuelo según
        // la extensión de la URL de entrega, así que forzamos .mp4 acá sin
        // volver a subir nada.
        const url = isImage ? data.secure_url : data.secure_url.replace(/\.\w+$/, ".mp4");
        onChange(url);
      } else {
        // Cloudinary explica la causa en data.error.message (preset inexistente o
        // "Unsigned", cloud name incorrecto, etc.): mostrarla evita adivinar.
        const reason = data?.error?.message ? ` (${data.error.message})` : "";
        setError((isImage ? "Error al subir la imagen" : "Error al subir el video") + reason);
      }
    } catch {
      setError("Error de conexión con Cloudinary");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div
        className={`relative border-2 border-dashed rounded-xl transition cursor-pointer ${
          uploading ? "border-mauve/30 opacity-60" : "border-mauve/20 hover:border-green-500/50"
        }`}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {value ? (
          <div className="relative h-36 overflow-hidden rounded-xl">
            {isImage ? (
              <img src={value} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <video
                src={value}
                className="w-full h-full object-cover"
                muted
                loop
                playsInline
                autoPlay
              />
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition">
              <span className="text-white text-sm font-medium">
                {isImage ? "Cambiar imagen" : "Cambiar video"}
              </span>
            </div>
          </div>
        ) : (
          <div className="h-36 flex flex-col items-center justify-center gap-2 text-charcoal/40">
            {uploading ? (
              <span className="text-sm">Subiendo...</span>
            ) : (
              <>
                <span className="text-3xl">↑</span>
                <span className="text-sm">
                  {isImage
                    ? "Subir imagen (JPG, PNG, WEBP · max 5MB)"
                    : "Subir video (MP4, MOV, WEBM, AVI · max 80MB)"}
                </span>
              </>
            )}
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
            <span className="text-white text-sm">Subiendo...</span>
          </div>
        )}
      </div>

      {hint && <p className="text-charcoal/40 text-xs">{hint}</p>}

      {error && <p className="text-red-600 text-xs">{error}</p>}

      {value && (
        <input
          className="w-full bg-white border border-mauve/15 rounded-lg p-2 text-charcoal/50 text-xs focus:outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="O pegá una URL directamente"
        />
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
