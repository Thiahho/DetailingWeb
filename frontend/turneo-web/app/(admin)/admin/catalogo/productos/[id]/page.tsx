"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/src/components/shared/Button";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";
import { useConfirm } from "@/src/components/shared/ConfirmDialog";
import CatalogShell, { useAdminGuard } from "@/src/components/admin/catalog/CatalogShell";
import ProductFields, { type ProductFormState } from "@/src/components/admin/catalog/ProductFields";
import MediaManager from "@/src/components/admin/catalog/MediaManager";
import VariantsGrid from "@/src/components/admin/catalog/VariantsGrid";
import { catalogRequest } from "@/src/lib/catalog/api";
import { buildProductPayload } from "@/src/lib/catalog/payloads";
import { parsePriceInput, priceToInput } from "@/src/lib/catalog/price";
import { attributesForCategory } from "@/src/lib/catalog/ordering";
import type { CatalogAttribute, CatalogCategory, CatalogProductDetail } from "@/src/lib/catalog/types";

const emptyForm: ProductFormState = {
  categoryId: 0,
  name: "",
  description: "",
  priceInput: "",
  sortOrder: 0,
  isActive: true,
  allowedValueIds: [],
};

function toForm(detail: CatalogProductDetail): ProductFormState {
  return {
    categoryId: detail.categoryId,
    name: detail.name,
    description: detail.description ?? "",
    priceInput: priceToInput(detail.price),
    sortOrder: detail.sortOrder,
    isActive: detail.isActive,
    allowedValueIds: detail.allowedValueIds,
  };
}

export default function CatalogProductPage() {
  const ready = useAdminGuard();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "nuevo";
  const productId = isNew ? null : parseInt(params.id);

  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [attributes, setAttributes] = useState<CatalogAttribute[]>([]);
  const [detail, setDetail] = useState<CatalogProductDetail | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toasts, showToast, removeToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const loadProduct = useCallback(async () => {
    if (!productId) return;
    const result = await catalogRequest<CatalogProductDetail>(`products/${productId}`);
    if (result.ok) {
      setDetail(result.data);
      setForm(toForm(result.data));
    } else if (result.status === 404) {
      setNotFound(true);
    } else {
      showToast("error", "Error", result.message);
    }
  }, [productId, showToast]);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const [cats, attrs] = await Promise.all([
        catalogRequest<CatalogCategory[]>("categories"),
        catalogRequest<CatalogAttribute[]>("attributes"),
        loadProduct(),
      ]);
      if (cats.ok) {
        setCategories(cats.data);
        if (isNew && cats.data.length === 1) setForm((prev) => ({ ...prev, categoryId: cats.data[0].id }));
      }
      if (attrs.ok) setAttributes(attrs.data);
      setLoading(false);
    })();
  }, [ready, isNew, loadProduct]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parsePriceInput(form.priceInput);
    if (!price.ok) {
      showToast("error", "Precio inválido", "Ingresá un número válido o dejalo vacío para mostrar \"Consultar precio\".");
      return;
    }
    if (!form.categoryId) {
      showToast("error", "Falta la categoría", "Elegí una categoría para el producto.");
      return;
    }

    setSaving(true);
    const result = await catalogRequest<CatalogProductDetail>(isNew ? "products" : `products/${productId}`, {
      method: isNew ? "POST" : "PUT",
      body: buildProductPayload({ ...form, price: price.value }),
      fallback: "No se pudo guardar el producto",
    });
    setSaving(false);
    if (!result.ok) {
      showToast("error", "Error", result.message);
      return;
    }
    if (isNew) {
      showToast("success", "Producto creado", "Ahora podés cargar fotos y revisar las variantes.");
      router.replace(`/admin/catalogo/productos/${result.data.id}`);
      return;
    }
    setDetail(result.data);
    setForm(toForm(result.data));
    showToast("success", "Producto actualizado");
  };

  const category = categories.find((c) => c.id === (detail?.categoryId ?? form.categoryId));
  // Values that photos can be linked to: the saved allowed values (the API
  // checks the link against them, not against unsaved form changes).
  const valueOptions = category && detail
    ? attributesForCategory(category.attributeIds, attributes).flatMap((a) =>
        a.values
          .filter((v) => detail.allowedValueIds.includes(v.id))
          .map((v) => ({ id: v.id, label: `${a.name}: ${v.label}` }))
      )
    : [];

  const backLink = (
    <Link href="/admin/catalogo" className="flex items-center gap-1.5 text-sm text-charcoal/50 hover:text-charcoal transition">
      <ArrowLeft size={16} />
      Volver
    </Link>
  );

  return (
    <CatalogShell
      title={isNew ? "Nuevo producto" : detail?.name ?? "Producto"}
      description={isNew ? "Completá los datos y guardá para cargar fotos y ver las variantes." : "Datos, fotos y variantes del producto."}
      action={backLink}
    >
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {ConfirmDialog}

      {loading ? (
        <p className="text-charcoal/50 text-sm">Cargando...</p>
      ) : notFound ? (
        <p className="text-charcoal/50 text-sm">El producto no existe o fue eliminado.</p>
      ) : (
        <div className="space-y-6">
          <section className="bg-ivory border border-mauve/5 rounded-2xl p-5">
            <form onSubmit={handleSubmit} className="space-y-5">
              <ProductFields form={form} setForm={setForm} categories={categories} attributes={attributes} />
              <div className="flex gap-3">
                <Button type="submit" disabled={saving} variant="primary">
                  {saving ? "Guardando..." : isNew ? "Crear producto" : "Guardar cambios"}
                </Button>
              </div>
            </form>
          </section>

          {detail && (
            <>
              <section className="bg-ivory border border-mauve/5 rounded-2xl p-5">
                <h2 className="text-charcoal font-semibold mb-4">Fotos y videos</h2>
                <MediaManager
                  productId={detail.id}
                  media={detail.media}
                  valueOptions={valueOptions}
                  onMediaChange={(media) => setDetail((prev) => (prev ? { ...prev, media } : prev))}
                  onError={(message) => showToast("error", "Error", message)}
                  confirm={confirm}
                />
              </section>

              <section className="bg-ivory border border-mauve/5 rounded-2xl p-5">
                <h2 className="text-charcoal font-semibold mb-4">Variantes</h2>
                <VariantsGrid
                  productId={detail.id}
                  variants={detail.variants}
                  allowedValueIds={detail.allowedValueIds}
                  categoryAttributeIds={category?.attributeIds ?? []}
                  attributes={attributes}
                  onVariantChange={(variant) =>
                    setDetail((prev) =>
                      prev ? { ...prev, variants: prev.variants.map((v) => (v.id === variant.id ? variant : v)) } : prev
                    )
                  }
                  onReload={loadProduct}
                  onError={(message) => showToast("error", "Error", message)}
                  onNotice={(message) => showToast("success", "Variantes actualizadas", message)}
                />
              </section>
            </>
          )}
        </div>
      )}
    </CatalogShell>
  );
}
