import BeneficiosClient from "./BeneficiosClient";

// Ruleta de beneficios para clientes propios del negocio (no confundir con
// /ruleta, que es la de captación de leads de Turneo). Pensada para que el
// dueño la comparta con sus clientes (QR en el local, WhatsApp, Instagram)
// y así incentivar recompra / aumentar el ticket promedio. Consume el mismo
// backend de Loyalty (LoyaltyRouletteController) que /admin/ruleta.
export const metadata = {
  title: "Girá y ganá un beneficio",
  description: "Un premio exclusivo para tu próxima visita. ¡Girá la ruleta!",
};

export default function BeneficiosPage() {
  return <BeneficiosClient />;
}
