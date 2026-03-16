"use client";

import { useState, useRef } from "react";

interface Props {
  value: string;
  onChange: (url: string) => void;
}

export default function CloudinaryUpload({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;

    const validTypes = ["image/webp", "image/jpeg", "image/png", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      setError("Solo se permiten imágenes JPG, PNG o WEBP");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no puede superar 5MB");
      return;
    }

    setError("");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
    formData.append("folder", "detailing/services");

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      if (data.secure_url) {
        onChange(data.secure_url);
      } else {
        setError("Error al subir la imagen");
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
          uploading ? "border-white/20 opacity-60" : "border-white/10 hover:border-green-500/50"
        }`}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {value ? (
          <div className="relative h-36 overflow-hidden rounded-xl">
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition">
              <span className="text-white text-sm font-medium">Cambiar imagen</span>
            </div>
          </div>
        ) : (
          <div className="h-36 flex flex-col items-center justify-center gap-2 text-white/40">
            {uploading ? (
              <span className="text-sm">Subiendo...</span>
            ) : (
              <>
                <span className="text-3xl">↑</span>
                <span className="text-sm">Subir imagen (JPG, PNG, WEBP · max 5MB)</span>
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

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {value && (
        <input
          className="w-full bg-[#0d1117] border border-white/10 rounded-lg p-2 text-white/50 text-xs focus:outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="O pegá una URL directamente"
        />
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/webp,image/jpeg,image/png"
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
