// Número de WhatsApp comercial de Turneo (el producto/SaaS) — compartido entre
// la landing comercial y la ruleta de captación (docs/RULETA.pdf).
export const WHATSAPP_NUMBER = "541122692061";

export const buildWhatsAppUrl = (message: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
