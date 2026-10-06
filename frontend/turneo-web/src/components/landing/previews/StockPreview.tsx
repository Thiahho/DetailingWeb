import { TriangleAlert } from "lucide-react";

// Preview ilustrativo (datos ficticios): listado de insumos con su nivel contra
// el mínimo, la alerta de stock bajo y la receta de un servicio. Decorativo.

const INSUMOS = [
  { name: "Tintura 7.1", stock: "120 g", level: "w-[14%]", low: true },
  { name: "Oxidante 20 vol", stock: "1.400 ml", level: "w-[70%]", low: false },
  { name: "Top coat", stock: "3 u", level: "w-[42%]", low: false },
  { name: "Adhesivo de pestañas", stock: "1 u", level: "w-[10%]", low: true },
];

const RECIPE = [
  { name: "Tintura", qty: "60 g" },
  { name: "Oxidante", qty: "90 ml" },
];

export default function StockPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto max-w-md select-none pb-28 sm:pb-24 lg:max-w-none">
      <div className="rounded-[1.75rem] bg-ivory p-5 text-charcoal shadow-elevated sm:mr-10 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-charcoal/60">Insumos</p>
          <span className="flex items-center gap-1.5 rounded-full bg-rosewood px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cream">
            <TriangleAlert size={11} strokeWidth={2.4} /> 2 bajo mínimo
          </span>
        </div>
        <ul className="mt-4">
          {INSUMOS.map((i) => (
            <li key={i.name} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 border-t border-mauve/15 py-3 first:border-t-0">
              <span className="truncate text-sm font-semibold">{i.name}</span>
              <span className={`text-xs font-semibold ${i.low ? "text-rosewood" : "text-charcoal/70"}`}>{i.stock}</span>
              <span className="relative col-span-2 block h-1.5 rounded-full bg-cream">
                <span className={`block h-full rounded-full ${i.level} ${i.low ? "bg-rosewood" : "bg-champagne"}`} />
                {/* Marca del mínimo definido */}
                <span className="absolute -top-1 left-[22%] h-3.5 w-px bg-charcoal/40" />
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Receta del servicio */}
      <div className="absolute bottom-0 right-0 w-[72%] max-w-[16rem] rounded-3xl bg-ink p-4 text-cream shadow-elevated sm:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blush">Receta · Color</p>
        <ul className="mt-2.5 space-y-1.5 text-sm">
          {RECIPE.map((r) => (
            <li key={r.name} className="flex justify-between gap-3">
              <span className="text-mist">{r.name}</span>
              <span className="font-semibold">− {r.qty}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-cream/15 pt-2.5 text-[11px] text-mist">Se descuenta al atender el turno.</p>
      </div>
    </div>
  );
}
