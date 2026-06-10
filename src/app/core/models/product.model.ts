/**
 * ProductVariant — combinación color/talla con su stock.
 * `id` y `productId` provienen de la tabla product_variant (SQLite).
 */
export interface ProductVariant {
  id: string;            // UUID v4 — necesario para updateVariantStock
  productId: string;     // FK → Product.id
  color: string;         // Ej: 'Rojo', 'Azul'
  size: string;          // Ej: 'S', 'M', 'L', 'XL'
  stock: number;         // Unidades disponibles
}

/**
 * Product — producto vinculado a uno o más TagCode.
 */
export interface Product {
  id: string;            // UUID v4
  name: string;          // Nombre del vestido
  sku?: string;          // Código interno opcional
  price: number;         // Precio de venta (soles)
  costPrice?: number;    // Precio de costo
  supplier?: string;     // Nombre del proveedor (denormalizado, para mostrar/buscar)
  supplierId?: string;   // FK → Supplier.id (catálogo de proveedores)
  purchaseDoc?: string;  // Guía/boleta/factura con que llegó la mercadería
  category?: string;     // Categoría (futuro)
  variants: ProductVariant[];
  images?: string[];     // Paths locales o URLs Firebase Storage (futuro)
  createdBy?: string;    // Usuario que creó/vinculó el producto (default si no hay login)
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
  syncedAt?: string;
}
