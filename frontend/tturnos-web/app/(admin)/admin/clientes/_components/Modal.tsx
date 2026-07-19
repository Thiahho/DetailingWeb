"use client";

import { X } from "lucide-react";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useModalHotkeys(true, { onClose });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-porcelain border border-mauve/10 rounded-xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-mauve/15 shrink-0">
          <span className="text-charcoal font-semibold text-sm">{title}</span>
          <button onClick={onClose} className="text-charcoal/40 hover:text-charcoal transition"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
