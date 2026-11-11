"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import CatalogShell, { EmptyState, StatusBadge, useAdminGuard } from "@/src/components/admin/catalog/CatalogShell";
import { catalogRequest } from "@/src/lib/catalog/api";
import { formatPrice } from "@/src/lib/catalog/price";
import { withTransform } from "@/src/lib/cloudinaryMedia";
import type { CatalogCategory, CatalogProductSummary } from "@/src/lib/catalog/types";

type ActiveFilter = "all" | "active" | "inactive";

export default function CatalogProductsPage() {
  const ready = useAdminGuard();
  const [products, setProducts] = useState<CatalogProductSummary[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [loading, setLoading] = useState(true);
  const { toasts, showToast, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const loadProducts = useCallback(async () => {
    const result = await catalogRequest<CatalogProductSummary[]>(
      categoryId ? `products?categoryId=${categoryId}` : "products"
    );
    if (result.ok) setProducts(result.data);
    else showToast("error", "Error", result.message);
    setLoading(false);
  }, [categoryId, showToast]);

  useEffect(() => {
    if (!ready) return;
    catalogRequest<CatalogCategory[]>("categories").then((r) => r.ok && setCategories(r.data));
  }, [ready]);

  useEffect(() => {
    if (ready) loadProducts();
  }, [ready, loadProducts]);

  const handleDelete = async (product: CatalogProductSummary) => {
    const ok = await confirm({
      title: "Eliminar producto",
      message: `¿Eliminar "${product.name}" con sus variantes y fotos? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    const result = await catalogRequest(`products/${product.id}`, { method: "DELETE", fallback: "No se pudo eliminar" });
    if (result.ok) {
      showToast("warning", "Producto eliminado");
      loadProducts();
    } else {
      showToast("error", "No se pudo eliminar", result.message);
    }
  };

  const visible = products.filter((p) =>
    activeFilter === "all" ? true : activeFilter === "active" ? p.isActive : !p.isActive
  );

  return (
    <CatalogShell
      title="Catálogo"
      description="Productos que tus clientes ven en el sitio y piden por WhatsApp."
      action={
        categories.length > 0 ? (
          <Link
            href="/admin/catalogo/productos/nuevo"
            className="shrink-0 flex items-center gap-2 rounded-lg bg-blush px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-blushdark"
          >
            <span className="text-xl leading-none">+</span>
            <span className="hidden sm:inline">Nuevo producto</span>
            <span className="sm:hidden">Nuevo</span>
          </Link>
        ) : undefined
      }
    >
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {ConfirmDialog}

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          className="form-input max-w-xs"
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value ? parseInt(e.target.value) : null)}
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="form-input max-w-[12rem]"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
          aria-label="Filtrar por estado"
        >
          <option value="all">Activos e inactivos</option>
          <option value="active">Solo activos</option>
          <option value="inactive">Solo inactivos</option>
        </select>
      </div>

      {loading ? (
        <p className="text-charcoal/50 text-sm">Cargando productos...</p>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-mauve/10 rounded-xl">
          <p className="text-charcoal/40 text-lg">Primero creá una categoría</p>
          <Link href="/admin/catalogo/categorias" className="mt-4 inline-block text-blushdark hover:text-blush transition text-sm">
            Ir a Categorías
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState message="No hay productos para este filtro" />
      ) : (
        <div className="bg-ivory border border-mauve/5 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mauve/5 text-charcoal/30 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Producto</th>
                <th className="text-left px-5 py-3 font-medium">Categoría</th>
                <th className="text-left px-5 py-3 font-medium">Precio</th>
                <th className="text-left px-5 py-3 font-medium">Variantes</th>
                <th className="text-left px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => (
                <tr key={product.id} className="border-b border-mauve/5 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-mauve/10 bg-white flex items-center justify-center">
                        {product.coverUrl ? (
                          <img src={withTransform(product.coverUrl, "w_80,h_80,c_fill,q_auto,f_auto")} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon size={16} className="text-charcoal/20" />
                        )}
                      </div>
                      <span className="text-charcoal font-medium">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-charcoal/60">{product.categoryName}</td>
                  <td className={`px-5 py-3 ${product.price === null ? "text-charcoal/40 italic" : "text-charcoal/70"}`}>
                    {formatPrice(product.price)}
                  </td>
                  <td className="px-5 py-3 text-charcoal/60">
                    {product.activeVariants}
                    {product.onRequestVariants > 0 && (
                      <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700">
                        {product.onRequestVariants} A PEDIDO
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge active={product.isActive} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Link
                        href={`/admin/catalogo/productos/${product.id}`}
                        className="rounded-lg border border-mauve/15 bg-porcelain/5 px-3 py-1.5 text-xs font-medium text-charcoal transition hover:border-mauve/30 hover:bg-porcelain/10"
                      >
                        Editar
                      </Link>
                      <Button onClick={() => handleDelete(product)} variant="danger" size="sm">
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CatalogShell>
  );
}
