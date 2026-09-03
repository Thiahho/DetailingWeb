"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import CloudinaryUpload from "@/src/components/forms/CloudinaryUpload";
import { Button } from "@/src/components/shared/Button";
import Modal from "./Modal";
import type { Customer } from "./types";

interface ProfessionalOption {
  id: number;
  firstName: string;
  lastName: string;
}

export interface CustomerFormData {
  phone: string;
  name: string;
  email?: string;
  notes?: string;
  birthday?: string;
  instagram?: string;
  favoriteProfessionalId?: number;
  photoUrls?: string;
}

function parsePhotoUrls(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function CustomerForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<Customer>;
  onSave: (data: CustomerFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    phone: initial?.phone ?? "",
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    notes: initial?.notes ?? "",
    birthday: initial?.birthday ?? "",
    instagram: initial?.instagram ?? "",
    favoriteProfessionalId: initial?.favoriteProfessionalId ?? null as number | null,
  });
  const [photos, setPhotos] = useState<string[]>(parsePhotoUrls(initial?.photoUrls));
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/professionals").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setProfessionals(data);
    });
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const addPhoto = (url: string) => { if (url) setPhotos((p) => [...p, url]); };
  const removePhoto = (idx: number) => setPhotos((p) => p.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.phone.trim() || !form.name.trim()) { setError("Nombre y teléfono son obligatorios."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({
        phone: form.phone,
        name: form.name,
        email: form.email || undefined,
        notes: form.notes || undefined,
        birthday: form.birthday || undefined,
        instagram: form.instagram || undefined,
        favoriteProfessionalId: form.favoriteProfessionalId ?? undefined,
        photoUrls: photos.length > 0 ? JSON.stringify(photos) : undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div>
        <label className="block text-charcoal/50 text-xs mb-1">Nombre *</label>
        <input data-testid="customer-form-name" value={form.name} onChange={set("name")} className="form-input" placeholder="Juan Pérez" />
      </div>
      <div>
        <label className="block text-charcoal/50 text-xs mb-1">Teléfono *</label>
        <input data-testid="customer-form-phone" value={form.phone} onChange={set("phone")} className="form-input" placeholder="5491112345678" />
      </div>
      <div>
        <label className="block text-charcoal/50 text-xs mb-1">Email</label>
        <input value={form.email} onChange={set("email")} className="form-input" placeholder="juan@email.com" type="email" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-charcoal/50 text-xs mb-1">Cumpleaños</label>
          <input data-testid="customer-form-birthday" value={form.birthday} onChange={set("birthday")} className="form-input" type="date" />
        </div>
        <div>
          <label className="block text-charcoal/50 text-xs mb-1">Instagram</label>
          <input data-testid="customer-form-instagram" value={form.instagram} onChange={set("instagram")} className="form-input" placeholder="@usuario" />
        </div>
      </div>
      {professionals.length > 0 && (
        <div>
          <label className="block text-charcoal/50 text-xs mb-1">Profesional favorito</label>
          <select
            data-testid="customer-form-favorite-professional"
            value={form.favoriteProfessionalId ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, favoriteProfessionalId: e.target.value ? parseInt(e.target.value) : null }))}
            className="form-input"
          >
            <option value="">— Sin preferencia —</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-charcoal/50 text-xs mb-1">Notas</label>
        <textarea data-testid="customer-form-notes" value={form.notes} onChange={set("notes")} className="form-input h-16 resize-none" placeholder="Alergias, preferencias, tratamientos anteriores, etc." />
      </div>
      <div>
        <label className="block text-charcoal/50 text-xs mb-1">Fotos</label>
        {photos.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-2" data-testid="customer-form-photos">
            {photos.map((url, i) => (
              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-mauve/15">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  data-testid="customer-form-photo-remove"
                  className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-lg p-0.5"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <CloudinaryUpload value="" onChange={addPhoto} folder="Turneo/clientes" hint="Antes/después, tratamientos, etc." />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={saving} data-testid="customer-form-submit" variant="primary" className="flex-1">
          {saving ? "Guardando..." : "Guardar"}
        </Button>
        <Button type="button" onClick={onClose} variant="secondary">Cancelar</Button>
      </div>
    </form>
  );
}

export default function CustomerFormModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<Customer>;
  onSave: (data: CustomerFormData) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <Modal title={initial ? "Editar cliente" : "Nuevo cliente"} onClose={onClose}>
      <CustomerForm initial={initial} onSave={onSave} onClose={onClose} />
    </Modal>
  );
}
