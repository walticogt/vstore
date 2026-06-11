import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';

import { Product, ProductVariant } from '../models/product.model';
import { DatabaseService } from './database.service';
import { SessionService } from './session.service';
import { TagService } from './tag.service';

/** Datos de una variante al crearla/agregarla: solo color/talla/stock (el estado arranca ACTIVE). */
export type NewVariantInput = Omit<
  ProductVariant,
  'id' | 'productId' | 'status' | 'soldAt' | 'salePrice' | 'lostAt'
>;

/** Datos de entrada para crear un producto (sin id/fechas, variantes sin id/productId). */
export type NewProductInput = Omit<
  Product,
  'id' | 'createdAt' | 'updatedAt' | 'variants' | 'createdBy' | 'syncedAt'
> & {
  variants: NewVariantInput[];
};

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  cost_price: number | null;
  supplier: string | null;
  supplier_id: string | null;
  purchase_doc: string | null;
  category: string | null;
  created_by: string | null;
  images: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

interface VariantRow {
  id: string;
  product_id: string;
  color: string | null;
  size: string | null;
  stock: number;
  status: string | null;
  sold_at: string | null;
  sale_price: number | null;
  lost_at: string | null;
}

/**
 * ProductService — CRUD de productos y variantes (capability: product-management).
 * Todo sobre SQLite, 100% offline.
 */
@Injectable({ providedIn: 'root' })
export class ProductService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tags: TagService,
    private readonly session: SessionService,
  ) {}

  /** Crea un producto (nombre y precio obligatorios) con sus variantes. */
  async createProduct(data: NewProductInput): Promise<Product> {
    if (!data.name?.trim() || data.price == null || Number.isNaN(data.price)) {
      throw new Error('ProductService.createProduct: nombre y precio son obligatorios.');
    }

    const now = new Date().toISOString();
    const createdBy = this.session.currentUser;
    const images = data.images?.length ? data.images : undefined;
    const product: Product = {
      ...data,
      id: uuidv4(),
      createdBy,
      images,
      createdAt: now,
      updatedAt: now,
      variants: [],
    };

    const set: { statement: string; values: unknown[] }[] = [
      {
        statement: `INSERT INTO product (id, name, sku, price, cost_price, supplier, supplier_id, purchase_doc, category, created_by, images, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        values: [
          product.id,
          product.name,
          data.sku ?? null,
          product.price,
          data.costPrice ?? null,
          data.supplier ?? null,
          data.supplierId ?? null,
          data.purchaseDoc ?? null,
          data.category ?? null,
          createdBy,
          images ? JSON.stringify(images) : null,
          now,
          now,
        ],
      },
    ];

    for (const v of data.variants) {
      const variant: ProductVariant = {
        ...v,
        id: uuidv4(),
        productId: product.id,
        status: 'ACTIVE',
      };
      product.variants.push(variant);
      set.push({
        statement:
          'INSERT INTO product_variant (id, product_id, color, size, stock) VALUES (?, ?, ?, ?, ?);',
        values: [variant.id, variant.productId, variant.color, variant.size, variant.stock],
      });
    }

    await this.db.executeSet(set);
    return product;
  }

  /**
   * Agrega una variante a un producto existente y devuelve la variante creada (con id).
   * Marca el producto como no sincronizado para que la sync lo vuelva a subir.
   */
  async addVariant(productId: string, data: NewVariantInput): Promise<ProductVariant> {
    const variant: ProductVariant = { ...data, id: uuidv4(), productId, status: 'ACTIVE' };
    await this.db.executeSet([
      {
        statement:
          'INSERT INTO product_variant (id, product_id, color, size, stock) VALUES (?, ?, ?, ?, ?);',
        values: [variant.id, productId, variant.color, variant.size, variant.stock],
      },
      {
        statement: 'UPDATE product SET updated_at = ?, synced_at = NULL WHERE id = ?;',
        values: [new Date().toISOString(), productId],
      },
    ]);
    return variant;
  }

  /** Actualiza los campos escalares de un producto y refresca updatedAt. */
  async updateProduct(
    id: string,
    data: Partial<Omit<Product, 'id' | 'createdAt' | 'variants'>>,
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];
    const columnMap: Record<string, string> = {
      name: 'name',
      sku: 'sku',
      price: 'price',
      costPrice: 'cost_price',
      supplier: 'supplier',
      supplierId: 'supplier_id',
      purchaseDoc: 'purchase_doc',
      category: 'category',
    };

    for (const [key, column] of Object.entries(columnMap)) {
      const value = (data as Record<string, unknown>)[key];
      if (value !== undefined) {
        fields.push(`${column} = ?`);
        values.push(value);
      }
    }

    if (data.images !== undefined) {
      fields.push('images = ?');
      values.push(data.images.length ? JSON.stringify(data.images) : null);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    // Marca el producto como no sincronizado para que la sync lo vuelva a subir.
    fields.push('synced_at = NULL');
    values.push(id);

    await this.db.execute(`UPDATE product SET ${fields.join(', ')} WHERE id = ?;`, values);
  }

  /** Devuelve un producto con sus variantes, o null si no existe. */
  async getProductById(id: string): Promise<Product | null> {
    const rows = await this.db.query<ProductRow>('SELECT * FROM product WHERE id = ? LIMIT 1;', [
      id,
    ]);
    if (!rows.length) {
      return null;
    }
    const variants = await this.loadVariants(id);
    return this.mapProduct(rows[0], variants);
  }

  /** Resuelve el producto vinculado a un tag (vía product_id del tag). */
  async getProductByTagId(tagId: string): Promise<Product | null> {
    const tag = await this.tags.getTagById(tagId);
    if (!tag?.productId) {
      return null;
    }
    return this.getProductById(tag.productId);
  }

  /** Busca productos por nombre, SKU o proveedor (coincidencia parcial). */
  async searchProducts(query: string): Promise<Product[]> {
    const like = `%${query.trim()}%`;
    const rows = await this.db.query<ProductRow>(
      `SELECT * FROM product
       WHERE name LIKE ? OR IFNULL(sku, '') LIKE ? OR IFNULL(supplier, '') LIKE ?
       ORDER BY updated_at DESC;`,
      [like, like, like],
    );
    return this.attachVariants(rows);
  }

  /** Lista todos los productos con sus variantes (para el inventario). */
  async getAllProducts(): Promise<Product[]> {
    const rows = await this.db.query<ProductRow>('SELECT * FROM product ORDER BY updated_at DESC;');
    return this.attachVariants(rows);
  }

  /** Lista de proveedores distintos (para filtros). */
  async getSuppliers(): Promise<string[]> {
    const rows = await this.db.query<{ supplier: string }>(
      "SELECT DISTINCT supplier FROM product WHERE supplier IS NOT NULL AND supplier <> '' ORDER BY supplier;",
    );
    return rows.map((r) => r.supplier);
  }

  /** Ajusta el stock de una variante por un delta; nunca baja de 0. Re-sincroniza el producto. */
  async updateVariantStock(variantId: string, delta: number): Promise<void> {
    const now = new Date().toISOString();
    await this.db.executeSet([
      {
        statement: 'UPDATE product_variant SET stock = MAX(0, stock + ?) WHERE id = ?;',
        values: [delta, variantId],
      },
      {
        statement: `UPDATE product SET updated_at = ?, synced_at = NULL
                    WHERE id = (SELECT product_id FROM product_variant WHERE id = ?);`,
        values: [now, variantId],
      },
    ]);
  }

  /**
   * Quita una prenda (variante) del producto: desecha su código vinculado (queda en
   * historial, fuera de circulación) y elimina la variante. Re-sincroniza el producto.
   * Orden FK-seguro: primero desvincula el código, luego marca el producto, luego borra.
   */
  async removeVariant(variantId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.executeSet([
      {
        statement:
          "UPDATE tag_code SET status = 'DISCARDED', variant_id = NULL, synced_at = NULL WHERE variant_id = ? AND status = 'ASSIGNED';",
        values: [variantId],
      },
      {
        statement:
          'UPDATE product SET updated_at = ?, synced_at = NULL WHERE id = (SELECT product_id FROM product_variant WHERE id = ?);',
        values: [now, variantId],
      },
      {
        statement: 'DELETE FROM product_variant WHERE id = ?;',
        values: [variantId],
      },
    ]);
  }

  /** Marca una prenda como VENDIDA con su precio real; queda en el registro (reportes). */
  async markVariantSold(variantId: string, salePrice: number): Promise<void> {
    await this.setVariantStatus(variantId, [
      "status = 'SOLD'",
      'sold_at = ?',
      'sale_price = ?',
      'lost_at = NULL',
    ], [new Date().toISOString(), salePrice]);
  }

  /** Marca una prenda como EXTRAVIADA; queda en gris en el registro (reportes de pérdidas). */
  async markVariantLost(variantId: string): Promise<void> {
    await this.setVariantStatus(variantId, [
      "status = 'LOST'",
      'lost_at = ?',
      'sold_at = NULL',
      'sale_price = NULL',
    ], [new Date().toISOString()]);
  }

  /** Revierte una prenda a DISPONIBLE (deshacer venta/extravío por error). */
  async revertVariant(variantId: string): Promise<void> {
    await this.setVariantStatus(variantId, [
      "status = 'ACTIVE'",
      'sold_at = NULL',
      'sale_price = NULL',
      'lost_at = NULL',
    ], []);
  }

  /** Aplica un cambio de estado a la prenda y re-sincroniza su producto. */
  private async setVariantStatus(variantId: string, sets: string[], values: unknown[]): Promise<void> {
    await this.db.executeSet([
      {
        statement: `UPDATE product_variant SET ${sets.join(', ')} WHERE id = ?;`,
        values: [...values, variantId],
      },
      {
        statement:
          'UPDATE product SET updated_at = ?, synced_at = NULL WHERE id = (SELECT product_id FROM product_variant WHERE id = ?);',
        values: [new Date().toISOString(), variantId],
      },
    ]);
  }

  private async loadVariants(productId: string): Promise<ProductVariant[]> {
    const rows = await this.db.query<VariantRow>(
      'SELECT * FROM product_variant WHERE product_id = ? ORDER BY color, size;',
      [productId],
    );
    return rows.map((r) => this.mapVariant(r));
  }

  private async attachVariants(rows: ProductRow[]): Promise<Product[]> {
    const products: Product[] = [];
    for (const row of rows) {
      const variants = await this.loadVariants(row.id);
      products.push(this.mapProduct(row, variants));
    }
    return products;
  }

  private mapProduct(r: ProductRow, variants: ProductVariant[]): Product {
    return {
      id: r.id,
      name: r.name,
      sku: r.sku ?? undefined,
      price: r.price,
      costPrice: r.cost_price ?? undefined,
      supplier: r.supplier ?? undefined,
      supplierId: r.supplier_id ?? undefined,
      purchaseDoc: r.purchase_doc ?? undefined,
      category: r.category ?? undefined,
      createdBy: r.created_by ?? undefined,
      images: this.parseImages(r.images),
      variants,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      syncedAt: r.synced_at ?? undefined,
    };
  }

  private parseImages(raw: string | null): string[] | undefined {
    if (!raw) {
      return undefined;
    }
    try {
      const arr = JSON.parse(raw) as unknown;
      return Array.isArray(arr) && arr.length ? (arr as string[]) : undefined;
    } catch {
      return undefined;
    }
  }

  private mapVariant(r: VariantRow): ProductVariant {
    return {
      id: r.id,
      productId: r.product_id,
      color: r.color ?? '',
      size: r.size ?? '',
      stock: r.stock,
      status: (r.status as ProductVariant['status']) ?? 'ACTIVE',
      soldAt: r.sold_at ?? undefined,
      salePrice: r.sale_price ?? undefined,
      lostAt: r.lost_at ?? undefined,
    };
  }
}
