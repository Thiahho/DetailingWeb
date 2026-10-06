// "lun 06/oct · 10:00" (formato que arma TimeSlotsController para los turnos
// disponibles) => partes, para agrupar por día sin depender de la zona horaria
// del navegador. Si el formato no coincide, `dayPart` y `day` caen al texto entero.
export function splitSlotLabel(label: string) {
  const [dayPart = label, time = ""] = label.split(" · ");
  const [dow = "", dayMonth = ""] = dayPart.split(" ");
  const [day = dayPart, month = ""] = dayMonth.split("/");
  return { dayPart, time, dow, day, month };
}

export interface SlotDay<T> {
  key: string;
  dow: string;
  day: string;
  month: string;
  slots: T[];
}

// Agrupa turnos por día respetando el orden en que llegan (ya vienen por fecha).
export function groupSlotsByDay<T extends { label: string }>(slots: T[]): SlotDay<T>[] {
  const map = new Map<string, SlotDay<T>>();
  for (const slot of slots) {
    const { dayPart, dow, day, month } = splitSlotLabel(slot.label);
    const entry = map.get(dayPart) ?? { key: dayPart, dow, day, month, slots: [] };
    entry.slots.push(slot);
    map.set(dayPart, entry);
  }
  return Array.from(map.values());
}
