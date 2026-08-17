import { notFound, redirect } from "next/navigation";
import BookingForm from "@/src/components/booking/BookingForms";
import RebookFlow from "@/src/components/smarttag/RebookFlow";
import ReviewFlow from "@/src/components/smarttag/ReviewFlow";
import { getWhatsAppLink } from "@/src/lib/siteConfig";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://detailing-api.onrender.com";
const TENANCY_BASE_DOMAIN = process.env.NEXT_PUBLIC_TENANCY_BASE_DOMAIN || "turneo.app";

interface SmartLinkData {
  smartTagId: number;
  name: string;
  location: string | null;
  action: "BOOKING" | "REBOOK" | "REVIEW" | "WHATSAPP" | "INSTAGRAM";
  tenantSlug: string;
  businessName: string;
}

// Fetch directo al backend (no vía BFF, a diferencia del resto del sitio):
// es seguro específicamente acá porque el endpoint resuelve el tenant por
// token, no por Host (ver SmartLinkController.cs) — replicar este patrón
// para cualquier otra llamada del sitio no sería multi-tenant-safe.
// no-store: cada visita registra un evento de interacción en el backend.
async function getSmartLink(token: string): Promise<SmartLinkData | null> {
  try {
    const res = await fetch(`${API_URL}/api/smart/${token}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const ACTION_SUBTITLE: Record<SmartLinkData["action"], string> = {
  BOOKING: "Reservá tu turno",
  REBOOK: "Volvé a reservar",
  REVIEW: "Contanos qué te pareció",
  WHATSAPP: "Te llevamos a WhatsApp",
  INSTAGRAM: "Te llevamos a Instagram",
};

// Mismo header X-Tenant-Host que arma tenantHeader() en el resto del sitio,
// pero armado a mano acá: es un fetch directo del Server Component al
// backend (sin pasar por el proxy BFF), igual que getSmartLink arriba —
// esto sí necesita el override porque /api/siteconfig resuelve tenant por
// host, no por token.
async function getSiteConfigForTenant(tenantSlug: string): Promise<{ whatsAppNumber: string; instagramUrl: string } | null> {
  try {
    const res = await fetch(`${API_URL}/api/siteconfig`, {
      headers: { "X-Tenant-Host": `${tenantSlug}.${TENANCY_BASE_DOMAIN}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function SmartLinkPage({ params }: { params: { token: string } }) {
  const data = await getSmartLink(params.token);
  if (!data) notFound();

  let redirectFallbackMessage: string | null = null;
  if (data.action === "WHATSAPP" || data.action === "INSTAGRAM") {
    const siteConfig = await getSiteConfigForTenant(data.tenantSlug);
    const target =
      data.action === "WHATSAPP"
        ? siteConfig?.whatsAppNumber
          ? getWhatsAppLink(siteConfig.whatsAppNumber, "¡Hola! Vengo de la etiqueta en el local.")
          : null
        : siteConfig?.instagramUrl || null;

    if (target) redirect(target);
    redirectFallbackMessage =
      data.action === "WHATSAPP"
        ? "Este negocio todavía no configuró su WhatsApp."
        : "Este negocio todavía no configuró su Instagram.";
  }

  return (
    <main className="min-h-screen bg-cream px-6 py-16 text-charcoal">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="text-center space-y-1">
          <span className="badge">{data.businessName}</span>
          <h1 className="text-3xl font-semibold text-charcoal">{ACTION_SUBTITLE[data.action]}</h1>
          {data.location && <p className="text-charcoal/50 text-sm">{data.location}</p>}
        </div>

        {data.action === "BOOKING" && (
          <BookingForm tenantSlugOverride={data.tenantSlug} smartTagToken={params.token} />
        )}
        {data.action === "REBOOK" && <RebookFlow token={params.token} tenantSlug={data.tenantSlug} />}
        {data.action === "REVIEW" && <ReviewFlow token={params.token} />}
        {redirectFallbackMessage && (
          <div className="glass-card p-6 text-center">
            <p className="text-charcoal/60 text-sm">{redirectFallbackMessage}</p>
          </div>
        )}
      </div>
    </main>
  );
}
