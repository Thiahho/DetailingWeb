"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { MEDIA_VIDEO } from "@/src/lib/catalog/enums";
import type { PublicMedia } from "@/src/lib/catalog/publicTypes";
import { galleryItems } from "@/src/lib/catalog/variants";

// Photos and videos of a product. Media linked to a chosen value (e.g. the
// color) comes first and is shown as soon as that value is picked.
export default function ProductGallery({
  media,
  name,
  selectedValueIds,
}: {
  media: PublicMedia[];
  name: string;
  selectedValueIds: number[];
}) {
  const items = galleryItems(media, selectedValueIds);
  const [activeId, setActiveId] = useState<number | null>(null);
  const selectionKey = selectedValueIds.join(",");

  // A new choice shows its own photo first, even after browsing thumbnails.
  useEffect(() => setActiveId(null), [selectionKey]);

  const active = items.find((m) => m.id === activeId) ?? items[0];

  if (!active) {
    return (
      <div className="glass-card grid aspect-square place-items-center text-mauve/50">
        <ImageOff size={40} aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="glass-card aspect-square overflow-hidden">
        {active.type === MEDIA_VIDEO ? (
          <video src={active.url} controls playsInline className="h-full w-full bg-ink object-contain" />
        ) : (
          <img src={active.url} alt={name} className="h-full w-full object-cover" />
        )}
      </div>
      {items.length > 1 && (
        <ul className="grid grid-cols-5 gap-2">
          {items.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setActiveId(m.id)}
                aria-label={`Ver ${m.type === MEDIA_VIDEO ? "video" : "foto"} ${i + 1}`}
                aria-current={m.id === active.id}
                className={`block aspect-square w-full overflow-hidden rounded-xl border-2 bg-cream transition ${
                  m.id === active.id ? "border-blush" : "border-transparent hover:border-blush/40"
                }`}
              >
                {m.type === MEDIA_VIDEO ? (
                  <span className="grid h-full place-items-center text-xs font-medium text-mauve">Video</span>
                ) : (
                  <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
