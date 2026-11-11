import type { Metadata } from "next";
import ProductView from "@/src/components/public/catalog/ProductView";

export const metadata: Metadata = { title: "Producto" };

export default function ProductoPage({ params }: { params: { slug: string } }) {
  return <ProductView slug={params.slug} />;
}
