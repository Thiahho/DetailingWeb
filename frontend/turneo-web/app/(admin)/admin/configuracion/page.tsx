"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import CloudinaryUpload from "@/src/components/forms/CloudinaryUpload";
import { extractMapEmbedSrc, clearSiteConfigCache } from "@/src/lib/siteConfig";
import { Button } from "@/src/components/shared/Button";

type MessageType = "success" | "error";

const emptyForm = {
  businessName: "",
  whatsAppNumber: "",
  instagramUrl: "",
  instagramHandle: "",
  location: "",
  locationShort: "",
  mapEmbedUrl: "",
  googleReviewUrl: "",
  siteUrl: "",
  logoUrl: "",
  heroTitle: "",
  heroSubtitle: "",
  heroBadge: "",
  heroHighlights: "",
  metaDescription: "",
};

export default function ConfiguracionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("success");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
      return;
    }
    // React StrictMode invoca este efecto dos veces en dev — sin el guard
    // "ignore", la respuesta de la primera invocación puede resolver tarde
    // (rutas frías = compilación on-demand lenta) y pisar con datos viejos
    // lo que el usuario ya haya escrito en el form antes de guardar.
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/siteconfig");
        if (res.ok) {
          const data = await res.json();
          if (!ignore) {
            setFormData({
              businessName: data.businessName || "",
              whatsAppNumber: data.whatsAppNumber || "",
              instagramUrl: data.instagramUrl || "",
              instagramHandle: data.instagramHandle || "",
              location: data.location || "",
              locationShort: data.locationShort || "",
              mapEmbedUrl: data.mapEmbedUrl || "",
              googleReviewUrl: data.googleReviewUrl || "",
              siteUrl: data.siteUrl || "",
              logoUrl: data.logoUrl || "",
              heroTitle: data.heroTitle || "",
              heroSubtitle: data.heroSubtitle || "",
              heroBadge: data.heroBadge || "",
              heroHighlights: Array.isArray(data.heroHighlights) ? data.heroHighlights.join("\n") : "",
              metaDescription: data.metaDescription || "",
            });
          }
        }
      } catch (error) {
        logError("Error cargando configuración:", error);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const payload = {
      ...formData,
      heroHighlights: formData.heroHighlights
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    };

    try {
      const res = await fetch("/api/siteconfig", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        clearSiteConfigCache();
        setMessageType("success");
        setMessage("Configuración guardada. Los cambios se ven en el sitio en unos minutos.");
      } else {
        const data = await res.json().catch(() => ({}));
        setMessageType("error");
        setMessage(data.message || "No se pudo guardar la configuración");
      }
    } catch {
      setMessageType("error");
      setMessage("Error de conexión con el servidor");
    } finally {
      setSaving(false);
    }
  };

  const mapPreviewSrc = extractMapEmbedSrc(formData.mapEmbedUrl, formData.location);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Configuración de la empresa</h1>
          <p className="text-charcoal/50 text-sm mt-1">
            Nombre, dirección, contacto y redes que se muestran en el sitio público
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {message && (
            <div
              data-testid="config-message"
              className={`rounded-lg border p-3 text-sm ${
                messageType === "success"
                  ? "bg-green-500/10 border-green-500/20 text-green-700"
                  : "bg-red-500/10 border-red-500/20 text-red-600"
              }`}
            >
              {message}
            </div>
          )}

          {/* Identidad */}
          <div className="bg-ivory border border-mauve/5 rounded-2xl p-5 md:p-6 space-y-4">
            <h2 className="text-charcoal font-semibold text-sm uppercase tracking-wider">Identidad</h2>

            <div>
              <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Turneo APP</label>
              <input
                className="form-input mt-1.5"
                data-testid="config-business-name"
                value={formData.businessName}
                onChange={(e) => setFormData((prev) => ({ ...prev, businessName: e.target.value }))}
                placeholder="Turneo - Codian"
                required
              />
            </div>

            <div>
              <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Logo</label>
              <div className="mt-1.5">
                <CloudinaryUpload
                  value={formData.logoUrl}
                  onChange={(url) => setFormData((prev) => ({ ...prev, logoUrl: url }))}
                />
              </div>
            </div>

            <div>
              <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">URL del sitio</label>
              <input
                className="form-input mt-1.5"
                value={formData.siteUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, siteUrl: e.target.value }))}
                placeholder="https://mistudio.com"
              />
            </div>
          </div>

          {/* Contacto */}
          <div className="bg-ivory border border-mauve/5 rounded-2xl p-5 md:p-6 space-y-4">
            <h2 className="text-charcoal font-semibold text-sm uppercase tracking-wider">Contacto y dirección</h2>

            <div>
              <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">WhatsApp</label>
              <input
                className="form-input mt-1.5"
                value={formData.whatsAppNumber}
                onChange={(e) => setFormData((prev) => ({ ...prev, whatsAppNumber: e.target.value }))}
                placeholder="+54 9 11 1234-5678"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Dirección completa</label>
                <input
                  className="form-input mt-1.5"
                  value={formData.location}
                  onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="Av. Siempre Viva 742, Springfield"
                />
              </div>
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Dirección corta (footer)</label>
                <input
                  className="form-input mt-1.5"
                  value={formData.locationShort}
                  onChange={(e) => setFormData((prev) => ({ ...prev, locationShort: e.target.value }))}
                  placeholder="Springfield"
                />
              </div>
            </div>
          </div>

          {/* Redes */}
          <div className="bg-ivory border border-mauve/5 rounded-2xl p-5 md:p-6 space-y-4">
            <h2 className="text-charcoal font-semibold text-sm uppercase tracking-wider">Redes sociales</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Instagram (link)</label>
                <input
                  className="form-input mt-1.5"
                  value={formData.instagramUrl}
                  onChange={(e) => setFormData((prev) => ({ ...prev, instagramUrl: e.target.value }))}
                  placeholder="https://instagram.com/mistudio"
                />
              </div>
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Instagram (usuario)</label>
                <input
                  className="form-input mt-1.5"
                  value={formData.instagramHandle}
                  onChange={(e) => setFormData((prev) => ({ ...prev, instagramHandle: e.target.value }))}
                  placeholder="@mistudio"
                />
              </div>
            </div>
          </div>

          {/* Reseñas */}
          <div className="bg-ivory border border-mauve/5 rounded-2xl p-5 md:p-6 space-y-4">
            <h2 className="text-charcoal font-semibold text-sm uppercase tracking-wider">Reseñas</h2>
            <div>
              <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">
                Link de Google Reviews
              </label>
              <input
                className="form-input mt-1.5"
                value={formData.googleReviewUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, googleReviewUrl: e.target.value }))}
                placeholder="https://g.page/r/tu-negocio/review"
              />
              <p className="text-charcoal/40 text-xs mt-1.5">
                Cuando alguien usa una Smart Tag de tipo "Dejar reseña", se lo redirige acá siempre, sin importar la valoración que haya dejado.
              </p>
            </div>
          </div>

          {/* Mapa */}
          <div className="bg-ivory border border-mauve/5 rounded-2xl p-5 md:p-6 space-y-4">
            <h2 className="text-charcoal font-semibold text-sm uppercase tracking-wider">Mapa</h2>
            <div>
              <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Google Maps</label>
              <textarea
                className="form-input mt-1.5 resize-none"
                rows={3}
                value={formData.mapEmbedUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, mapEmbedUrl: e.target.value }))}
                placeholder='Pegá acá el código de "Insertar un mapa" de Google Maps (el <iframe> completo), o directamente el link para compartir'
              />
              <p className="text-charcoal/40 text-xs mt-1.5">
                En Google Maps: buscá la dirección → Compartir → Insertar un mapa → Copiar HTML. Si dejás esto vacío, se arma un mapa a partir de la dirección de arriba.
              </p>
            </div>
            {mapPreviewSrc && (
              <div className="rounded-xl overflow-hidden border border-mauve/10 h-56">
                <iframe src={mapPreviewSrc} className="w-full h-full" loading="lazy" title="Vista previa del mapa" />
              </div>
            )}
          </div>

          {/* Avanzado — contenido de portada, colapsado por defecto */}
          <div className="bg-ivory border border-mauve/5 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between p-5 md:p-6 text-left"
            >
              <div>
                <h2 className="text-charcoal font-semibold text-sm uppercase tracking-wider">Portada del sitio (opcional)</h2>
                <p className="text-charcoal/40 text-xs mt-1">Título, bajada y descripción para buscadores</p>
              </div>
              <span className="text-charcoal/40 text-lg">{showAdvanced ? "−" : "+"}</span>
            </button>
            {showAdvanced && (
              <div className="px-5 md:px-6 pb-5 md:pb-6 space-y-4">
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Badge de portada</label>
                  <input
                    className="form-input mt-1.5"
                    value={formData.heroBadge}
                    onChange={(e) => setFormData((prev) => ({ ...prev, heroBadge: e.target.value }))}
                    placeholder="✨ Nuevo en la ciudad"
                  />
                </div>
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Título de portada</label>
                  <input
                    className="form-input mt-1.5"
                    value={formData.heroTitle}
                    onChange={(e) => setFormData((prev) => ({ ...prev, heroTitle: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Bajada de portada</label>
                  <textarea
                    className="form-input mt-1.5 resize-none"
                    rows={2}
                    value={formData.heroSubtitle}
                    onChange={(e) => setFormData((prev) => ({ ...prev, heroSubtitle: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">
                    Destacados de portada (uno por línea)
                  </label>
                  <textarea
                    className="form-input mt-1.5 resize-none"
                    rows={3}
                    value={formData.heroHighlights}
                    onChange={(e) => setFormData((prev) => ({ ...prev, heroHighlights: e.target.value }))}
                    placeholder={"Manicura Clásica\nEsmaltado Semipermanente"}
                  />
                  <p className="text-charcoal/40 text-xs mt-1.5">
                    Se muestran con un ✓ en la tarjeta de portada. Si lo dejás vacío, se muestran los primeros 2 servicios cargados.
                  </p>
                </div>
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Descripción para buscadores (SEO)</label>
                  <textarea
                    className="form-input mt-1.5 resize-none"
                    rows={2}
                    value={formData.metaDescription}
                    onChange={(e) => setFormData((prev) => ({ ...prev, metaDescription: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={saving}
            data-testid="config-submit"
            variant="primary"
            shape="pill"
            className="w-full"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </form>
      </div>
    </div>
  );
}
