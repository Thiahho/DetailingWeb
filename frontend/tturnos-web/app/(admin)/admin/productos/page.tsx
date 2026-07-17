"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthenticated, getRole } from "@/src/lib/auth";
import { logError } from "@/src/lib/logger";
import { useToast, ToastContainer } from "@/src/components/shared/Toast";

interface Product {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
  order: number;
}

const emptyForm = {
  name: "",
  price: 0,
  isActive: true,
  order: 0,
};

export default function ProductosAdminPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const { toasts, showToast, removeToast } = useToast();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.push(getRole() === "Professional" ? "/profesional/agenda" : "/admin/login");
      return;
    }
    loadProducts();
  }, [router]);

  const loadProducts = async () => {
    try {
      const res = await fetch("/api/products");
      if (res.ok) setProducts(await res.json());
    } catch (error) {
      logError("Error cargando productos:", error);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingProduct(null);
    setFormData({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price,
      isActive: product.isActive,
      order: product.order,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setFormData({ ...emptyForm });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
      const method = editingProduct ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", editingProduct ? "Producto actualizado" : "Producto creado", data.message);
        closeForm();
        loadProducts();
      } else {
        showToast("error", "Error", data.message || "No se pudo guardar el producto");
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showToast("warning", "Producto eliminado", data.message);
        setDeleteConfirmId(null);
        loadProducts();
      } else {
        showToast("error", "Error", data.message || "No se pudo eliminar");
      }
    } catch {
      showToast("error", "Error de conexión", "No se pudo conectar con el servidor");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-charcoal">Cargando productos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6 font-sans">
      {/* Toasts */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 md:mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-charcoal">Gestión de Productos</h1>
            <p className="text-charcoal/50 text-sm mt-1">
              Catálogo de productos usados en los turnos (Historial) y, más adelante, en Caja
            </p>
          </div>
          <button
            onClick={openCreate}
            data-testid="product-create-button"
            className="shrink-0 bg-blush hover:bg-blushdark text-white px-4 md:px-5 py-2.5 rounded-lg font-semibold shadow-glow transition flex items-center gap-2 text-sm md:text-base"
          >
            <span className="text-xl leading-none">+</span>
            <span className="hidden sm:inline">Nuevo Producto</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        </div>

        {/* Lista de productos */}
        {products.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-mauve/10 rounded-xl">
            <p className="text-charcoal/40 text-lg">No hay productos cargados</p>
            <button onClick={openCreate} className="mt-4 text-green-700 hover:text-green-700 transition text-sm">
              + Crear el primero
            </button>
          </div>
        ) : (
          <div className="bg-ivory border border-mauve/5 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mauve/5 text-charcoal/30 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Nombre</th>
                  <th className="text-left px-5 py-3 font-medium">Precio</th>
                  <th className="text-left px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} data-testid="product-row" data-product-name={product.name} className="border-b border-mauve/5 last:border-0">
                    <td className="px-5 py-4 text-charcoal font-medium">{product.name}</td>
                    <td className="px-5 py-4 text-charcoal/60">${product.price.toLocaleString("es-AR")}</td>
                    <td className="px-5 py-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${product.isActive ? "bg-green-500/20 text-green-700" : "bg-orange-500/20 text-orange-700"}`}>
                        {product.isActive ? "ACTIVO" : "INACTIVO"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openEdit(product)}
                          data-testid="product-edit-button"
                          className="bg-porcelain/5 hover:bg-porcelain/10 text-charcoal text-xs px-3 py-1.5 rounded-lg transition"
                        >
                          Editar
                        </button>
                        {deleteConfirmId === product.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleDelete(product.id)}
                              data-testid="product-delete-confirm-button"
                              className="bg-red-600 hover:bg-red-500 text-charcoal text-xs px-3 py-1.5 rounded-lg transition"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="bg-porcelain/5 text-charcoal text-xs px-3 py-1.5 rounded-lg transition"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(product.id)}
                            data-testid="product-delete-button"
                            className="bg-red-900/20 hover:bg-red-900/40 text-red-600 text-xs px-3 py-1.5 rounded-lg transition"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={closeForm}>
          <div
            className="bg-ivory border border-mauve/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-charcoal">
                {editingProduct ? "Editar Producto" : "Nuevo Producto"}
              </h2>
              <button onClick={closeForm} className="text-charcoal/40 hover:text-charcoal transition text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Nombre</label>
                <input
                  className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition"
                  data-testid="product-form-name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Shampoo reparador"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Precio</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition"
                    data-testid="product-form-price"
                    value={formData.price}
                    onChange={(e) => setFormData((prev) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Orden</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition"
                    value={formData.order}
                    onChange={(e) => setFormData((prev) => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-charcoal/60 text-xs font-medium uppercase tracking-wider">Estado</label>
                <select
                  className="w-full mt-1.5 bg-cream border border-mauve/10 rounded-lg p-3 text-charcoal focus:border-green-500 focus:outline-none transition"
                  value={formData.isActive ? "true" : "false"}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.value === "true" }))}
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  data-testid="product-form-submit"
                  className="flex-1 bg-blush hover:bg-blushdark text-white py-3 rounded-lg font-semibold shadow-glow transition disabled:opacity-50"
                >
                  {saving ? "Guardando..." : editingProduct ? "Guardar cambios" : "Crear producto"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-6 bg-porcelain/5 text-charcoal py-3 rounded-lg font-semibold hover:bg-porcelain/10 transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
