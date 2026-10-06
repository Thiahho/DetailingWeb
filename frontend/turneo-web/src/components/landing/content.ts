import { buildWhatsAppUrl } from "@/src/lib/contact";

// Copy de la home comercial de Turneo ("/"). Reglas que este archivo respeta
// y que hay que mantener al editarlo:
// - Voz rioplatense (voseo), dirigida a quien lleva el salón.
// - Sin métricas, testimonios, cantidad de clientes ni logos inventados.
// - Solo se afirma lo que hoy está en producción. Lo que no lo está (cobro
//   online con Mercado Pago, avisos automáticos por WhatsApp a clientes) va
//   rotulado "próximamente". Los recordatorios a clientes salen por email;
//   por WhatsApp se mandan a mano desde el panel (links wa.me con el mensaje
//   precargado en Panel, Turnos, Calendario e Historial).
// - Sin precios ni selección de planes.

// Título con una parte en .accent-serif (itálica serif), igual que /reservar.
export interface AccentTitle {
  before?: string;
  accent: string;
  after?: string;
}

export const WHATSAPP = {
  hero: buildWhatsAppUrl("Hola! Quiero sumar mi salón a Turneo."),
  nav: buildWhatsAppUrl("Hola! Quiero más información sobre Turneo."),
  faq: buildWhatsAppUrl("Hola! Tengo una consulta sobre Turneo."),
  closing: buildWhatsAppUrl("Hola! Quiero más información sobre Turneo."),
};

// Acceso directo a la reserva online desde la barra: quien llega a la home
// buscando sacar un turno (y no contratar Turneo) lo tiene a un toque.
export const BOOKING_CTA = { href: "/reservar", label: "Reservar turno" };

export const NAV_LINKS = [
  { href: "#problemas", label: "Qué resuelve" },
  { href: "#tu-web", label: "Tu web" },
  { href: "#preguntas", label: "Preguntas" },
];

export const HERO = {
  eyebrow: "Para peluquerías, uñas, pestañas y estética",
  title: { before: "Dejá de perseguir turnos ", accent: "por mensaje." } as AccentTitle,
  subtitle:
    "Turneo ordena la agenda, los recordatorios, la caja y el stock de tu salón. Tus clientes reservan solos y vos te enterás de todo sin estar con el celular en la mano.",
  cta: "Quiero sumar mi salón",
  secondary: "Ver qué resuelve",
  highlights: ["Reservas online las 24 hs", "Recordatorios automáticos por email", "Funciona desde el navegador"],
};

export const PAINS = {
  eyebrow: "El día a día",
  title: { before: "¿Te ", accent: "suena?" } as AccentTitle,
  items: [
    { title: "Reservan y no aparecen.", detail: "El horario queda vacío y ya es tarde para ocuparlo.", href: "#ausencias" },
    { title: "Contestás mensajes todo el día.", detail: "Para dar un turno, moverlo o confirmar que sigue en pie.", href: "#reservas" },
    { title: "Cierra el día y no sabés cuánto entró.", detail: "Ni cuánto corresponde a cada profesional.", href: "#caja" },
    { title: "Te quedás sin producto en medio de un servicio.", detail: "Y te enterás con la clienta sentada.", href: "#insumos" },
  ],
};

export type ProblemId = "ausencias" | "reservas" | "caja" | "insumos" | "equipo";

export interface ProblemContent {
  id: ProblemId;
  eyebrow: string;
  title: AccentTitle;
  lead: string;
  points: string[];
  // Aclaración de lo que todavía no está disponible.
  note?: string;
}

// Un bloque por problema. El orden define la alternancia ink/cream.
export const PROBLEMAS: ProblemContent[] = [
  {
    id: "ausencias",
    eyebrow: "Clientes que no aparecen",
    title: { before: "Que el turno no ", accent: "se olvide." },
    lead: "El recordatorio sale solo. Nadie del equipo tiene que acordarse de mandarlo.",
    points: [
      "Recordatorio automático por email antes de cada turno.",
      "Si no puede ir, cancela o reprograma desde su link y el horario vuelve a quedar libre.",
      "Reactivación automática: a quien hace tiempo que no viene le llega un mensaje para volver. También el saludo de cumpleaños.",
    ],
    note: "Por WhatsApp hoy los mandás vos con un toque desde el panel. El envío automático: próximamente.",
  },
  {
    id: "reservas",
    eyebrow: "Mensajes todo el día",
    title: { before: "Reservan solos, ", accent: "a cualquier hora." },
    lead: "Tu salón toma turnos mientras atendés, a la noche y los domingos.",
    points: [
      "Eligen servicio, profesional y horario en la página de tu salón, las 24 hs.",
      "Solo ven horarios realmente libres. No hay que confirmar nada a mano.",
      "En «Mis turnos» ven, reprograman o cancelan sus reservas con su email, sin crear una cuenta.",
    ],
  },
  {
    id: "caja",
    eyebrow: "No saber cuánto entró",
    title: { before: "Los números del día, ", accent: "sin planilla." },
    lead: "La caja se arma con los turnos que se atendieron, no con lo que alguien se acordó de anotar.",
    points: [
      "Caja diaria con apertura y cierre, conectada a cada turno atendido.",
      "Cobros y señas registrados por medio de pago: efectivo, transferencia o tarjeta.",
      "Estadísticas y comisiones por profesional, y del salón en conjunto.",
    ],
    note: "Cobro online con Mercado Pago: próximamente.",
  },
  {
    id: "insumos",
    eyebrow: "Quedarte sin producto",
    title: { before: "El stock se descuenta ", accent: "solo." },
    lead: "Cada servicio sabe qué producto usa. Vos solo reponés cuando te avisa.",
    points: [
      "Cargás tus insumos y la receta de cada servicio: qué se usa y cuánto.",
      "Al atender un turno, el stock baja automáticamente.",
      "Cuando un insumo cae por debajo del mínimo que definiste, te llega el aviso.",
    ],
  },
  {
    id: "equipo",
    eyebrow: "Coordinar al equipo",
    title: { before: "Cada profesional con ", accent: "su agenda." },
    lead: "Todo el salón en un mismo calendario, y cada persona viendo solo lo que le toca.",
    points: [
      "Agenda por profesional, con vista de día o de semana.",
      "Cada profesional entra a su propio panel: sus turnos, su historial y sus comisiones.",
      "Permisos por módulo: definís qué puede ver, crear, editar o borrar el personal.",
    ],
  },
];

export const OWN_SITE = {
  eyebrow: "Incluido",
  title: { before: "Tu salón con ", accent: "su propia web." } as AccentTitle,
  lead: "Cada salón tiene su página pública, lista para poner en el perfil de Instagram. Se edita desde el panel, sin diseñador ni programador.",
  items: [
    { title: "Servicios", detail: "Con precio, duración y detalle." },
    { title: "Equipo", detail: "Cada profesional con sus próximos horarios." },
    { title: "Galería y videos", detail: "Tus trabajos, cargados por vos." },
    { title: "Reseñas", detail: "Las de tu salón, a la vista." },
    { title: "Reserva", detail: "El turno se toma ahí mismo." },
  ],
  demoLabel: "Ver una web en vivo",
};

// `comingSoon`: el bloque se muestra desenfocado con el rótulo "Próximamente"
// encima y solo se lee `hint`, una pista corta de lo que viene.
export interface RetentionItem {
  id: string;
  title: string;
  detail: string;
  comingSoon?: boolean;
  hint?: string;
}

export const RETENTION: { eyebrow: string; title: AccentTitle; items: RetentionItem[] } = {
  eyebrow: "Después del turno",
  title: { before: "Que vuelvan, y que ", accent: "te recomienden." },
  items: [
    {
      id: "ruleta",
      title: "Ruleta de fidelidad",
      detail: "Vos cargás los premios: un descuento, un adicional o un producto de regalo. Tu clienta gira una vez y se lleva su código.",
    },
    {
      id: "resenas",
      title: "Reseñas",
      detail: "Tus clientes dejan su reseña y vos elegís cuáles mostrar en tu web. Con un enlace directo para que también te califiquen en Google.",
    },
    {
      id: "smart-tags",
      title: "Smart Tags",
      detail: "Etiquetas NFC o QR para el mostrador o el espejo. Acercan el celular y se abre la reserva, la reseña o tu Instagram.",
      comingSoon: true,
      hint: "Algo para tu mostrador: se acerca el celular y listo.",
    },
  ],
};

export const TRUST = {
  eyebrow: "Garantías",
  title: { before: "Hecho para que ", accent: "no falle." } as AccentTitle,
  items: [
    { title: "Sin turnos dobles", detail: "Cada horario es único por profesional. No se pueden superponer dos reservas." },
    { title: "Datos aislados por negocio", detail: "Tu información nunca se mezcla con la de otro salón de la plataforma." },
    { title: "Cada persona, su acceso", detail: "Quien administra, el personal y cada profesional entran con su propia cuenta y sus propios permisos." },
    { title: "Privacidad atendida", detail: "Tus clientes pueden pedir la baja de sus datos y el pedido te llega al panel." },
  ],
};

export const FAQ = {
  eyebrow: "Preguntas frecuentes",
  title: { before: "Antes de ", accent: "sumarte" } as AccentTitle,
  help: "¿Tenés otra duda? Escribinos y te respondemos.",
  helpCta: "Preguntar por WhatsApp",
  items: [
    {
      q: "¿Tengo que instalar algo?",
      a: "No. Turneo funciona desde el navegador, en el celular o en la computadora. Tus clientes tampoco instalan nada: reservan desde la página de tu salón.",
    },
    {
      q: "¿Mis clientes tienen que crear una cuenta?",
      a: "No. Reservan con su nombre, teléfono y email. Para ver, reprogramar o cancelar sus turnos entran a «Mis turnos» con ese mismo email.",
    },
    {
      q: "¿Cómo les llegan los recordatorios?",
      a: "Por email, de forma automática. Y si preferís WhatsApp, lo mandás vos con un toque: el panel abre el chat con tu clienta y el mensaje ya escrito, solo queda enviarlo. El envío automático por WhatsApp está en preparación: próximamente.",
    },
    {
      q: "¿Se puede cobrar la seña online?",
      a: "Todavía no: el cobro online con Mercado Pago está próximamente. Hoy registrás las señas y los cobros en la caja, con el medio de pago que uses.",
    },
    {
      q: "¿Sirve si trabajo por mi cuenta?",
      a: "Sí. Funciona igual con una sola agenda que con varias profesionales, cada una con sus horarios y servicios.",
    },
    {
      q: "¿Cómo empiezo?",
      a: "Nos escribís por WhatsApp, nos contás de tu salón y coordinamos el alta de tu cuenta.",
    },
  ],
};

export const CLOSING = {
  eyebrow: "Sumate",
  title: { before: "¿Le damos turnos a ", accent: "tu salón?" } as AccentTitle,
  lead: "Escribinos contándonos de tu salón y coordinamos el alta de tu cuenta.",
  cta: "Escribinos por WhatsApp",
};
