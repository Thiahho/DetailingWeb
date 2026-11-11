"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";
import CloudinaryUpload from "@/src/components/forms/CloudinaryUpload";
import type { ConfirmOptions } from "@/src/components/shared/ConfirmDialog";
import { labelClass } from "./CatalogShell";
import { catalogRequest } from "@/src/lib/catalog/api";
import { MEDIA_IMAGE, MEDIA_VIDEO } from "@/src/lib/catalog/enums";
import { cloudinaryPublicId, moveItem } from "@/src/lib/catalog/ordering";
import { withTransform, videoPosterUrl } from "@/src/lib/cloudinaryMedia";
import type { CatalogMedia, CatalogMediaType } from "@/src/lib/catalog/types";

export interface ValueOption {
  id: number;
  label: string;
}

// Photos and videos of a saved product. Files go straight to Cloudinary from
// the browser (same unsigned upload as the other admin screens) and only the
// URL is registered in the API. Deleting removes the record and the API then
// asks Cloudinary to destroy the file.
export default function MediaManager({
  productId,
  media,
  valueOptions,
  onMediaChange,
  onError,
  confirm,
}: {
  productId: number;
  media: CatalogMedia[];
  valueOptions: ValueOption[];
  onMediaChange: (media: CatalogMedia[]) => void;
  onError: (message: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}) {
  const [type, setType] = useState<CatalogMediaType>(MEDIA_IMAGE);
  const [valueId, setValueId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const valueLabel = (id: number | null) => valueOptions.find((v) => v.id === id)?.label;

  const register = async (url: string) => {
    if (!url) return;
    setBusy(true);
    const result = await catalogRequest<CatalogMedia>(`products/${productId}/media`, {
      method: "POST",
      body: { url, publicId: cloudinaryPublicId(url), type, attributeValueId: valueId },
      fallback: "No se pudo registrar el archivo",
    });
    setBusy(false);
    if (result.ok) onMediaChange([...media, result.data]);
    else onError(result.message);
  };

  const move = async (from: number, to: number) => {
    const next = moveItem(media, from, to);
    if (next.every((m, i) => m.id === media[i].id)) return;
    setBusy(true);
    const result = await catalogRequest<CatalogMedia[]>(`products/${productId}/media/order`, {
      method: "PUT",
      body: { mediaIds: next.map((m) => m.id) },
      fallback: "No se pudo reordenar",
    });
    setBusy(false);
    if (result.ok) onMediaChange(result.data);
    else onError(result.message);
  };

  const remove = async (item: CatalogMedia) => {
    const ok = await confirm({
      title: "Quitar archivo",
      message: "¿Quitar este archivo del producto? Deja de mostrarse en el catálogo.",
      confirmLabel: "Quitar",
    });
    if (!ok) return;
    setBusy(true);
    const result = await catalogRequest(`media/${item.id}`, { method: "DELETE", fallback: "No se pudo quitar" });
    setBusy(false);
    if (result.ok) onMediaChange(media.filter((m) => m.id !== item.id));
    else onError(result.message);
  };

  return (
    <div className="space-y-4">
      {media.length === 0 ? (
        <p className="text-charcoal/40 text-sm">Todavía no hay fotos. La primera es la portada del producto.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {media.map((item, index) => {
            const thumb =
              item.type === MEDIA_VIDEO
                ? videoPosterUrl(item.url)
                : withTransform(item.url, "w_240,h_240,c_fill,q_auto,f_auto");
            return (
              <li key={item.id} className="overflow-hidden rounded-xl border border-mauve/10 bg-white">
                <div className="relative aspect-square bg-porcelain">
                  {thumb ? (
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                  )}
                  {index === 0 && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Portada
                    </span>
                  )}
                  {item.type === MEDIA_VIDEO && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Video
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <span className="truncate text-[11px] text-charcoal/50">{valueLabel(item.attributeValueId) ?? "Todas"}</span>
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      className="p-1 text-charcoal/40 hover:text-charcoal disabled:opacity-30"
                      onClick={() => move(index, index - 1)}
                      disabled={busy || index === 0}
                      aria-label="Mover antes"
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <button
                      type="button"
                      className="p-1 text-charcoal/40 hover:text-charcoal disabled:opacity-30"
                      onClick={() => move(index, index + 1)}
                      disabled={busy || index === media.length - 1}
                      aria-label="Mover después"
                    >
                      <ArrowRight size={14} />
                    </button>
                    <button
                      type="button"
                      className="p-1 text-red-500/70 hover:text-red-600 disabled:opacity-30"
                      onClick={() => remove(item)}
                      disabled={busy}
                      aria-label="Quitar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="media-type">Tipo</label>
          <select
            id="media-type"
            className="form-input mt-1.5"
            value={type}
            onChange={(e) => setType(e.target.value === "1" ? MEDIA_VIDEO : MEDIA_IMAGE)}
          >
            <option value={MEDIA_IMAGE}>Imagen</option>
            <option value={MEDIA_VIDEO}>Video</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="media-value">Mostrar con</label>
          <select
            id="media-value"
            className="form-input mt-1.5"
            value={valueId ?? ""}
            onChange={(e) => setValueId(e.target.value ? parseInt(e.target.value) : null)}
            disabled={valueOptions.length === 0}
          >
            <option value="">Todas las variantes</option>
            {valueOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-charcoal/40 text-xs">
        Elegí un valor (por ejemplo un color) para que el archivo se muestre cuando el cliente elige esa opción.
      </p>

      <CloudinaryUpload
        key={type}
        value=""
        onChange={register}
        resourceType={type === MEDIA_VIDEO ? "video" : "image"}
        folder="Turneo/catalogo"
      />
      {busy && <p className="text-charcoal/50 text-xs">Guardando...</p>}
    </div>
  );
}
