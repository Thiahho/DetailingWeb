import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductView from "@/src/components/public/catalog/ProductView";
import { buildProductMetadata } from "@/src/lib/catalog/productPage";
import { loadPublicProduct } from "@/src/lib/catalog/productServer";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { product } = await loadPublicProduct(params.slug);
  return product ? buildProductMetadata(product) : { title: "Producto" };
}

export default async function ProductoPage({ params }: Props) {
  const { kind, product } = await loadPublicProduct(params.slug);
  if (kind === "notFound") notFound();

  // On a backend error `product` is null and the view loads it from the browser,
  // with its own error message: a transient failure must not look like a 404.
  return <ProductView key={params.slug} slug={params.slug} initialProduct={product} />;
}
