"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { cartActions } from "@/src/hooks/useCart";
import { applyVariants, type CartItem } from "@/src/lib/catalog/cart";
import { fetchVariantStatuses, type OrderSettings } from "@/src/lib/catalog/publicApi";
import {
  MAX_ADDRESS_LENGTH,
  MAX_NOTES_LENGTH,
  buildOrderMessage,
  validateContact,
  whatsappUrl,
  type OrderContact,
} from "@/src/lib/catalog/whatsapp";

type Errors = Partial<Record<"name" | "phone", string>>;

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-charcoal">
        {label}
        {hint && <span className="ml-1 font-normal text-charcoal/50">{hint}</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export default function OrderForm({
  items,
  settings,
  onCartChanged,
}: {
  items: CartItem[];
  settings: OrderSettings | null;
  onCartChanged: (message: string) => void;
}) {
  const [contact, setContact] = useState<OrderContact>({ name: "", phone: "", address: "", notes: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  // Set once WhatsApp was opened: offers to empty the cart (or a manual link when the tab was blocked).
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);

  const whatsAppNumber = settings?.whatsAppNumber?.trim() ?? "";

  if (!whatsAppNumber) {
    return (
      <aside className="glass-card h-fit p-6">
        <h2 className="text-lg font-semibold">Pedidos por WhatsApp</h2>
        <p className="mt-2 text-sm text-charcoal/70">
          {settings === null
            ? "No pudimos cargar los datos del negocio. Probá de nuevo en unos minutos."
            : "Este negocio todavía no configuró su WhatsApp para recibir pedidos. Podés consultarle por sus otros canales de contacto."}
        </p>
        <Link href="/reservar#contacto" className="mt-5 inline-flex rounded-full border border-mauve/20 px-5 py-2.5 text-sm transition hover:border-blush">
          Ver contacto
        </Link>
      </aside>
    );
  }

  const set = (field: keyof OrderContact) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setContact((c) => ({ ...c, [field]: e.target.value }));
    if (field === "name" || field === "phone") setErrors((er) => ({ ...er, [field]: undefined }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validateContact(contact);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // The tab is opened right away, inside the click: after the await below,
    // browsers (Safari above all) would block it as a popup.
    const tab = window.open("", "_blank");
    setSending(true);
    const statuses = await fetchVariantStatuses(items.map((i) => i.variantId));
    setSending(false);

    if (statuses) {
      const fresh = applyVariants(items, statuses);
      if (JSON.stringify(fresh) !== JSON.stringify(items)) {
        tab?.close();
        cartActions.sync(statuses);
        onCartChanged(
          fresh.length === 0
            ? "Los productos de tu pedido ya no están disponibles."
            : "Actualizamos tu pedido con los datos más recientes del catálogo. Revisalo y volvé a enviarlo."
        );
        return;
      }
    }

    const url = whatsappUrl(whatsAppNumber, buildOrderMessage(items, contact, settings?.businessName));
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
      setPopupBlocked(false);
    } else {
      setPopupBlocked(true);
    }
    setSentUrl(url);
  }

  if (sentUrl) {
    return (
      <aside className="glass-card h-fit p-6">
        <h2 className="text-lg font-semibold">{popupBlocked ? "Abrí WhatsApp para enviar" : "¿Se abrió WhatsApp?"}</h2>
        <p className="mt-2 text-sm text-charcoal/70">
          Enviá el mensaje desde WhatsApp y el negocio te responde para coordinar. Si ya lo enviaste, podés vaciar el pedido.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <a
            href={sentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-mauve/20 px-5 text-sm transition hover:border-blush"
          >
            <MessageCircle size={16} aria-hidden /> Abrir WhatsApp de nuevo
          </a>
          <button type="button" onClick={cartActions.clear} className="min-h-[44px] rounded-full bg-blush px-5 text-sm font-semibold text-ink transition hover:-translate-y-0.5">
            Ya lo envié, vaciar pedido
          </button>
          <button type="button" onClick={() => setSentUrl(null)} className="min-h-[44px] text-sm text-charcoal/60 hover:text-charcoal">
            Volver a mis datos
          </button>
        </div>
      </aside>
    );
  }

  const invalid = (field: keyof Errors) =>
    errors[field] ? { "aria-invalid": true, "aria-describedby": `${field}-error` } : {};

  return (
    <aside className="glass-card h-fit p-6 lg:sticky lg:top-28">
      <h2 className="text-lg font-semibold">Tus datos</h2>
      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        <Field id="name" label="Nombre" error={errors.name}>
          <input id="name" autoComplete="name" maxLength={80} value={contact.name} onChange={set("name")} className="form-input" {...invalid("name")} />
        </Field>
        <Field id="phone" label="Teléfono" error={errors.phone}>
          <input id="phone" type="tel" autoComplete="tel" maxLength={30} value={contact.phone} onChange={set("phone")} className="form-input" {...invalid("phone")} />
        </Field>
        <Field id="address" label="Dirección" hint="(opcional)">
          <input id="address" autoComplete="street-address" maxLength={MAX_ADDRESS_LENGTH} value={contact.address} onChange={set("address")} className="form-input" />
        </Field>
        <Field id="notes" label="Notas" hint="(opcional)">
          <textarea id="notes" rows={3} maxLength={MAX_NOTES_LENGTH} value={contact.notes} onChange={set("notes")} className="form-input resize-none" />
        </Field>
        <button
          type="submit"
          disabled={sending}
          className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[#1FA855] px-6 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          <MessageCircle size={18} aria-hidden />
          {sending ? "Revisando el pedido…" : "Enviar pedido por WhatsApp"}
        </button>
        <p className="text-xs text-charcoal/50">Se abre WhatsApp con el mensaje armado; lo enviás vos desde ahí.</p>
      </form>
    </aside>
  );
}
