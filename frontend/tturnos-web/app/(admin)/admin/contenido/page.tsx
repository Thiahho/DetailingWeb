"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import CloudinaryUpload from "@/src/components/forms/CloudinaryUpload";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";

interface ContentVideo {
  id: number;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  isActive: boolean;
  order: number;
  createdAt: string;
}

const emptyForm = {
  title: "",
  videoUrl: "",
  thumbnailUrl: "",
  isActive: true,
  order: 0,
};

export default function ContenidoAdminPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<ContentVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVideo, setEditingVideo] = useState<ContentVideo | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const { toasts, showToast, removeToast } = useToast();

  const loadVideos = useCallback(async () => {
    try {
      const res = await fetch("/api/content-videos/all");
      const data = await res.json();
      if (res.ok) setVideos(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
      return;
    }
    loadVideos();
  }, [router, loadVideos]);

  const openCreate = () => {
    setEditingVideo(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const openEdit = (video: ContentVideo) => {
    setEditingVideo(video);
    setFormData({
      title: video.title,
      videoUrl: video.videoUrl,
      thumbnailUrl: video.thumbnailUrl,
      isActive: video.isActive,
      order: video.order,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingVideo ? `/api/content-videos/${editingVideo.id}` : "/api/content-videos";
    const method = editingVideo ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast("error", "Error", data.message || "No se pudo guardar");
      return;
    }

    showToast("success", editingVideo ? "Video actualizado" : "Video creado", data.message);
    setShowForm(false);
    setEditingVideo(null);
    setFormData(emptyForm);
    loadVideos();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/content-videos/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      showToast("success", "Video eliminado", data.message);
      loadVideos();
    } else {
      showToast("error", "Error", data.message || "No se pudo eliminar");
    }
  };

  if (loading) return <div className="p-6 text-charcoal">Cargando contenido...</div>;

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-charcoal">Gestión de Contenido</h1>
            <p className="text-charcoal/50 text-sm">Administrá los videos destacados del home.</p>
          </div>
          <button
            onClick={openCreate}
            className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-charcoal hover:bg-green-500"
          >
            + Nuevo video
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <div key={video.id} data-testid="video-card" data-video-title={video.title} className="rounded-xl border border-mauve/10 bg-ivory p-4">
              <video src={video.videoUrl} className="h-56 w-full rounded-lg object-cover" muted loop autoPlay playsInline />
              <p className="mt-3 text-sm font-semibold text-charcoal">{video.title}</p>
              <p className="text-xs text-charcoal/60">Orden: {video.order}</p>
              <p className="text-xs text-charcoal/60">{video.isActive ? "Activo" : "Inactivo"}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => openEdit(video)} data-testid="video-edit-button" className="flex-1 rounded-lg bg-porcelain/10 py-2 text-sm text-charcoal">Editar</button>
                <button onClick={() => handleDelete(video.id)} data-testid="video-delete-button" className="rounded-lg bg-red-900/50 px-3 py-2 text-sm text-red-600">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-4 rounded-xl bg-ivory p-6">
            <h2 className="text-xl font-bold text-charcoal">{editingVideo ? "Editar video" : "Nuevo video"}</h2>

            <div>
              <label className="text-xs text-charcoal/60">Título</label>
              <input data-testid="video-form-title" className="mt-1 w-full rounded-lg border border-mauve/10 bg-cream p-3 text-charcoal" value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} required />
            </div>

            <div>
              <label className="text-xs text-charcoal/60">Video URL</label>
              <CloudinaryUpload
                value={formData.videoUrl}
                onChange={(url) => setFormData((p) => ({ ...p, videoUrl: url }))}
                resourceType="video"
                hint="Recomendado: 1080×1920 px (vertical, 9:16 — formato reel/story). Se muestra siempre en ese recorte vertical."
              />
            </div>

            <div>
              <label className="text-xs text-charcoal/60">Thumbnail URL (opcional)</label>
              <CloudinaryUpload
                value={formData.thumbnailUrl}
                onChange={(url) => setFormData((p) => ({ ...p, thumbnailUrl: url }))}
                hint="Misma proporción que el video: 1080×1920 px (vertical, 9:16)."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-charcoal/60">Orden</label>
                <input type="number" className="mt-1 w-full rounded-lg border border-mauve/10 bg-cream p-3 text-charcoal" value={formData.order} onChange={(e) => setFormData((p) => ({ ...p, order: Number(e.target.value) }))} />
              </div>
              <label className="flex items-center gap-2 pt-6 text-sm text-charcoal">
                <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))} />
                Activo
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg bg-porcelain/10 px-4 py-2 text-charcoal">Cancelar</button>
              <button type="submit" data-testid="video-form-submit" className="rounded-lg bg-green-600 px-4 py-2 text-charcoal">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
