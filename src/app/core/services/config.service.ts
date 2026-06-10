import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';

import { Color, Size, Supplier } from '../models/config.model';
import { DatabaseService } from './database.service';

interface ColorRow {
  id: string;
  name: string;
  hex: string;
  sort_order: number;
  synced_at: string | null;
}
interface SizeRow {
  id: string;
  label: string;
  sort_order: number;
  synced_at: string | null;
}
interface SupplierRow {
  id: string;
  name: string;
  whatsapp: string | null;
  address: string | null;
  synced_at: string | null;
}

/** Colores por defecto (id determinista para que sincronicen igual en todos los dispositivos). */
const DEFAULT_COLORS: { id: string; name: string; hex: string }[] = [
  { id: 'color-rojo', name: 'Rojo', hex: '#E53935' },
  { id: 'color-rosado', name: 'Rosado', hex: '#EC407A' },
  { id: 'color-azul', name: 'Azul', hex: '#1E88E5' },
  { id: 'color-celeste', name: 'Celeste', hex: '#4FC3F7' },
  { id: 'color-verde', name: 'Verde', hex: '#43A047' },
  { id: 'color-amarillo', name: 'Amarillo', hex: '#FDD835' },
  { id: 'color-morado', name: 'Morado', hex: '#8E24AA' },
  { id: 'color-negro', name: 'Negro', hex: '#212121' },
  { id: 'color-blanco', name: 'Blanco', hex: '#FFFFFF' },
  { id: 'color-hueso', name: 'Blanco hueso', hex: '#F5F0E1' },
  { id: 'color-beige', name: 'Beige', hex: '#D7CCC8' },
  { id: 'color-gris', name: 'Gris', hex: '#9E9E9E' },
];

/** Tallas por defecto. */
const DEFAULT_SIZES: { id: string; label: string }[] = [
  { id: 'size-xs', label: 'XS' },
  { id: 'size-s', label: 'S' },
  { id: 'size-m', label: 'M' },
  { id: 'size-l', label: 'L' },
  { id: 'size-xl', label: 'XL' },
  { id: 'size-xxl', label: 'XXL' },
];

const SEEDED_KEY = 'vstore.config.seeded';

/**
 * ConfigService — catálogos editables (colores, tallas, proveedores) que alimentan el
 * formulario de vinculación (capability: configuration). 100% offline sobre SQLite.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Siembra los colores/tallas por defecto la primera vez (idempotente por id). Solo una vez
   * por dispositivo (flag en localStorage) para que el usuario pueda borrar defaults sin que
   * reaparezcan. Además migra los proveedores de texto libre de productos a la tabla.
   */
  async ensureDefaults(): Promise<void> {
    if (localStorage.getItem(SEEDED_KEY) !== 'true') {
      const now = new Date().toISOString();
      const set: { statement: string; values: unknown[] }[] = [];
      DEFAULT_COLORS.forEach((c, i) => {
        set.push({
          statement:
            'INSERT OR IGNORE INTO color (id, name, hex, sort_order, created_at) VALUES (?, ?, ?, ?, ?);',
          values: [c.id, c.name, c.hex, i, now],
        });
      });
      DEFAULT_SIZES.forEach((s, i) => {
        set.push({
          statement:
            'INSERT OR IGNORE INTO size (id, label, sort_order, created_at) VALUES (?, ?, ?, ?);',
          values: [s.id, s.label, i, now],
        });
      });
      await this.db.executeSet(set);
      localStorage.setItem(SEEDED_KEY, 'true');
    }
    await this.migrateSuppliersFromProducts();
  }

  /**
   * Crea proveedores a partir de los nombres de proveedor sueltos en productos y enlaza
   * cada producto a su proveedor (product.supplier_id). Idempotente.
   */
  private async migrateSuppliersFromProducts(): Promise<void> {
    const pending = await this.db.query<{ supplier: string }>(
      `SELECT DISTINCT supplier FROM product
       WHERE supplier IS NOT NULL AND TRIM(supplier) <> '' AND supplier_id IS NULL;`,
    );
    for (const { supplier } of pending) {
      const name = supplier.trim();
      const existing = await this.db.query<{ id: string }>(
        'SELECT id FROM supplier WHERE name = ? LIMIT 1;',
        [name],
      );
      const id = existing.length ? existing[0].id : uuidv4();
      if (!existing.length) {
        await this.db.execute(
          'INSERT INTO supplier (id, name, created_at) VALUES (?, ?, ?);',
          [id, name, new Date().toISOString()],
        );
      }
      await this.db.execute(
        'UPDATE product SET supplier_id = ?, synced_at = NULL WHERE supplier = ? AND supplier_id IS NULL;',
        [id, name],
      );
    }
  }

  // --------------------------------------------------------------------------- Colores
  async getColors(): Promise<Color[]> {
    const rows = await this.db.query<ColorRow>('SELECT * FROM color ORDER BY sort_order, name;');
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      hex: r.hex,
      sortOrder: r.sort_order,
      syncedAt: r.synced_at ?? undefined,
    }));
  }

  async addColor(name: string, hex: string): Promise<void> {
    const max = await this.db.query<{ m: number }>('SELECT IFNULL(MAX(sort_order), -1) AS m FROM color;');
    await this.db.execute(
      'INSERT INTO color (id, name, hex, sort_order, created_at) VALUES (?, ?, ?, ?, ?);',
      [uuidv4(), name.trim(), hex, (max[0]?.m ?? -1) + 1, new Date().toISOString()],
    );
  }

  async updateColor(id: string, name: string, hex: string): Promise<void> {
    await this.db.execute('UPDATE color SET name = ?, hex = ?, synced_at = NULL WHERE id = ?;', [
      name.trim(),
      hex,
      id,
    ]);
  }

  async removeColor(id: string): Promise<void> {
    await this.db.execute('DELETE FROM color WHERE id = ?;', [id]);
  }

  // --------------------------------------------------------------------------- Tallas
  async getSizes(): Promise<Size[]> {
    const rows = await this.db.query<SizeRow>('SELECT * FROM size ORDER BY sort_order, label;');
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      sortOrder: r.sort_order,
      syncedAt: r.synced_at ?? undefined,
    }));
  }

  async addSize(label: string): Promise<void> {
    const max = await this.db.query<{ m: number }>('SELECT IFNULL(MAX(sort_order), -1) AS m FROM size;');
    await this.db.execute('INSERT INTO size (id, label, sort_order, created_at) VALUES (?, ?, ?, ?);', [
      uuidv4(),
      label.trim(),
      (max[0]?.m ?? -1) + 1,
      new Date().toISOString(),
    ]);
  }

  async removeSize(id: string): Promise<void> {
    await this.db.execute('DELETE FROM size WHERE id = ?;', [id]);
  }

  // --------------------------------------------------------------------------- Proveedores
  async getSuppliers(): Promise<Supplier[]> {
    const rows = await this.db.query<SupplierRow>('SELECT * FROM supplier ORDER BY name;');
    return rows.map((r) => this.mapSupplier(r));
  }

  async getSupplierById(id: string): Promise<Supplier | null> {
    const rows = await this.db.query<SupplierRow>('SELECT * FROM supplier WHERE id = ? LIMIT 1;', [id]);
    return rows.length ? this.mapSupplier(rows[0]) : null;
  }

  /** Crea un proveedor y devuelve su id (para usarlo de inmediato al vincular). */
  async addSupplier(data: { name: string; whatsapp?: string; address?: string }): Promise<string> {
    const id = uuidv4();
    await this.db.execute(
      'INSERT INTO supplier (id, name, whatsapp, address, created_at) VALUES (?, ?, ?, ?, ?);',
      [id, data.name.trim(), data.whatsapp?.trim() || null, data.address?.trim() || null, new Date().toISOString()],
    );
    return id;
  }

  async updateSupplier(
    id: string,
    data: { name: string; whatsapp?: string; address?: string },
  ): Promise<void> {
    await this.db.execute(
      'UPDATE supplier SET name = ?, whatsapp = ?, address = ?, synced_at = NULL WHERE id = ?;',
      [data.name.trim(), data.whatsapp?.trim() || null, data.address?.trim() || null, id],
    );
  }

  async removeSupplier(id: string): Promise<void> {
    await this.db.execute('DELETE FROM supplier WHERE id = ?;', [id]);
  }

  private mapSupplier(r: SupplierRow): Supplier {
    return {
      id: r.id,
      name: r.name,
      whatsapp: r.whatsapp ?? undefined,
      address: r.address ?? undefined,
      syncedAt: r.synced_at ?? undefined,
    };
  }
}
