import type { APIRequestContext } from "@playwright/test";
import { runSql } from "./db.mjs";
import { PROXY_SECRET } from "./env.mjs";
import { API_URL, WEB_URL } from "./ports.mjs";
import {
  AUTOMATION_RULES, CUSTOMER_NOTES, DEMO_PASSWORD, FIRST_NAMES_F, FIRST_NAMES_M, INSUMOS, LAST_NAMES,
  LOYALTY_PRIZES, MANUAL_OUT, PRODUCTS, PROFESSIONALS, RECIPES, REVIEWS, SERVICES, SITE_CONFIG, STAFF_EMAIL,
  type ServiceSeed,
} from "./data";

// Siembra del salón de muestra. Todo entra por la API real (los mismos
// endpoints que usa el panel), con dos salvedades que la API no permite:
//
//  1. Turnos en el pasado. POST /api/timeslots rechaza fechas pasadas, así que
//     todo se crea corrido hacia adelante (HISTORY_WEEKS + 1 semanas) y al
//     final un UPDATE lo devuelve a su fecha real. Así la semana actual queda
//     completa y hay meses de historial para estadísticas, caja y clientes.
//  2. Fechas de registro. CreatedAt/OpenedAt los pone el servidor con la hora
//     de la corrida; se reacomodan por SQL para que coincidan con ese historial.
//
// La siembra es determinística (misma semilla => mismos datos), salvo por la
// fecha en que se corre.

const HISTORY_WEEKS = Number(process.env.LANDING_HISTORY_WEEKS ?? 22);
const FUTURE_WEEKS = 4;
const SHIFT_DAYS = (HISTORY_WEEKS + 1) * 7;
const DAY_MS = 86_400_000;
const AR_OFFSET_MS = 3 * 3_600_000; // Argentina = UTC-3, sin horario de verano
const OPENING_CASH = 30_000;
const MIN_DAYS_BETWEEN_VISITS = 14;

export interface SeedResult {
  professional: { email: string; password: string; name: string };
  heroProfessionalId: number;
  heroProfessionalName: string;
  featuredCustomer: { id: number; name: string };
  misTurnosEmail: string;
  staffEmail: string;
  bookingServiceTitle: string;
  bookingProfessionalName: string;
  counts: Record<string, number>;
  skipped: string[];
}

// ── utilidades ──────────────────────────────────────────────────────────────

// PRNG chico y determinístico (mulberry32).
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20261005);
const chance = (p: number) => random() < p;
const randomInt = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];

function pickWeighted<T>(items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [item, weight] of items) {
    roll -= weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1][0];
}

async function mapPool<T, R>(items: readonly T[], size: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

// Las fechas del negocio son "hora de pared" de Argentina. Se manejan como
// Date cuyos campos UTC guardan esa hora, para no depender del huso de la máquina.
const wallNow = () => new Date(Date.now() - AR_OFFSET_MS);
const wallIso = (date: Date) => date.toISOString().slice(0, 19);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

function startOfWeek(date: Date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return addDays(day, -((day.getUTCDay() + 6) % 7));
}

const slugify = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");

const formatPrice = (amount: number) => amount.toLocaleString("es-AR");

// ── cliente HTTP ────────────────────────────────────────────────────────────

let requestCount = 0;

// Los endpoints públicos tienen rate limit por IP (20 reservas/min). La API
// acepta la IP del visitante que le informa el proxy (X-Client-IP + secreto,
// ver ClientIpResolver.cs): se rota una IP privada cada pocas llamadas.
function clientIpHeaders(): Record<string, string> {
  const n = Math.floor(requestCount++ / 8);
  return { "X-Client-IP": `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`, "X-Proxy-Secret": PROXY_SECRET };
}

function createApi(token: string) {
  return async function api<T = any>(method: string, path: string, body?: unknown, anonymous = false): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(anonymous ? {} : { Authorization: `Bearer ${token}` }),
        ...clientIpHeaders(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} falló: ${res.status} ${text.slice(0, 300)}`);
    return (text ? JSON.parse(text) : undefined) as T;
  };
}

// Servicios, profesionales, productos, insumos, reseñas y siteconfig tienen
// GET cacheado en el proxy de Next.js: se escriben a través del proxy para que
// dispare revalidateTag() y el sitio no muestre datos de una corrida anterior.
function createProxy(request: APIRequestContext) {
  return async function proxy<T = any>(method: "POST" | "PUT" | "DELETE", path: string, data?: unknown): Promise<T> {
    const res = await request.fetch(`${WEB_URL}${path}`, { method, data });
    const text = await res.text();
    if (!res.ok()) throw new Error(`${method} ${path} (proxy) falló: ${res.status()} ${text.slice(0, 300)}`);
    return (text ? JSON.parse(text) : undefined) as T;
  };
}

// ── modelo en memoria ───────────────────────────────────────────────────────

interface Customer {
  index: number;
  name: string;
  phone: string;
  email: string;
  male: boolean;
  proIndex: number;
  joinedWeek: number;
  lastWeek: number; // última semana en la que reserva (clientes que dejaron de venir)
  lastDay: number; // día de su última visita agendada
  profileId?: number;
  busyDays: Set<number>;
  bookings: Appointment[];
}

interface Appointment {
  proIndex: number;
  week: number;
  dayIndex: number; // días desde el lunes de la primera semana sembrada
  start: Date; // fecha real (hora de pared)
  end: Date;
  service: ServiceSeed;
  booked: boolean;
  customer?: Customer;
  slotId?: number;
  bookingId?: number;
  status?: "Pending" | "Confirmed" | "Cancelled";
  productSale?: [name: string, price: number, id: number];
  total?: number;
}

function occupancyFor(week: number) {
  // El salón viene creciendo: de media agenda ocupada hace cinco meses a casi llena hoy.
  if (week < 0) return 0.45 + 0.27 * (1 - -week / HISTORY_WEEKS);
  return [0.93, 0.85, 0.65, 0.45, 0.25][week] ?? 0.2;
}

// Arma la agenda de un profesional para un día: turnos consecutivos con la
// duración del servicio, con algún hueco y la pausa del mediodía.
function planDay(proIndex: number, week: number, dayIndex: number, day: Date, out: Appointment[]) {
  const pro = PROFESSIONALS[proIndex];
  const weekday = day.getUTCDay();
  const hours = weekday === 6 ? pro.saturday : pro.weekdays;
  if (!hours || weekday === 0) return;
  // En el historial, cada tanto alguien falta; nunca en la semana actual ni en las próximas.
  if (week < 0 && chance(0.05)) return;

  const occupancy = occupancyFor(week);
  const closing = addMinutes(day, hours[1] * 60);
  let cursor = addMinutes(day, hours[0] * 60 + (chance(0.3) ? 30 : 0));

  while (cursor < closing) {
    const hour = cursor.getUTCHours();
    if (weekday !== 6 && hour === 13) { cursor = addMinutes(day, 14 * 60); continue; }

    const offered = pro.services.map(([slug, weight]) => [SERVICES.find((s) => s.slug === slug)!, weight] as const);
    const remaining = (closing.getTime() - cursor.getTime()) / 60_000;
    const fitting = offered.filter(([service]) => service.minutes <= remaining);
    if (fitting.length === 0) break;

    const service = pickWeighted(fitting);
    const booked = chance(occupancy);
    // En el historial solo interesan los turnos que se ocuparon.
    if (booked || week >= 0) {
      out.push({ proIndex, week, dayIndex, start: cursor, end: addMinutes(cursor, service.minutes), service, booked });
    }
    cursor = addMinutes(cursor, service.minutes + (chance(0.18) ? 30 : 0));
  }
}

function buildCustomers(appointments: Appointment[]): Customer[] {
  const names = new Set<string>();
  const customers: Customer[] = [];

  PROFESSIONALS.forEach((pro, proIndex) => {
    const booked = appointments.filter((a) => a.proIndex === proIndex && a.booked).length;
    // Un cliente vuelve cada 4 a 6 semanas: unas 5 visitas en el período sembrado.
    const size = Math.max(12, Math.ceil(booked / 5));
    const mostlyMale = pro.key === "martin";

    for (let i = 0; i < size; i++) {
      const male = mostlyMale ? chance(0.85) : chance(0.04);
      let name = "";
      do {
        name = `${pick(male ? FIRST_NAMES_M : FIRST_NAMES_F)} ${pick(LAST_NAMES)}`;
      } while (names.has(name));
      names.add(name);

      const index = customers.length;
      // Dos tercios ya eran clientes al empezar el período; el resto se suma después.
      const joinedWeek = chance(0.66) ? -HISTORY_WEEKS : -randomInt(2, HISTORY_WEEKS - 1);
      // Algunos dejaron de venir hace más de dos meses (alimentan las automatizaciones).
      const lastWeek = chance(0.09) ? Math.min(-10, joinedWeek + randomInt(2, 8)) : FUTURE_WEEKS;
      customers.push({
        index, name, male, proIndex, joinedWeek, lastWeek,
        phone: `11 5555-${String(1000 + index).padStart(4, "0")}`,
        email: `${slugify(name)}@example.com`,
        lastDay: -1000, busyDays: new Set(), bookings: [],
      });
    }
  });
  return customers;
}

function assignCustomers(appointments: Appointment[], customers: Customer[]) {
  const byPro = PROFESSIONALS.map((_, proIndex) => customers.filter((c) => c.proIndex === proIndex));

  for (const appointment of appointments) {
    if (!appointment.booked) continue;
    // Casi siempre vuelven con su profesional; cada tanto prueban con otro.
    const pool = chance(0.88) ? byPro[appointment.proIndex] : customers;
    let chosen: Customer | undefined;
    for (let attempt = 0; attempt < 40 && !chosen; attempt++) {
      const candidate = pick(pool);
      const active = candidate.joinedWeek <= appointment.week && appointment.week <= candidate.lastWeek;
      // Nadie vuelve antes de las dos semanas.
      if (active && appointment.dayIndex - candidate.lastDay >= MIN_DAYS_BETWEEN_VISITS) chosen = candidate;
    }
    if (!chosen) { appointment.booked = false; continue; }
    chosen.lastDay = appointment.dayIndex;
    chosen.busyDays.add(appointment.dayIndex);
    chosen.bookings.push(appointment);
    appointment.customer = chosen;
  }
}

const BOOKING_MESSAGES = [
  "Quiero el mismo tono que la última vez.",
  "Llego unos minutos antes, ¿puede ser?",
  "Es para un evento el sábado.",
  "Traigo una foto de referencia.",
  "Tengo el pelo teñido de negro hace un año.",
  "¿Puedo pagar por transferencia?",
];

// ── siembra ─────────────────────────────────────────────────────────────────

export async function seedDemo(adminToken: string, adminRequest: APIRequestContext): Promise<SeedResult> {
  const api = createApi(adminToken);
  const proxy = createProxy(adminRequest);
  const skipped: string[] = [];
  const log = (message: string) => console.log(`[landing-seed] ${message}`);

  const now = wallNow();
  const thisMonday = startOfWeek(now);
  const firstMonday = addDays(thisMonday, -HISTORY_WEEKS * 7);

  // 1. Datos del negocio y catálogo
  await proxy("PUT", "/api/siteconfig", SITE_CONFIG);

  // Una migración deja cinco trabajos de ejemplo en la galería (con rutas de
  // imagen que no existen): se quitan para que el sitio muestre su estado sin fotos.
  for (const item of await api<{ id: number }[]>("GET", "/api/gallery", undefined, true)) {
    await proxy("DELETE", `/api/gallery/${item.id}`);
  }

  const serviceIds = new Map<string, number>();
  for (const [order, service] of SERVICES.entries()) {
    const created = await proxy<{ id: number }>("POST", "/api/services", {
      title: service.title, slug: service.slug, price: formatPrice(service.price), duration: `${service.minutes} min`,
      imageUrl: "", description: service.description, details: service.details, category: service.category,
      bufferMinutes: 0, color: service.color, isActive: true, order,
    });
    serviceIds.set(service.slug, created.id);
  }

  const insumoIds = new Map<string, number>();
  for (const [order, insumo] of INSUMOS.entries()) {
    const created = await proxy<{ id: number }>("POST", "/api/insumos", {
      name: insumo.name, stock: 500, lowStockThreshold: insumo.threshold, unitCost: insumo.unitCost,
      category: insumo.category, isActive: true, order,
    });
    insumoIds.set(insumo.key, created.id);
  }
  for (const [slug, items] of Object.entries(RECIPES)) {
    await api("PUT", `/api/services/${serviceIds.get(slug)}/recipe`, {
      items: items.map(([key, quantity]) => ({ insumoId: insumoIds.get(key), quantity })),
    });
  }

  const products: [name: string, price: number, id: number][] = [];
  for (const [order, [name, price]] of PRODUCTS.entries()) {
    const created = await proxy<{ id: number }>("POST", "/api/products", { name, price, isActive: true, order });
    products.push([name, price, created.id]);
  }

  const professionalIds: number[] = [];
  for (const [order, pro] of PROFESSIONALS.entries()) {
    const schedule = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
      const hours = dayOfWeek === 6 ? pro.saturday : pro.weekdays;
      const enabled = dayOfWeek !== 0 && hours !== null;
      const [start, end] = hours ?? pro.weekdays;
      return { dayOfWeek, start: `${String(start).padStart(2, "0")}:00`, end: `${String(end).padStart(2, "0")}:00`, enabled };
    });
    const created = await proxy<{ id: number }>("POST", "/api/professionals", {
      firstName: pro.firstName, lastName: pro.lastName, photoUrl: "", calendarColor: pro.color,
      specialty: pro.specialty, bio: pro.bio, yearsOfExperience: pro.years, skills: pro.skills,
      commission: pro.commission, schedule: JSON.stringify(schedule), isActive: true, order,
      serviceIds: pro.services.map(([slug]) => serviceIds.get(slug)),
    });
    professionalIds.push(created.id);
    await api("POST", "/api/auth/professional-account", {
      professionalId: created.id, email: pro.email, username: null, password: DEMO_PASSWORD,
    });
  }
  log(`catálogo: ${SERVICES.length} servicios, ${INSUMOS.length} insumos, ${PRODUCTS.length} productos, ${PROFESSIONALS.length} profesionales`);

  // 2. Agenda: semanas de historial + la actual + las próximas
  const appointments: Appointment[] = [];
  for (let week = -HISTORY_WEEKS; week <= FUTURE_WEEKS; week++) {
    for (let weekday = 0; weekday < 6; weekday++) {
      const dayIndex = (week + HISTORY_WEEKS) * 7 + weekday;
      const day = addDays(firstMonday, dayIndex);
      PROFESSIONALS.forEach((_, proIndex) => planDay(proIndex, week, dayIndex, day, appointments));
    }
  }
  const customers = buildCustomers(appointments);
  assignCustomers(appointments, customers);

  // Clientas que protagonizan capturas: la de la ficha de cliente (la más
  // habitual de la colorista) y la del portal "Mis turnos".
  const hero = PROFESSIONALS.findIndex((p) => p.key === "valentina");
  const featured = [...customers]
    .filter((c) => c.proIndex === hero && c.lastWeek === FUTURE_WEEKS)
    .sort((a, b) => b.bookings.length - a.bookings.length)[0];
  const upcomingOf = (c: Customer) => c.bookings.filter((b) => b.start > now).sort((a, b) => a.start.getTime() - b.start.getTime());
  // El portal muestra el campo "service" tal cual se guarda (el slug): se elige
  // a alguien cuyo próximo turno sea un servicio de una sola palabra.
  const portal = [...customers]
    .filter((c) => c !== featured && upcomingOf(c)[0]?.service.slug === "balayage")
    .sort((a, b) => upcomingOf(b).length - upcomingOf(a).length || b.bookings.length - a.bookings.length)[0]
    ?? [...customers].filter((c) => c !== featured).sort((a, b) => upcomingOf(b).length - upcomingOf(a).length)[0];
  const protectedBookings = new Set<Appointment>([...upcomingOf(portal), ...upcomingOf(featured)]);

  // 3. Clientes (CRM)
  const today = wallIso(now).slice(5, 10);
  await mapPool(customers, 8, async (customer) => {
    const visits = customer.bookings.length;
    // A la clienta de la ficha y a otra más les toca cumplir años hoy (regla de cumpleaños).
    const birthdayToday = customer === featured || customer.index === 7;
    const birthday = birthdayToday
      ? `${randomInt(1984, 1999)}-${today}`
      : `${randomInt(1972, 2004)}-${String(randomInt(1, 12)).padStart(2, "0")}-${String(randomInt(1, 28)).padStart(2, "0")}`;
    const profile = await api<{ id: number }>("POST", "/api/reminders/customers", {
      phone: customer.phone, name: customer.name, email: customer.email,
      notes: customer === featured
        ? "Rubio frío, matizar siempre. Fórmula: 9.1 + 10.01 con 20 vol. Prefiere turnos a la mañana."
        : visits >= 3 && chance(0.6) ? pick(CUSTOMER_NOTES) : null,
      birthday: chance(0.8) || birthdayToday ? birthday : null,
      instagram: chance(0.45) || customer === featured ? `@${slugify(customer.name)}` : null,
      favoriteProfessionalId: visits >= 2 ? professionalIds[customer.proIndex] : null,
      photoUrls: null,
    });
    customer.profileId = profile.id;
  });
  log(`${customers.length} clientes`);

  // 4. Turnos y reservas (corridos SHIFT_DAYS hacia adelante, ver nota arriba)
  await mapPool(appointments, 8, async (appointment) => {
    const created = await api<{ slot: { id: number } }>("POST", "/api/timeslots", {
      startDateTime: wallIso(addDays(appointment.start, SHIFT_DAYS)),
      endDateTime: wallIso(addDays(appointment.end, SHIFT_DAYS)),
      professionalId: professionalIds[appointment.proIndex],
    });
    appointment.slotId = created.slot.id;
  });

  const createBooking = async (appointment: Appointment, customer: Customer) => {
    const created = await api<{ booking: { id: number } }>("POST", "/api/bookings", {
      timeSlotId: appointment.slotId, customerName: customer.name, customerPhone: customer.phone, email: customer.email,
      subject: appointment.service.title, service: appointment.service.slug,
      professionalId: professionalIds[appointment.proIndex],
      message: chance(0.1) ? pick(BOOKING_MESSAGES) : null, acceptedTerms: true,
    }, true);
    return created.booking.id;
  };

  const bookedAppointments = appointments.filter((a) => a.booked);
  for (const appointment of bookedAppointments) {
    const past = appointment.end <= now;
    const roll = random();
    if (past) appointment.status = roll < 0.06 ? "Cancelled" : "Confirmed";
    else if (roll < 0.04 && !protectedBookings.has(appointment)) appointment.status = "Cancelled";
    else appointment.status = roll < [0.74, 0.6, 0.48, 0.38, 0.3][Math.max(appointment.week, 0)] ? "Confirmed" : "Pending";
    if (appointment.status === "Confirmed" && past && chance(0.14)) appointment.productSale = pick(products);
  }

  await mapPool(bookedAppointments, 8, async (appointment) => {
    appointment.bookingId = await createBooking(appointment, appointment.customer!);
    if (appointment.status === "Confirmed") await api("PATCH", `/api/bookings/${appointment.bookingId}/confirm`);
    if (appointment.status === "Cancelled") await api("POST", `/api/bookings/${appointment.bookingId}/cancel`, undefined, true);
  });

  // Un turno cancelado libera el horario: la mitad de las veces lo toma otra clienta.
  const rebooked: Appointment[] = [];
  for (const appointment of bookedAppointments.filter((a) => a.status === "Cancelled")) {
    if (!chance(0.5)) continue;
    const replacement = customers.find((c) =>
      c.proIndex === appointment.proIndex && c !== appointment.customer && !c.busyDays.has(appointment.dayIndex) &&
      c.joinedWeek <= appointment.week && appointment.week <= c.lastWeek);
    if (!replacement) continue;
    replacement.busyDays.add(appointment.dayIndex);
    const copy: Appointment = { ...appointment, customer: replacement, status: appointment.end <= now ? "Confirmed" : "Pending", productSale: undefined };
    replacement.bookings.push(copy);
    rebooked.push(copy);
  }
  await mapPool(rebooked, 8, async (appointment) => {
    appointment.bookingId = await createBooking(appointment, appointment.customer!);
    if (appointment.status === "Confirmed") await api("PATCH", `/api/bookings/${appointment.bookingId}/confirm`);
  });
  const allBookings = [...bookedAppointments, ...rebooked];
  log(`${appointments.length} turnos, ${allBookings.length} reservas`);

  // 5. Detalle de lo realizado en cada turno ya atendido (servicio, venta de
  // producto e insumos de la receta en las últimas dos semanas)
  const recentFrom = addDays(now, -14);
  const detailItems = (appointment: Appointment, withInsumos: boolean) => {
    const items: Record<string, unknown>[] = [{
      itemType: "Service", serviceId: serviceIds.get(appointment.service.slug), name: appointment.service.title,
      quantity: 1, unitPrice: appointment.service.price,
    }];
    appointment.total = appointment.service.price;
    if (appointment.productSale) {
      const [name, price, id] = appointment.productSale;
      items.push({ itemType: "Product", productId: id, name, quantity: 1, unitPrice: price });
      appointment.total += price;
    }
    if (withInsumos) {
      for (const [key, quantity] of RECIPES[appointment.service.slug] ?? []) {
        const insumo = INSUMOS.find((i) => i.key === key)!;
        items.push({ itemType: "Insumo", insumoId: insumoIds.get(key), isSale: false, name: insumo.name, quantity, unitPrice: 0 });
      }
    }
    return { photoUrlsBefore: null, photoUrlsAfter: null, items };
  };

  const attended = allBookings.filter((a) => a.status === "Confirmed" && a.end <= now);
  await mapPool(attended, 8, (appointment) =>
    api("PUT", `/api/bookings/${appointment.bookingId}/detail`, detailItems(appointment, appointment.start >= recentFrom)));

  // 6. Caja: una sesión por día trabajado, en orden. La API solo admite una
  // caja abierta a la vez, así que cada día se abre, se cobra y se cierra.
  const byDay = new Map<number, Appointment[]>();
  for (const appointment of attended) {
    byDay.set(appointment.dayIndex, [...(byDay.get(appointment.dayIndex) ?? []), appointment]);
  }
  const workedDays = [...byDay.keys()].sort((a, b) => a - b);
  // La caja que queda abierta es la del último día con movimiento suficiente
  // (hoy, si la corrida es de tarde; si no, el día hábil anterior).
  const openDay = [...workedDays].reverse().find((day) => byDay.get(day)!.length >= 8) ?? workedDays[workedDays.length - 1];

  let movementCount = 0;
  for (const day of workedDays) {
    if (day > openDay) continue;
    await api("POST", "/api/caja/open", { openingCashBalance: OPENING_CASH });
    let expectedCash = OPENING_CASH;
    const dayBookings = byDay.get(day)!;

    const charges = await mapPool(dayBookings, 6, async (appointment) => {
      const method = chance(0.42) ? "Cash" : "Transfer";
      const movement = await api<{ id: number }>("POST", "/api/caja/movements", {
        type: "Charge", method, amount: appointment.total, bookingId: appointment.bookingId,
        description: `${appointment.customer!.name} · ${appointment.service.title}`,
      });
      return { appointment, method, id: movement.id };
    });
    movementCount += charges.length;
    for (const charge of charges) if (charge.method === "Cash") expectedCash += charge.appointment.total!;

    const expenses = day === openDay ? 2 : chance(0.45) ? 1 : 0;
    for (let i = 0; i < expenses; i++) {
      const amount = randomInt(7, 48) * 500;
      await api("POST", "/api/caja/movements", { type: "ManualOut", method: "Cash", amount, description: pick(MANUAL_OUT) });
      expectedCash -= amount;
      movementCount++;
    }

    // Una devolución deja saldo pendiente en el turno: solo en la caja abierta y en las de hace más de un mes.
    if (day === openDay || (openDay - day > 35 && chance(0.06))) {
      const charge = pick(charges);
      const amount = Math.round(charge.appointment.total! * 0.2 / 500) * 500;
      await api("POST", "/api/caja/movements", {
        type: "Refund", method: charge.method, amount, bookingId: charge.appointment.bookingId,
        refundOfMovementId: charge.id, description: `Ajuste de precio · ${charge.appointment.customer!.name}`,
      });
      if (charge.method === "Cash") expectedCash -= amount;
      movementCount++;
    }

    if (day === openDay) {
      // Señas de turnos que todavía no se atendieron: quedan con saldo pendiente.
      const upcoming = allBookings
        .filter((a) => a.status === "Confirmed" && a.start > now && a.service.price >= 40_000)
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .slice(0, 4);
      for (const appointment of upcoming) {
        await api("PUT", `/api/bookings/${appointment.bookingId}/detail`, detailItems(appointment, false));
        await api("POST", "/api/caja/movements", {
          type: "Deposit", method: "Transfer", amount: Math.round(appointment.service.price * 0.3 / 500) * 500,
          bookingId: appointment.bookingId, description: `Seña · ${appointment.customer!.name} · ${appointment.service.title}`,
        });
        movementCount++;
      }
      break;
    }

    // Casi siempre cierra exacto; cada tanto sobra o falta algo de cambio.
    const difference = chance(0.8) ? 0 : pick([-1000, -500, -200, 300, 500]);
    await api("POST", "/api/caja/close", {
      closingCashCounted: Math.max(0, expectedCash + difference),
      notes: difference < 0 ? "Faltante de cambio, se revisa mañana." : null,
    });
  }
  log(`caja: ${workedDays.length} días, ${movementCount} movimientos`);

  // 7. Todo vuelve a su fecha real
  backdate(openDay, firstMonday);

  // 8. Stock final de insumos (la carga de detalles lo fue descontando)
  for (const [order, insumo] of INSUMOS.entries()) {
    await proxy("PUT", `/api/insumos/${insumoIds.get(insumo.key)}`, {
      name: insumo.name, stock: insumo.stock, lowStockThreshold: insumo.threshold, unitCost: insumo.unitCost,
      category: insumo.category, isActive: true, order,
    });
  }

  // 9. Automatizaciones: se crean y se prueban con el historial ya en su lugar
  let executions = 0;
  for (const rule of AUTOMATION_RULES) {
    const created = await api<{ id: number }>("POST", "/api/automationrules", rule);
    if (rule.isActive) executions += (await api<{ remindersCreated: number }>("POST", `/api/automationrules/${created.id}/run-now`)).remindersCreated;
  }

  // 10. Ruleta de fidelización
  for (const [order, prize] of LOYALTY_PRIZES.entries()) {
    await api("POST", "/api/loyalty-roulette/prizes", { ...prize, isActive: true, order });
  }
  const regulars = [...customers].sort((a, b) => b.bookings.length - a.bookings.length);
  const spins: { code: string }[] = [];
  for (const customer of regulars.slice(4, 26)) {
    spins.push(await api("POST", "/api/loyalty-roulette/spin", { customerName: customer.name, whatsApp: `54911${customer.phone.replace(/\D/g, "").slice(2)}` }, true));
  }
  for (const spin of spins.filter((_, i) => i % 3 === 1)) {
    await api("POST", "/api/loyalty-roulette/spins/redeem", { code: spin.code });
  }

  // 11. Reseñas (entran por el formulario público y el admin las aprueba)
  for (const [order, review] of REVIEWS.entries()) {
    const created = await api<{ id: number }>("POST", "/api/reviews", { authorName: review.authorName, rating: review.rating, comment: review.comment }, true);
    if (review.approved) {
      await proxy("PUT", `/api/reviews/${created.id}`, { authorName: review.authorName, rating: review.rating, comment: review.comment, isApproved: true, order });
    }
  }

  // 12. Recepción: cuenta Staff con permisos acotados, y una profesional con acceso a parte del panel
  const staff = await api<{ id: number }>("POST", "/api/permissions/staff", { email: STAFF_EMAIL, password: DEMO_PASSWORD, username: "recepcion" });
  const grant = (module: string, canView: boolean, canCreate: boolean, canEdit: boolean, canDelete: boolean) =>
    ({ module, canView, canCreate, canEdit, canDelete });
  await api("PUT", `/api/permissions/staff/${staff.id}`, {
    permissions: [
      grant("Turnos", true, true, true, false), grant("Clientes", true, true, true, false),
      grant("Caja", true, true, false, false), grant("Productos", true, false, false, false),
      grant("Servicios", true, false, false, false), grant("Insumos", true, false, true, false),
      grant("Resenas", true, false, false, false),
    ],
  });
  const team = await api<{ id: number; accountUserId: number | null }[]>("GET", "/api/professionals/all");
  const camilaUserId = team.find((p) => p.id === professionalIds[1])?.accountUserId;
  if (camilaUserId) {
    await api("PUT", `/api/permissions/staff/${camilaUserId}`, {
      permissions: [grant("Turnos", true, true, true, false), grant("Clientes", true, false, true, false), grant("Insumos", true, false, false, false)],
    });
  } else {
    skipped.push("permisos de panel para una profesional (la API no devolvió su usuario)");
  }

  redateExtras();

  const counts = {
    servicios: SERVICES.length, profesionales: PROFESSIONALS.length, clientes: customers.length,
    turnos: appointments.length, reservas: allBookings.length, movimientosDeCaja: movementCount,
    insumos: INSUMOS.length, productos: PRODUCTS.length, resenas: REVIEWS.length,
    automatizaciones: AUTOMATION_RULES.length, enviosDeAutomatizaciones: executions,
    premiosDeRuleta: LOYALTY_PRIZES.length, girosDeRuleta: spins.length,
  };
  log(JSON.stringify(counts));

  return {
    professional: { email: PROFESSIONALS[hero].email, password: DEMO_PASSWORD, name: `${PROFESSIONALS[hero].firstName} ${PROFESSIONALS[hero].lastName}` },
    heroProfessionalId: professionalIds[hero],
    heroProfessionalName: `${PROFESSIONALS[hero].firstName} ${PROFESSIONALS[hero].lastName}`,
    featuredCustomer: { id: featured.profileId!, name: featured.name },
    misTurnosEmail: portal.email,
    staffEmail: STAFF_EMAIL,
    bookingServiceTitle: "Color completo",
    bookingProfessionalName: `${PROFESSIONALS[hero].firstName} ${PROFESSIONALS[hero].lastName}`,
    counts,
    skipped,
  };
}

// ── SQL: lo que la API no permite fechar ────────────────────────────────────

// Todas las columnas son "timestamp without time zone": los turnos guardan hora
// de Argentina y los CreatedAt/OpenedAt, UTC (de ahí los +3 horas).
function backdate(openDayIndex: number, firstMonday: Date) {
  const openDate = wallIso(addDays(firstMonday, openDayIndex)).slice(0, 10);
  runSql(`
    BEGIN;

    -- En dos pasos (ida a un rango lejano y vuelta): hay un índice único por
    -- profesional + inicio, y un corrimiento directo choca fila contra fila.
    UPDATE "TimeSlots"
       SET "StartDateTime" = "StartDateTime" - interval '${SHIFT_DAYS + 20_000} days',
           "EndDateTime"   = "EndDateTime"   - interval '${SHIFT_DAYS + 20_000} days';
    UPDATE "TimeSlots"
       SET "StartDateTime" = "StartDateTime" + interval '20000 days',
           "EndDateTime"   = "EndDateTime"   + interval '20000 days';

    -- Cada reserva se hizo entre 1 y 9 días antes del turno, y nunca en el futuro.
    UPDATE "Bookings" b
       SET "CreatedAt" = LEAST(
             ts."StartDateTime" + interval '3 hours' - make_interval(hours => 20 + (b."Id" * 37) % 190),
             (now() AT TIME ZONE 'utc') - make_interval(mins => 15 + (b."Id" * 53) % 5600))
      FROM "TimeSlots" ts
     WHERE ts."Id" = b."TimeSlotId";

    UPDATE "Bookings"
       SET "TermsAcceptedAt" = "CreatedAt",
           "CancelledAt" = CASE WHEN "CancelledAt" IS NULL THEN NULL
                                ELSE LEAST("CreatedAt" + interval '26 hours', now() AT TIME ZONE 'utc') END;

    -- Caja: la pantalla muestra CreatedAt/OpenedAt tal cual llegan (formatDateTime en
    -- admin/caja/page.tsx), sin pasarlos de UTC a hora local. Para que la captura muestre
    -- el horario real del salón, los movimientos de caja se fechan en hora de Argentina.
    -- Cobros y devoluciones: al terminar el turno.
    UPDATE "CajaMovements" m
       SET "CreatedAt" = ts."EndDateTime" + make_interval(mins => 2 + (m."Id" * 7) % 14)
      FROM "Bookings" b
      JOIN "TimeSlots" ts ON ts."Id" = b."TimeSlotId"
     WHERE b."Id" = m."BookingId" AND m."Type" IN ('Charge', 'Refund');

    -- Cada caja abre a la mañana del día de sus cobros y cierra después del último.
    WITH days AS (
      SELECT "CajaSessionId" AS id, min("CreatedAt") AS first_charge, max("CreatedAt") AS last_charge
        FROM "CajaMovements" WHERE "Type" = 'Charge' GROUP BY 1
    )
    UPDATE "CajaSessions" s
       SET "OpenedAt" = date_trunc('day', days.first_charge) + interval '8 hours 40 minutes'
                        + make_interval(mins => (s."Id" * 11) % 25),
           "ClosedAt" = CASE WHEN s."ClosedAt" IS NULL THEN NULL
                             ELSE days.last_charge + make_interval(mins => 12 + (s."Id" * 5) % 30) END
      FROM days WHERE days.id = s."Id";

    -- Gastos y señas: repartidos durante el día de su caja, nunca después de ahora.
    UPDATE "CajaMovements" m
       SET "CreatedAt" = LEAST(s."OpenedAt" + make_interval(mins => 50 + (m."Id" * 97) % 420),
                               (now() AT TIME ZONE 'utc') - interval '3 hours' - make_interval(mins => 3 + (m."Id" * 13) % 40))
      FROM "CajaSessions" s
     WHERE s."Id" = m."CajaSessionId" AND m."Type" IN ('ManualIn', 'ManualOut', 'Deposit');

    -- Cada cliente figura desde poco antes de su primera reserva.
    UPDATE "CustomerProfiles" c
       SET "CreatedAt" = first.created - interval '2 hours'
      FROM (SELECT "CustomerPhone" AS phone, min("CreatedAt") AS created FROM "Bookings" GROUP BY 1) first
     WHERE first.phone = c."Phone";

    COMMIT;
  `);
  // Sanidad: la caja abierta tiene que ser la del día elegido.
  const opened = runSql(`SELECT to_char("OpenedAt", 'YYYY-MM-DD') FROM "CajaSessions" WHERE "ClosedAt" IS NULL;`).trim();
  if (opened && opened !== openDate) throw new Error(`La caja abierta quedó fechada ${opened}, se esperaba ${openDate}`);
}

// Reseñas, giros de ruleta y envíos de automatizaciones repartidos en las últimas semanas.
function redateExtras() {
  runSql(`
    BEGIN;
    UPDATE "Reviews" SET "CreatedAt" = (now() AT TIME ZONE 'utc') - make_interval(days => 2 + ("Id" * 5) % 40, hours => ("Id" * 7) % 9);
    UPDATE "LoyaltySpins"
       SET "SpunAt" = (now() AT TIME ZONE 'utc') - make_interval(days => ("Id" * 3) % 19, hours => 1 + ("Id" * 5) % 8),
           "ExpiresAt" = "ExpiresAt" - make_interval(days => ("Id" * 3) % 19);
    UPDATE "LoyaltySpins" SET "RedeemedAt" = LEAST("SpunAt" + interval '5 days', now() AT TIME ZONE 'utc') WHERE "RedeemedAt" IS NOT NULL;
    COMMIT;
  `);
}
