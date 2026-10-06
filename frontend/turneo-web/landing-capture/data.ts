// Catálogo del negocio de muestra que se siembra para las capturas.
// Todo es ficticio: "Estudio Aurora" no existe, los nombres son inventados,
// los mails son @example.com y los teléfonos usan el prefijo 5555.

export const ADMIN_EMAIL = "aurora@example.com";
export const STAFF_EMAIL = "recepcion@example.com";
// Clave de las cuentas demo: solo existe en la base local descartable.
export const DEMO_PASSWORD = "AuroraDemo2026";

export const SITE_CONFIG = {
  businessName: "Estudio Aurora",
  whatsAppNumber: "5491155550100",
  instagramUrl: "https://example.com/estudio-aurora",
  instagramHandle: "@estudioaurora",
  location: "Av. de los Aromos 1234, Buenos Aires",
  locationShort: "Buenos Aires",
  mapEmbedUrl: null,
  siteUrl: "https://example.com",
  logoUrl: "",
  heroTitle: "Tu pelo, tus manos y tu mirada, en un solo lugar",
  heroSubtitle:
    "Color, corte, manicuría y pestañas con un equipo que te conoce. Reservá online en un minuto y elegí con quién atenderte.",
  heroBadge: "Peluquería y estética",
  metaDescription: "Estudio Aurora: peluquería y estética. Reservá tu turno online.",
  googleReviewUrl: null,
  heroHighlights: ["Color y balayage personalizados", "Manicuría semipermanente", "Lifting de pestañas y cejas"],
  googlePlaceId: null,
  localPhotos: [],
};

export interface ServiceSeed {
  slug: string;
  title: string;
  category: string;
  price: number;
  minutes: number;
  color: string;
  description: string;
  details: string[];
}

// Las duraciones son múltiplos de 30 para que la agenda (grilla de 30 min) quede prolija.
export const SERVICES: ServiceSeed[] = [
  {
    slug: "corte-y-brushing", title: "Corte y brushing", category: "Corte", price: 18000, minutes: 60, color: "#7C6AC4",
    description: "Corte a medida con lavado, nutrición express y brushing de terminación.",
    details: ["Diagnóstico de largo y forma", "Lavado con masaje capilar", "Brushing de terminación"],
  },
  {
    slug: "corte-caballero", title: "Corte caballero", category: "Corte", price: 12000, minutes: 30, color: "#D98A3D",
    description: "Corte clásico o degradé con terminación a navaja y peinado.",
    details: ["Corte a tijera o máquina", "Perfilado de contornos", "Peinado con producto"],
  },
  {
    slug: "color-completo", title: "Color completo", category: "Color", price: 42000, minutes: 120, color: "#B8577A",
    description: "Coloración de raíz a puntas con tono personalizado y baño de brillo.",
    details: ["Prueba de tono", "Coloración sin amoníaco", "Baño de brillo y brushing"],
  },
  {
    slug: "balayage", title: "Balayage", category: "Color", price: 78000, minutes: 180, color: "#C2416C",
    description: "Iluminación a mano alzada con matiz y tratamiento reparador incluido.",
    details: ["Diseño de iluminación", "Matiz personalizado", "Tratamiento reparador"],
  },
  {
    slug: "retoque-de-raiz", title: "Retoque de raíz", category: "Color", price: 26000, minutes: 90, color: "#A14A6B",
    description: "Cobertura de crecimiento y canas respetando tu tono actual.",
    details: ["Cobertura de canas", "Igualación de tono", "Secado de terminación"],
  },
  {
    slug: "hidratacion-profunda", title: "Hidratación profunda", category: "Tratamientos", price: 16500, minutes: 60, color: "#3F8FB5",
    description: "Tratamiento intensivo con vapor para devolver brillo y suavidad.",
    details: ["Diagnóstico capilar", "Máscara con vapor", "Sellado de puntas"],
  },
  {
    slug: "alisado-progresivo", title: "Alisado progresivo", category: "Tratamientos", price: 65000, minutes: 150, color: "#2C7A9B",
    description: "Reduce el frizz y el volumen hasta por cuatro meses, sin formol.",
    details: ["Lavado de preparación", "Aplicación mecha por mecha", "Planchado y sellado"],
  },
  {
    slug: "esmaltado-semipermanente", title: "Esmaltado semipermanente", category: "Manicuría", price: 14000, minutes: 60, color: "#2F9E8F",
    description: "Manos prolijas con esmaltado que dura hasta tres semanas.",
    details: ["Limado y cutículas", "Esmaltado en gel", "Hidratación de manos"],
  },
  {
    slug: "lifting-de-pestanas", title: "Lifting de pestañas", category: "Pestañas y cejas", price: 22000, minutes: 60, color: "#248576",
    description: "Curvatura natural con tinte y nutrición, sin extensiones.",
    details: ["Lifting con queratina", "Tinte incluido", "Dura de 6 a 8 semanas"],
  },
  {
    slug: "perfilado-de-cejas", title: "Perfilado de cejas", category: "Pestañas y cejas", price: 9500, minutes: 30, color: "#46B3A3",
    description: "Diseño según tu rostro con pinza e hilo, y laminado opcional.",
    details: ["Medición y diseño", "Depilación con hilo", "Fijación"],
  },
];

export interface ProfessionalSeed {
  key: string;
  firstName: string;
  lastName: string;
  email: string;
  color: string;
  specialty: string;
  bio: string;
  years: number;
  skills: string;
  commission: number;
  // Servicios que ofrece, con el peso con que aparecen en su agenda.
  services: [slug: string, weight: number][];
  // Hora de entrada y salida de lunes a viernes, y del sábado.
  weekdays: [start: number, end: number];
  saturday: [start: number, end: number] | null;
}

export const PROFESSIONALS: ProfessionalSeed[] = [
  {
    key: "valentina", firstName: "Valentina", lastName: "Rossi", email: "valentina@example.com", color: "#B8577A",
    specialty: "Colorista", years: 11, commission: 45,
    bio: "Especialista en rubios y balayage. Arma cada color según tu tono de piel y tu rutina de cuidado.",
    skills: "Balayage, Rubios, Corrección de color, Alisados",
    services: [["color-completo", 5], ["balayage", 3], ["retoque-de-raiz", 4], ["alisado-progresivo", 1], ["hidratacion-profunda", 2]],
    weekdays: [9, 19], saturday: [9, 15],
  },
  {
    key: "camila", firstName: "Camila", lastName: "Herrera", email: "camila@example.com", color: "#7C6AC4",
    specialty: "Estilista", years: 8, commission: 40,
    bio: "Cortes con movimiento y peinados para todos los días. Te enseña a repetir el brushing en casa.",
    skills: "Corte, Brushing, Peinados, Tratamientos",
    services: [["corte-y-brushing", 8], ["hidratacion-profunda", 3], ["retoque-de-raiz", 2], ["alisado-progresivo", 1]],
    weekdays: [10, 20], saturday: [9, 15],
  },
  {
    key: "lucia", firstName: "Lucía", lastName: "Benítez", email: "lucia@example.com", color: "#2F9E8F",
    specialty: "Manicura y lashista", years: 6, commission: 40,
    bio: "Manos impecables y miradas naturales. Trabaja con productos hipoalergénicos y material esterilizado.",
    skills: "Semipermanente, Nail art, Lifting de pestañas, Cejas",
    services: [["esmaltado-semipermanente", 7], ["lifting-de-pestanas", 3], ["perfilado-de-cejas", 4]],
    weekdays: [9, 18], saturday: [9, 15],
  },
  {
    key: "martin", firstName: "Martín", lastName: "Acosta", email: "martin@example.com", color: "#D98A3D",
    specialty: "Barbero y estilista", years: 9, commission: 40,
    bio: "Cortes clásicos, degradés y barba. Atiende con turno puntual y sin apuro.",
    skills: "Degradé, Corte clásico, Barba, Perfilado",
    services: [["corte-caballero", 5], ["corte-y-brushing", 3], ["perfilado-de-cejas", 1]],
    weekdays: [11, 20], saturday: [10, 15],
  },
];

export const PRODUCTS: [name: string, price: number][] = [
  ["Shampoo nutritivo 300 ml", 14500],
  ["Acondicionador reparador 300 ml", 15200],
  ["Máscara hidratante 250 g", 19800],
  ["Sérum de puntas 60 ml", 12400],
  ["Protector térmico 150 ml", 13900],
  ["Aceite de cutículas 15 ml", 6800],
  ["Cera modeladora 100 g", 9200],
];

export interface InsumoSeed {
  key: string;
  name: string;
  category: string;
  stock: number;
  threshold: number;
  unitCost: number;
}

// Tres quedan en el umbral o por debajo, para que se vea la alerta de stock bajo.
export const INSUMOS: InsumoSeed[] = [
  { key: "tintura", name: "Tintura permanente 60 g", category: "Coloración", stock: 42, threshold: 12, unitCost: 4200 },
  { key: "oxidante", name: "Oxidante 20 vol. 1 L", category: "Coloración", stock: 3, threshold: 4, unitCost: 6900 },
  { key: "decolorante", name: "Polvo decolorante 500 g", category: "Coloración", stock: 6, threshold: 3, unitCost: 15800 },
  { key: "matizador", name: "Matizador violeta 250 ml", category: "Coloración", stock: 2, threshold: 3, unitCost: 8400 },
  { key: "papel", name: "Papel aluminio para mechas", category: "Coloración", stock: 9, threshold: 4, unitCost: 3100 },
  { key: "shampoo", name: "Shampoo profesional 5 L", category: "Lavado", stock: 4, threshold: 2, unitCost: 21500 },
  { key: "mascara", name: "Máscara de hidratación 1 kg", category: "Lavado", stock: 5, threshold: 2, unitCost: 18900 },
  { key: "queratina", name: "Alisado progresivo 1 L", category: "Tratamientos", stock: 3, threshold: 1, unitCost: 46000 },
  { key: "esmalte", name: "Esmalte semipermanente 15 ml", category: "Manicuría", stock: 64, threshold: 20, unitCost: 3600 },
  { key: "topcoat", name: "Top coat gel 15 ml", category: "Manicuría", stock: 5, threshold: 6, unitCost: 3900 },
  { key: "limas", name: "Limas descartables (x50)", category: "Manicuría", stock: 11, threshold: 4, unitCost: 5200 },
  { key: "lifting", name: "Kit lifting de pestañas", category: "Pestañas y cejas", stock: 7, threshold: 3, unitCost: 12700 },
  { key: "capas", name: "Capas descartables (x100)", category: "Descartables", stock: 8, threshold: 3, unitCost: 7400 },
  { key: "guantes", name: "Guantes de nitrilo (x100)", category: "Descartables", stock: 14, threshold: 5, unitCost: 8100 },
];

// Receta de cada servicio: qué insumos consume y cuántas unidades.
export const RECIPES: Record<string, [insumoKey: string, quantity: number][]> = {
  "color-completo": [["tintura", 2], ["oxidante", 1], ["capas", 1], ["guantes", 1]],
  "balayage": [["decolorante", 1], ["oxidante", 1], ["matizador", 1], ["papel", 1]],
  "retoque-de-raiz": [["tintura", 1], ["oxidante", 1], ["guantes", 1]],
  "hidratacion-profunda": [["mascara", 1]],
  "alisado-progresivo": [["queratina", 1], ["shampoo", 1]],
  "esmaltado-semipermanente": [["esmalte", 1], ["topcoat", 1], ["limas", 1]],
  "lifting-de-pestanas": [["lifting", 1]],
  "corte-y-brushing": [["capas", 1]],
};

export const AUTOMATION_RULES = [
  {
    name: "Saludo de cumpleaños", triggerType: "ClientBirthday", inactiveDays: null, clientLabel: "tu cumpleaños",
    messageTemplate: "¡Feliz cumple, {nombre}! 🎂 Este mes tenés 15% off en el servicio que elijas. Reservá cuando quieras.",
    cooldownDays: 300, isActive: true,
  },
  {
    name: "Volvé a verte bien (60 días sin venir)", triggerType: "ClientInactive", inactiveDays: 60, clientLabel: "tu próxima visita",
    messageTemplate: "Hola {nombre}, hace un tiempo que no te vemos por el estudio. ¿Te guardamos un turno para esta semana?",
    cooldownDays: 45, isActive: true,
  },
  {
    name: "Mantenimiento de color (45 días)", triggerType: "ClientInactive", inactiveDays: 45, clientLabel: "tu retoque de color",
    messageTemplate: "Hola {nombre}, ya pasaron 45 días de tu último color. Es buen momento para {servicio}. ¿Agendamos?",
    cooldownDays: 30, isActive: true,
  },
  {
    name: "Recuperar clientes (120 días)", triggerType: "ClientInactive", inactiveDays: 120, clientLabel: "tu vuelta al estudio",
    messageTemplate: "{nombre}, te extrañamos. Volvé este mes y te regalamos una hidratación con tu servicio.",
    cooldownDays: 90, isActive: false,
  },
];

export const LOYALTY_PRIZES = [
  { name: "10% off en tu próximo turno", description: "Válido para cualquier servicio.", type: "PercentOff", value: 10, probability: 34, validityDays: 30 },
  { name: "Hidratación de regalo", description: "Con cualquier servicio de color o corte.", type: "FreeAddOn", value: null, probability: 20, validityDays: 30 },
  { name: "Perfilado de cejas gratis", description: "Sumalo a tu próxima visita.", type: "FreeAddOn", value: null, probability: 16, validityDays: 30 },
  { name: "20% off en color", description: "Color completo, balayage o retoque de raíz.", type: "PercentOff", value: 20, probability: 12, validityDays: 21 },
  { name: "Sérum de puntas de regalo", description: "Retiralo en el local.", type: "FreeProduct", value: null, probability: 10, validityDays: 45 },
  { name: "2x1 en esmaltado", description: "Vení con una amiga.", type: "TwoForOne", value: null, probability: 8, validityDays: 30 },
];

export const REVIEWS: { authorName: string; rating: number; comment: string; approved: boolean }[] = [
  { authorName: "Sofía M.", rating: 5, comment: "Me hice balayage con Valentina y quedó tal cual la foto que llevé. Reservar por la web fue rapidísimo.", approved: true },
  { authorName: "Carolina D.", rating: 5, comment: "Puntuales y muy prolijas. El semipermanente me duró tres semanas enteras.", approved: true },
  { authorName: "Julieta P.", rating: 5, comment: "Camila entendió enseguida el corte que quería. Además te explican cómo cuidarlo en casa.", approved: true },
  { authorName: "Nicolás R.", rating: 4, comment: "Buen corte y buena onda. Lo mejor es que elegís el horario y no tenés que estar escribiendo.", approved: true },
  { authorName: "Florencia G.", rating: 5, comment: "El lifting de pestañas quedó muy natural. Volví a reservar desde el celular en el momento.", approved: true },
  { authorName: "Agustina L.", rating: 5, comment: "Hace un año que voy. Siempre me atienden a horario y me avisan el día anterior.", approved: true },
  { authorName: "Mariana T.", rating: 4, comment: "Muy lindo el lugar y excelente el color. Me gustaría que abrieran los domingos.", approved: false },
  { authorName: "Paula S.", rating: 5, comment: "Fui por el alisado y salí encantada. Súper recomendable.", approved: false },
];

export const FIRST_NAMES_F = [
  "Sofía", "Martina", "Camila", "Valentina", "Julieta", "Florencia", "Agustina", "Micaela", "Carolina", "Daniela",
  "Paula", "Mariana", "Lucía", "Rocío", "Antonella", "Brenda", "Victoria", "Natalia", "Gabriela", "Lorena",
  "Milagros", "Abril", "Candela", "Josefina", "Melina", "Noelia", "Romina", "Silvina", "Verónica", "Yamila",
  "Belén", "Celeste", "Eugenia", "Guadalupe", "Jimena", "Karina", "Luciana", "Macarena", "Pilar", "Renata",
];
export const FIRST_NAMES_M = [
  "Nicolás", "Matías", "Federico", "Santiago", "Tomás", "Ignacio", "Joaquín", "Facundo", "Lucas", "Gonzalo",
  "Diego", "Ezequiel", "Franco", "Bruno", "Leandro", "Mariano", "Pablo", "Ramiro",
];
export const LAST_NAMES = [
  "Gómez", "Fernández", "López", "Díaz", "Martínez", "Pérez", "Romero", "Sosa", "Álvarez", "Torres",
  "Ruiz", "Ramírez", "Flores", "Acuña", "Molina", "Castro", "Ortiz", "Silva", "Núñez", "Luna",
  "Cabrera", "Ríos", "Morales", "Godoy", "Medina", "Vega", "Aguirre", "Peralta", "Ferreyra", "Domínguez",
  "Suárez", "Giménez", "Navarro", "Paz", "Bustos", "Maldonado", "Ojeda", "Villalba", "Correa", "Figueroa",
  "Herrera", "Miranda", "Ponce", "Rojas", "Benítez", "Vera", "Arias", "Cardozo", "Leiva", "Quiroga",
  "Soria", "Barrios", "Coronel", "Franco", "Ibáñez", "Juárez", "Lucero", "Méndez", "Olmos", "Páez",
  "Roldán", "Salinas", "Toledo", "Vázquez", "Zapata", "Ávila", "Bravo", "Carrizo", "Duarte", "Escobar",
];

export const CUSTOMER_NOTES = [
  "Prefiere turnos a la mañana. Alérgica al amoníaco: usar línea sin amoníaco.",
  "Rubio frío, matizar siempre. Trae fotos de referencia.",
  "Cuero cabelludo sensible. Lavar con agua tibia.",
  "Viene cada 3 semanas por semipermanente. Tonos nude.",
  "Está dejando crecer el pelo: solo despuntar.",
  "Paga por transferencia. Pide factura.",
  "Le gusta el café cortado. Suele llegar 10 minutos antes.",
  "Embarazada: evitar alisados hasta nuevo aviso.",
  "Fórmula de color: 7.1 + 8.0 con 20 vol.",
  "Uñas cortas, forma almendra. No usa nail art.",
  "Degradé bajo, costados a máquina 1.",
  "Viene con su hija; coordinar dos turnos seguidos.",
  "Pestañas rectas: usar rulo M en el lifting.",
  "Prefiere atenderse siempre con la misma profesional.",
];

export const MANUAL_OUT = [
  "Compra de insumos de coloración", "Artículos de limpieza", "Cafetería y descartables", "Reposición de esmaltes",
  "Lavandería de toallas", "Flete del proveedor",
];
