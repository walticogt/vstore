/** Estado de una prenda individual: disponible, vendida o extraviada. */
export type VariantStatus = 'ACTIVE' | 'SOLD' | 'LOST';

/**
 * ProductVariant — una prenda individual (color/talla) con su código. Cada prenda es una
 * pieza única (stock 1). `id` y `productId` provienen de la tabla product_variant (SQLite).
 */
export interface ProductVariant {
  id: string;            // UUID v4
  productId: string;     // FK → Product.id
  color: string;         // Ej: 'Rojo', 'Azul'
  size: string;          // Ej: 'S', 'M', 'L', 'XL'
  stock: number;         // Unidades (siempre 1 por prenda)
  status: VariantStatus; // ACTIVE = disponible | SOLD = vendida | LOST = extraviada
  soldAt?: string;       // ISO 8601, cuándo se vendió
  salePrice?: number;    // Precio real de venta (para reportes)
  lostAt?: string;       // ISO 8601, cuándo se marcó extraviada
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
