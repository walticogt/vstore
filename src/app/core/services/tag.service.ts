import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';

import { CodeType, PrintBatch, PrintLayout } from '../models/print-batch.model';
import { TagCode, TagOrigin, TagStatus } from '../models/tag-code.model';
import { DatabaseService } from './database.service';
import { SessionService } from './session.service';

/** Stickers por hoja A4 según el tipo de código: QR 5×8 (40), Barras 5×10 (50). */
export const SHEET_QUANTITY: Record<CodeType, number> = { QR: 40, BARCODE: 50 };
const SHEET_LAYOUT: Record<CodeType, PrintLayout> = { QR: '5x8', BARCODE: '5x10' };

/** Cantidad por defecto de un lote (QR). */
export const DEFAULT_BATCH_QUANTITY = SHEET_QUANTITY.QR;

/**
 * Lote-sentinela para códigos recuperados (no provienen de una impresión real). Agrupa
 * todos los códigos escaneados sin registro local que el usuario decide recuperar.
 */
export const RECOVERED_BATCH_ID = 'recovered';

/** Fila cruda de tag_code tal como la devuelve SQLite (snake_case). */
interface TagRow {
  id: string;
  status: TagStatus;
  created_at: string;
  assigned_at: string | null;
  assigned_by: string | null;
  product_id: string | null;
  variant_id: string | null;
  print_batch_id: string;
  origin?: TagOrigin | null;
  code_type?: CodeType | null;
  synced_at: string | null;
}

/** Fila cruda de print_batch tal como la devuelve SQLite (snake_case). */
interface BatchRow {
  id: string;
  created_at: string;
  quantity: number;
  layout: PrintLayout;
  code_type: CodeType;
  synced_at: string | null;
}

/**
 * TagService — generación y ciclo de vida de los códigos (capability: tag-generation,
 * y la transición de vinculación de tag-linking).
 *
 * Toda operación es 100% offline sobre SQLite.
 */
@Injectable({ providedIn: 'root' })
export class TagService {
  constructor(
    private readonly db: DatabaseService,
    private readonly session: SessionService,
  ) {}

  /**
   * Genera un PrintBatch y `quantity` TagCode en estado PENDING (UUID v4 cada uno),
   * persistidos en una sola transacción. Devuelve el lote creado.
   */
  async generateBatch(
    quantity: number = DEFAULT_BATCH_QUANTITY,
    codeType: CodeType = 'QR',
  ): Promise<PrintBatch> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`TagService.generateBatch: cantidad inválida (${quantity}).`);
    }

    const now = new Date().toISOString();
    const batch: PrintBatch = {
      id: uuidv4(),
      createdAt: now,
      quantity,
      layout: SHEET_LAYOUT[codeType],
      codeType,
    };

    const set: { statement: string; values: unknown[] }[] = [
      {
        statement:
          'INSERT INTO print_batch (id, created_at, quantity, layout, code_type) VALUES (?, ?, ?, ?, ?);',
        values: [batch.id, batch.createdAt, batch.quantity, batch.layout, batch.codeType],
      },
    ];

    for (let i = 0; i < quantity; i++) {
      set.push({
        statement:
          'INSERT INTO tag_code (id, status, created_at, print_batch_id) VALUES (?, ?, ?, ?);',
        values: [uuidv4(), 'PENDING', now, batch.id],
      });
    }

    await this.db.executeSet(set);
    return batch;
  }

  /**
   * Recupera un código escaneado que no existe localmente (probablemente generado en otra
   * versión/instalación y cuyo registro se perdió). Lo crea como PENDING marcado
   * origin='RECOVERED' dentro del lote-sentinela, listo para seguir el flujo normal de
   * vinculación. El llamador debe asegurarse antes de que el código no exista (resolveByCode).
   */
  async recoverCode(code: string): Promise<TagCode> {
    const id = code.trim();
    if (!id) {
      throw new Error('TagService.recoverCode: código vacío.');
    }
    const now = new Date().toISOString();
    await this.db.executeSet([
      {
        statement: `INSERT OR IGNORE INTO print_batch (id, created_at, quantity, layout, code_type)
                    VALUES (?, ?, 0, '5x8', 'QR');`,
        values: [RECOVERED_BATCH_ID, now],
      },
      {
        statement: `INSERT INTO tag_code (id, status, created_at, print_batch_id, origin)
                    VALUES (?, 'PENDING', ?, ?, 'RECOVERED');`,
        values: [id, now, RECOVERED_BATCH_ID],
      },
    ]);
    const tag = await this.getTagById(id);
    if (!tag) {
      throw new Error('TagService.recoverCode: no se pudo crear el código recuperado.');
    }
    return tag;
  }

  /**
   * Vincula un tag PENDING a una variante específica (y su producto): pasa a ASSIGNED y
   * registra assignedAt/assignedBy/productId/variantId. Si ya está ASSIGNED, es un no-op.
   */
  async assignTag(
    tagId: string,
    productId: string,
    variantId: string | null,
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute(
      `UPDATE tag_code SET status = 'ASSIGNED', assigned_at = ?, assigned_by = ?, product_id = ?, variant_id = ?
       WHERE id = ? AND status = 'PENDING';`,
      [now, this.session.currentUser, productId, variantId, tagId],
    );
  }

  /**
   * Desecha (oculta) todos los códigos PENDING: los marca como DISCARDED. Útil cuando
   * stickers impresos se perdieron o dañaron y nunca se vincularán. No borra (mantiene
   * auditoría) y se sincroniza. Devuelve cuántos se desecharon.
   */
  async discardAllPending(): Promise<number> {
    const count = await this.db.query<{ n: number }>(
      "SELECT COUNT(*) AS n FROM tag_code WHERE status = 'PENDING';",
    );
    await this.db.execute(
      "UPDATE tag_code SET status = 'DISCARDED', synced_at = NULL WHERE status = 'PENDING';",
    );
    return count[0]?.n ?? 0;
  }

  /** Código principal (a nivel de producto, sin variante) actualmente vinculado, o null. */
  async getActiveProductTag(productId: string): Promise<TagCode | null> {
    const rows = await this.db.query<TagRow>(
      `SELECT t.*, b.code_type AS code_type
       FROM tag_code t JOIN print_batch b ON t.print_batch_id = b.id
       WHERE t.product_id = ? AND t.variant_id IS NULL AND t.status = 'ASSIGNED' ORDER BY t.assigned_at DESC LIMIT 1;`,
      [productId],
    );
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  /**
   * Vincula o re-vincula el código principal del producto (sin variante): marca como
   * REPLACED el código principal anterior (si lo hay) y asigna el nuevo código PENDING.
   */
  async replaceProductTag(productId: string, newTagId: string): Promise<void> {
    const newTag = await this.resolveByCode(newTagId);
    if (!newTag) {
      throw new Error('Código no reconocido.');
    }
    if (newTag.status !== 'PENDING') {
      throw new Error('El nuevo código no está disponible (debe estar Pendiente).');
    }

    const now = new Date().toISOString();
    const user = this.session.currentUser;

    await this.db.executeSet([
      {
        statement:
          "UPDATE tag_code SET status = 'REPLACED' WHERE product_id = ? AND variant_id IS NULL AND status = 'ASSIGNED';",
        values: [productId],
      },
      {
        statement:
          "UPDATE tag_code SET status = 'ASSIGNED', assigned_at = ?, assigned_by = ?, product_id = ?, variant_id = NULL WHERE id = ? AND status = 'PENDING';",
        values: [now, user, productId, newTag.id],
      },
    ]);
  }

  /**
   * Re-vincula una VARIANTE a un código nuevo (reemplazo por sticker dañado/perdido):
   * marca como REPLACED el código ASSIGNED actual de esa variante y asigna el nuevo
   * código PENDING a la misma variante/producto. Todo en una transacción.
   */
  async replaceTagForVariant(
    productId: string,
    variantId: string,
    newTagId: string,
  ): Promise<void> {
    const newTag = await this.resolveByCode(newTagId);
    if (!newTag) {
      throw new Error('Código no reconocido.');
    }
    if (newTag.status !== 'PENDING') {
      throw new Error('El nuevo código no está disponible (debe estar Pendiente).');
    }

    const now = new Date().toISOString();
    const user = this.session.currentUser;

    await this.db.executeSet([
      {
        statement:
          "UPDATE tag_code SET status = 'REPLACED' WHERE variant_id = ? AND status = 'ASSIGNED';",
        values: [variantId],
      },
      {
        statement:
          "UPDATE tag_code SET status = 'ASSIGNED', assigned_at = ?, assigned_by = ?, product_id = ?, variant_id = ? WHERE id = ? AND status = 'PENDING';",
        values: [now, user, productId, variantId, newTag.id],
      },
    ]);
  }

  /** Código actualmente vinculado (ASSIGNED) a una variante, o null. */
  async getActiveTagByVariant(variantId: string): Promise<TagCode | null> {
    const rows = await this.db.query<TagRow>(
      `SELECT t.*, b.code_type AS code_type
       FROM tag_code t JOIN print_batch b ON t.print_batch_id = b.id
       WHERE t.variant_id = ? AND t.status = 'ASSIGNED' ORDER BY t.assigned_at DESC LIMIT 1;`,
      [variantId],
    );
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  /** Tags ASSIGNED de un producto (uno por variante vinculada), con su tipo de código. */
  async getActiveTagsByProduct(productId: string): Promise<TagCode[]> {
    const rows = await this.db.query<TagRow>(
      `SELECT t.*, b.code_type AS code_type
       FROM tag_code t JOIN print_batch b ON t.print_batch_id = b.id
       WHERE t.product_id = ? AND t.status = 'ASSIGNED' ORDER BY t.assigned_at DESC;`,
      [productId],
    );
    return rows.map((r) => this.mapRow(r));
  }

  /** Devuelve el tag por id, o null si no existe. */
  async getTagById(tagId: string): Promise<TagCode | null> {
    const rows = await this.db.query<TagRow>('SELECT * FROM tag_code WHERE id = ? LIMIT 1;', [
      tagId,
    ]);
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  /**
   * Resuelve un código escaneado/tecleado a un tag: primero por id exacto (QR/manual con
   * id completo), y si no, por prefijo (código de barras que lleva solo los primeros
   * caracteres). Devuelve null si no hay coincidencia o es ambigua.
   */
  async resolveByCode(code: string): Promise<TagCode | null> {
    const value = code.trim();
    if (!value) {
      return null;
    }
    const exact = await this.getTagById(value);
    if (exact) {
      return exact;
    }
    // Prefijo (LIKE es case-insensitive para ASCII en SQLite). Limit 2 para detectar ambigüedad.
    const rows = await this.db.query<TagRow>(
      'SELECT * FROM tag_code WHERE id LIKE ? LIMIT 2;',
      [`${value}%`],
    );
    return rows.length === 1 ? this.mapRow(rows[0]) : null;
  }

  /** Lista los tags en estado PENDING (más recientes primero), con su tipo de código. */
  async getPendingTags(): Promise<TagCode[]> {
    const rows = await this.db.query<TagRow>(
      `SELECT t.*, b.code_type AS code_type
       FROM tag_code t JOIN print_batch b ON t.print_batch_id = b.id
       WHERE t.status = 'PENDING' ORDER BY t.created_at DESC;`,
    );
    return rows.map((r) => this.mapRow(r));
  }

  /** Lista los tags pertenecientes a un lote de impresión. */
  async getBatchTags(batchId: string): Promise<TagCode[]> {
    const rows = await this.db.query<TagRow>(
      'SELECT * FROM tag_code WHERE print_batch_id = ? ORDER BY created_at ASC;',
      [batchId],
    );
    return rows.map((r) => this.mapRow(r));
  }

  /** Devuelve un lote por id, o null si no existe. */
  async getBatchById(batchId: string): Promise<PrintBatch | null> {
    const rows = await this.db.query<BatchRow>(
      'SELECT * FROM print_batch WHERE id = ? LIMIT 1;',
      [batchId],
    );
    return rows.length ? this.mapBatchRow(rows[0]) : null;
  }

  /** Lista todos los lotes de impresión (más recientes primero). */
  async getAllBatches(): Promise<PrintBatch[]> {
    const rows = await this.db.query<BatchRow>(
      'SELECT * FROM print_batch ORDER BY created_at DESC;',
    );
    return rows.map((r) => this.mapBatchRow(r));
  }

  private mapBatchRow(r: BatchRow): PrintBatch {
    return {
      id: r.id,
      createdAt: r.created_at,
      quantity: r.quantity,
      layout: r.layout,
      codeType: r.code_type,
      syncedAt: r.synced_at ?? undefined,
    };
  }

  private mapRow(r: TagRow): TagCode {
    return {
      id: r.id,
      status: r.status,
      createdAt: r.created_at,
      assignedAt: r.assigned_at ?? undefined,
      assignedBy: r.assigned_by ?? undefined,
      productId: r.product_id ?? undefined,
      variantId: r.variant_id ?? undefined,
      printBatchId: r.print_batch_id,
      codeType: r.code_type ?? undefined,
      origin: r.origin ?? undefined,
      syncedAt: r.synced_at ?? undefined,
    };
  }
}
