import RouletteClient from "./RouletteClient";

// Ruleta de captación de leads (docs/RULETA.pdf) — landing standalone, pensada
// para compartirse por QR/Instagram/campañas, ej. turneo.app/ruleta?campaign=qr
export const metadata = {
  title: "Girá la Ruleta Turneo",
  description: "Descubrí tu beneficio exclusivo para digitalizar tu salón con Turneo.",
};

export default function RuletaPage({
  searchParams,
}: {
  searchParams: { campaign?: string; fuente?: string };
}) {
  return (
    <RouletteClient
      campaign={searchParams.campaign}
      fuente={searchParams.fuente}
    />
  );
}
