import BeneficiosClient from "./BeneficiosClient";

// Ruleta de beneficios para clientes propios del negocio (no confundir con
// /ruleta, que es la de captación de leads de Turneo). Pensada para que el
// dueño la comparta con sus clientes (QR en el local, WhatsApp, Instagram)
// y así incentivar recompra / aumentar el ticket promedio.
// Mockup visual: los premios están hardcodeados y el sorteo se resuelve en
// el cliente, sin backend propio todavía (ver conversación — se evaluó
// hacerlo full-stack con premios y canje por tenant, pero se priorizó
// validar la idea visualmente primero).
export const metadata = {
  title: "Girá y ganá un beneficio",
  description: "Un premio exclusivo para tu próxima visita. ¡Girá la ruleta!",
};

export default function BeneficiosPage() {
  return <BeneficiosClient />;
}
