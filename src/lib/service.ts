export type Service = {
  title: string;
  price: string;
  time: string;
  summary: string;
  image: string;
  highlights: string[];
  includes: string[];
  description?: string;
};

export const services: Record<string, Service> = {
  "daily-reset": {
    title: "Pack Daily Reset",
    price: "Desde $45.000",
    time: "4-6 hs",
    summary:
      "Limpieza profunda para el auto de uso diario, con foco en interior y detalles visibles.",
    description:
      "Limpieza profunda diaria con foco en interior, detalles visibles y brillo inmediato.",
    image:
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
    highlights: [
      "Resultados visibles en el mismo día",
      "Ideal para autos daily y camionetas",
      "Entrega rápida coordinada por WhatsApp",
    ],
    includes: [
      "Lavado premium exterior",
      "Limpieza profunda de interior",
      "Renovación de plásticos y detalles",
      "Sellado rápido para brillo inmediato",
    ],
  },
  "brillo-total": {
    title: "Pack Brillo Total",
    price: "Desde $85.000",
    time: "1-2 días",
    summary:
      "Corrección de pintura ligera + sellado cerámico para lograr brillo espejo y protección.",
    description:
      "Corrección de pintura 1 paso y sellado cerámico para brillo espejo y protección.",
    image:
      "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80",
    highlights: [
      "Brillo profundo con corrección 1 paso",
      "Sellador cerámico 6 meses",
      "Incluye detailing interior completo",
    ],
    includes: [
      "Corrección de pintura 1 paso",
      "Descontaminado y pulido",
      "Sellador cerámico 6 meses",
      "Detailing interior completo",
    ],
  },
  "proteccion-pro": {
    title: "Pack Protección Pro",
    price: "Desde $180.000",
    time: "2-4 días",
    summary:
      "Protección premium con coating cerámico + PPF parcial para autos nuevos o alta gama.",
    description:
      "Protección cerámica premium con PPF parcial para autos nuevos o alta gama.",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    highlights: [
      "Coating cerámico 3-5 años",
      "PPF parcial frontal",
      "Garantía escrita y plan de mantenimiento",
    ],
    includes: [
      "Preparación de superficie",
      "Aplicación cerámica premium",
      "PPF frontal parcial",
      "Checklist y plan de mantenimiento",
    ],
  },
};

export const serviceSlugs = Object.keys(services);