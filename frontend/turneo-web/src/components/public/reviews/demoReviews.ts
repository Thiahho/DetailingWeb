import type { GoogleReview } from "@/src/components/public/ReviewsSection";

// Contenido de EJEMPLO para la etapa de pruebas: deja ver la sección de
// reseñas armada mientras el salón todavía no tiene cargado su Google Place ID.
// No son reseñas reales — la sección las rotula como "Contenido de ejemplo" y
// nunca se mezclan con las de Google: en cuanto la API devuelve reseñas reales,
// estas dejan de mostrarse.
//
// Se activa con NEXT_PUBLIC_DEMO_REVIEWS=true. Sin la variable, queda prendido
// solo en `next dev`; en un build de producción está apagado salvo que se
// pida explícitamente. No debe quedar activo en el sitio de un salón real.
const flag = process.env.NEXT_PUBLIC_DEMO_REVIEWS;
export const DEMO_REVIEWS_ENABLED =
  flag === "true" || (!flag && process.env.NODE_ENV === "development");

export const DEMO_GOOGLE_REVIEWS: GoogleReview[] = [
  {
    authorName: "Carla M.",
    profilePhotoUrl: null,
    rating: 5,
    relativeTimeDescription: "hace 2 semanas",
    text: "Me atendieron súper puntual y el resultado quedó tal cual lo pedí. Reservar desde el celular fue rapidísimo.",
    time: 1,
  },
  {
    authorName: "Lucía F.",
    profilePhotoUrl: null,
    rating: 5,
    relativeTimeDescription: "hace 1 mes",
    text: "El lugar es hermoso y muy prolijo. Me explicaron cada paso y me fui con todas las indicaciones de cuidado.",
    time: 2,
  },
  {
    authorName: "Sofía R.",
    profilePhotoUrl: null,
    rating: 4,
    relativeTimeDescription: "hace 1 mes",
    text: "Muy buena atención. Tuve que cambiar el horario a último momento y lo resolví desde la web sin tener que escribir.",
    time: 3,
  },
  {
    authorName: "Valentina G.",
    profilePhotoUrl: null,
    rating: 5,
    relativeTimeDescription: "hace 2 meses",
    text: "Ya es mi tercera vez. Siempre el mismo nivel de detalle y me llega el recordatorio del turno por mail.",
    time: 4,
  },
  {
    authorName: "Martina P.",
    profilePhotoUrl: null,
    rating: 5,
    relativeTimeDescription: "hace 3 meses",
    text: "Fui por recomendación y la verdad que superó lo que esperaba. Vuelvo seguro.",
    time: 5,
  },
];

export type SocialCaptureKind = "whatsapp" | "instagram";

export interface SocialCapture {
  id: string;
  kind: SocialCaptureKind;
  author: string;
  text: string;
  // Hora del mensaje (WhatsApp) o antigüedad del comentario (Instagram).
  meta: string;
  // Captura real (URL de imagen). Si está, se muestra la imagen tal cual en
  // lugar de la maqueta dibujada con código.
  imageUrl?: string;
}

export const DEMO_SOCIAL_CAPTURES: SocialCapture[] = [
  {
    id: "wa-1",
    kind: "whatsapp",
    author: "Carla",
    text: "Hola! Quería agradecerte, me encantó cómo quedó 😍 ya le pasé tu contacto a mi hermana.",
    meta: "18:42",
  },
  {
    id: "ig-1",
    kind: "instagram",
    author: "lu.fernandez",
    text: "La mejor atención del barrio, re recomiendo 💖",
    meta: "2 sem",
  },
  {
    id: "wa-2",
    kind: "whatsapp",
    author: "Valentina",
    text: "Llegué recién a casa y no paro de mirarme al espejo jaja. Gracias por la paciencia!",
    meta: "20:15",
  },
  {
    id: "ig-2",
    kind: "instagram",
    author: "sofi.rios",
    text: "Saqué turno desde el link de la bio y fue un minuto. Genias 👏",
    meta: "1 mes",
  },
];
