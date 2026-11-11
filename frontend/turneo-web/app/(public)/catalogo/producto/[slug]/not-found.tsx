import { ProductNotFoundView } from "@/src/components/public/catalog/ProductView";

// Rendered with HTTP 404 when the page calls notFound() for an unknown product.
export default function ProductoNotFound() {
  return <ProductNotFoundView />;
}
