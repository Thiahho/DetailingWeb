import type { Metadata } from "next";
import OrderView from "@/src/components/public/catalog/OrderView";

export const metadata: Metadata = {
  title: "Tu pedido",
  robots: { index: false, follow: false },
};

export default function PedidoPage() {
  return <OrderView />;
}
