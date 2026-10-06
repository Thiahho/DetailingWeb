"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import CloudinaryUpload from "@/src/components/forms/CloudinaryUpload";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { Button } from "@/src/components/shared/Button";
import { useModalHotkeys } from "@/src/hooks/useModalHotkeys";
import { VideoPreview, PlatformIcon } from "@/src/components/public/FeaturedContent";
import { SOCIAL_LABEL, socialPlatform } from "@/src/lib/cloudinaryMedia";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import BulkActionBar, { BulkCheckbox } from "@/src/components/dashboard/BulkActionBar";
import { useBulkSelection } from "@/src/hooks/useBulkSelection";
import { countLabel, runBulk } from "@/src/lib/bulk";

interface ContentVideo {
  id: number;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  linkUrl?: string | null;
  isActive: boolean;
  order: number;
  createdAt: string;
}

const emptyForm = {
  title: "",
  videoUrl: "",
  thumbnailUrl: "",
  linkUrl: "",
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
  const formRef = useRef<HTMLFormElement>(null);
  const closeForm = () => setShowForm(false);
  useModalHotkeys(showForm, { onClose: closeForm, onSubmit: () => formRef.current?.requestSubmit() });
  const { confirm, ConfirmDialog } = useConfirm();
  const bulk = useBulkSelection(videos.map((v) => v.id));
  const [bulkBusy, setBulkBusy] = useState(false);

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
      linkUrl: video.linkUrl ?? "",
      isActive: video.isActive,
      order: video.order,
    });
    setShowForm(true);
  };

  const linkIsInvalid = formData.linkUrl.trim() !== "" && !socialPlatform(formData.linkUrl);

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

  const selectedVideos = videos.filter((v) => bulk.isSelected(v.id));

  // Avisa el resultado de una acción masiva y deja marcados solo los que
  // fallaron, para poder reintentar sin volver a elegirlos.
  const finishBulk = (done: ContentVideo[], failed: ContentVideo[], doneTitle: string) => {
    bulk.setSelection(failed.map((v) => v.id));
    if (failed.length === 0) {
      showToast("success", doneTitle, countLabel(done.length, "video", "videos"));
    } else {
      showToast(
        done.length > 0 ? "warning" : "error",
        done.length > 0 ? `${doneTitle} con errores` : "No se pudo completar",
        `${done.length} listos, ${failed.length} con error (quedaron seleccionados).`
      );
    }
    loadVideos();
  };

  // Activar/desactivar reenvía el video por el mismo PUT que el formulario
  // de edición (mismos seis campos), con isActive cambiado.
  const bulkSetActive = async (isActive: boolean) => {
    const targets = selectedVideos.filter((v) => v.isActive !== isActive);
    if (targets.length === 0) return;
    setBulkBusy(true);
    const { done, failed } = await runBulk(targets, async (v) => {
      const res = await fetch(`/api/content-videos/${v.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: v.title,
          videoUrl: v.videoUrl,
          thumbnailUrl: v.thumbnailUrl,
          linkUrl: v.linkUrl ?? "",
          isActive,
          order: v.order,
        }),
      });
      return res.ok;
    });
    setBulkBusy(false);
    finishBulk(done, failed, isActive ? "Videos activados" : "Videos desactivados");
  };

  const bulkDelete = async () => {
    const targets = selectedVideos;
    if (targets.length === 0) return;
    const ok = await confirm({
      title: "Eliminar videos",
      message: `¿Eliminar ${countLabel(targets.length, "video", "videos")}? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    setBulkBusy(true);
    const { done, failed } = await runBulk(targets, async (v) => {
      const res = await fetch(`/api/content-videos/${v.id}`, { method: "DELETE" });
      return res.ok;
    });
    setBulkBusy(false);
    finishBulk(done, failed, "Videos eliminados");
  };

  if (loading) return <div className="p-6 text-charcoal">Cargando contenido...</div>;

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {ConfirmDialog}

      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-charcoal">Gestión de Contenido</h1>
            <p className="text-charcoal/50 text-sm">Videos destacados del sitio: se ve una preview de 5 segundos que lleva a tu posteo de Instagram o TikTok.</p>
          </div>
          <Button onClick={openCreate} variant="primary">
            + Nuevo video
          </Button>
        </div>

        <BulkActionBar
          count={bulk.count}
          total={videos.length}
          allSelected={bulk.allSelected}
          someSelected={bulk.someSelected}
          onToggleAll={bulk.toggleAll}
          onClear={bulk.clear}
          busy={bulkBusy}
          singular="video"
          plural="videos"
          testIdPrefix="content"
          actions={[
            { key: "activate", label: "Activar", onClick: () => bulkSetActive(true), hidden: selectedVideos.every((v) => v.isActive) },
            { key: "deactivate", label: "Desactivar", onClick: () => bulkSetActive(false), hidden: selectedVideos.every((v) => !v.isActive) },
            { key: "delete", label: "Eliminar", onClick: bulkDelete, variant: "danger" },
          ]}
        />

        {/* Una sola superficie por card: el video va a sangre arriba (sin marco
            ni redondeo propio) y los datos debajo, en vez de una caja dentro de otra. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {videos.map((video) => {
            const platform = socialPlatform(video.linkUrl);
            return (
            <div key={video.id} data-testid="video-card" data-video-title={video.title} className={`flex flex-col overflow-hidden rounded-xl border border-mauve/10 bg-ivory ${bulk.isSelected(video.id) ? "ring-2 ring-blush" : ""}`}>
              <div className="relative aspect-[9/16] bg-porcelain">
                <VideoPreview video={video} />
                <span
                  className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    video.isActive ? "bg-green-600 text-white" : "bg-charcoal/70 text-white"
                  }`}
                >
                  {video.isActive ? "Activo" : "Inactivo"}
                </span>
                {platform ? (
                  <span
                    data-testid="video-platform"
                    className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-charcoal"
                  >
                    <PlatformIcon platform={platform} size={11} />
                    {SOCIAL_LABEL[platform]}
                  </span>
                ) : (
                  <span className="absolute right-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    Sin link al posteo
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-3">
                <div className="flex items-start gap-1">
                  <BulkCheckbox
                    checked={bulk.isSelected(video.id)}
                    onChange={() => bulk.toggle(video.id)}
                    disabled={bulkBusy}
                    label={`Seleccionar ${video.title}`}
                    data-testid="content-select"
                    className="-ml-2.5 -mt-2.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold text-charcoal">{video.title}</p>
                    <p className="mt-0.5 text-xs text-charcoal/60">Orden: {video.order}</p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  <Button onClick={() => openEdit(video)} data-testid="video-edit-button" variant="secondary" size="sm" className="flex-1">Editar</Button>
                  <Button onClick={() => handleDelete(video.id)} data-testid="video-delete-button" variant="danger" size="sm" className="flex-1">Eliminar</Button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form ref={formRef} onSubmit={handleSubmit} className="w-full max-w-xl space-y-4 rounded-xl bg-ivory p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-charcoal">{editingVideo ? "Editar video" : "Nuevo video"}</h2>

            <div>
              <label className="text-xs text-charcoal/60">Título</label>
              <input data-testid="video-form-title" className="form-input mt-1" value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} required />
            </div>

            <div>
              <label className="text-xs text-charcoal/60">Link del posteo (Instagram o TikTok)</label>
              <input
                data-testid="video-form-link"
                type="url"
                inputMode="url"
                className="form-input mt-1"
                value={formData.linkUrl}
                onChange={(e) => setFormData((p) => ({ ...p, linkUrl: e.target.value }))}
                placeholder="https://www.instagram.com/reel/..."
              />
              {linkIsInvalid ? (
                <p className="mt-1 text-xs text-red-600">El link tiene que ser de Instagram o TikTok y empezar con https://</p>
              ) : (
                <p className="mt-1 text-xs text-charcoal/40">
                  Al tocar la preview en el sitio se abre este posteo. Si lo dejás vacío, el video se muestra sin link.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-charcoal/60">Video</label>
              <CloudinaryUpload
                value={formData.videoUrl}
                onChange={(url) => setFormData((p) => ({ ...p, videoUrl: url }))}
                resourceType="video"
                hint="Subí el video completo, el mismo que publicaste: el sitio muestra solo los primeros 5 segundos y arma la portada solo. Recomendado: vertical 9:16."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-charcoal/60">Orden</label>
                <input type="number" className="form-input mt-1" value={formData.order} onChange={(e) => setFormData((p) => ({ ...p, order: Number(e.target.value) }))} />
              </div>
              <label className="flex items-center gap-2 pt-6 text-sm text-charcoal">
                <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))} />
                Activo
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" onClick={closeForm} variant="secondary">Cancelar</Button>
              <Button type="submit" data-testid="video-form-submit" variant="primary" disabled={linkIsInvalid}>Guardar</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
