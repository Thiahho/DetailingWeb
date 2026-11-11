"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/src/hooks/useCart";
import { totalUnits } from "@/src/lib/catalog/cart";

// Navbar link to /pedido with the number of units in the cart.
export default function CartButton({ onClick }: { onClick?: () => void }) {
  const { items } = useCart();
  const units = totalUnits(items);
  return (
    <Link
      href="/pedido"
      onClick={onClick}
      aria-label={units > 0 ? `Ver pedido (${units} ${units === 1 ? "unidad" : "unidades"})` : "Ver pedido"}
      className="relative grid h-10 w-10 place-items-center rounded-full text-charcoal/70 transition hover:bg-blush/10 hover:text-charcoal"
    >
      <ShoppingBag size={20} aria-hidden />
      {units > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-rosewood px-1 text-[10px] font-semibold leading-none text-white">
          {units > 99 ? "99+" : units}
        </span>
      )}
    </Link>
  );
}
