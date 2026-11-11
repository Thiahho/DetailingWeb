import type { Metadata } from "next";
import { Suspense } from "react";
import CatalogBrowser, { CatalogSkeleton } from "@/src/components/public/catalog/CatalogBrowser";

export const metadata: Metadata = {
  title: "Catálogo",
  description: "Productos disponibles. Armá tu pedido y envialo por WhatsApp.",
};

// The category filter lives in the query string (?categoria=<slug>), read on the client.
export default function CatalogoPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-cream px-4 py-12 sm:px-6 md:py-16">
          <div className="mx-auto max-w-6xl">
            <CatalogSkeleton />
          </div>
        </main>
      }
    >
      <CatalogBrowser />
    </Suspense>
  );
}
