import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';

import { CodeType, PrintBatch, PrintLayout } from '../models/print-batch.model';
import { TagCode, TagStatus } from '../models/tag-code.model';
import { DatabaseService } from './database.service';
import { SessionService } from './session.service';

/** Cantidad de stickers por hoja A4 (grid 5×8). */
export const DEFAULT_BATCH_QUANTITY = 40;
const DEFAULT_LAYOUT: PrintLayout = '5x8';

/** Fila cruda de tag_code tal como la devuelve SQLite (snake_case). */
interface TagRow {
  id: string;
  status: TagStatus;
  created_at: string;
  assigned_at: string | null;
  assigned_by: string | null;
  product_id: string | null;
  print_batch_id: string;
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
      layout: DEFAULT_LAYOUT,
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
   * Vincula un tag PENDING a un producto: pasa a ASSIGNED y registra assignedAt/productId.
   * Si el tag ya está ASSIGNED, la actualización es un no-op (no re-vincula).
   */
  async assignTag(tagId: string, productId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.execute(
      'UPDATE tag_code SET status = ?, assigned_at = ?, assigned_by = ?, product_id = ? WHERE id = ? AND status = ?;',
      ['ASSIGNED', now, this.session.currentUser, productId, tagId, 'PENDING'],
    );
  }

  /**
   * Re-vincula un producto a un código nuevo (reemplazo por sticker dañado/perdido):
   * marca como REPLACED el/los códigos ASSIGNED actuales del producto y asigna el nuevo
   * código PENDING al mismo producto. Todo en una transacción.
   */
  async replaceTag(productId: string, newTagId: string): Promise<void> {
    const newTag = await this.getTagById(newTagId);
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
          "UPDATE tag_code SET status = 'REPLACED' WHERE product_id = ? AND status = 'ASSIGNED';",
        values: [productId],
      },
      {
        statement:
          "UPDATE tag_code SET status = 'ASSIGNED', assigned_at = ?, assigned_by = ?, product_id = ? WHERE id = ? AND status = 'PENDING';",
        values: [now, user, productId, newTagId],
      },
    ]);
  }

  /** Código actualmente vinculado (ASSIGNED) a un producto, o null. */
  async getActiveTagByProduct(productId: string): Promise<TagCode | null> {
    const rows = await this.db.query<TagRow>(
      "SELECT * FROM tag_code WHERE product_id = ? AND status = 'ASSIGNED' ORDER BY assigned_at DESC LIMIT 1;",
      [productId],
    );
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  /** Devuelve el tag por id, o null si no existe. */
  async getTagById(tagId: string): Promise<TagCode | null> {
    const rows = await this.db.query<TagRow>('SELECT * FROM tag_code WHERE id = ? LIMIT 1;', [
      tagId,
    ]);
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  /** Lista los tags en estado PENDING (más recientes primero). */
  async getPendingTags(): Promise<TagCode[]> {
    const rows = await this.db.query<TagRow>(
      "SELECT * FROM tag_code WHERE status = 'PENDING' ORDER BY created_at DESC;",
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
      printBatchId: r.print_batch_id,
      syncedAt: r.synced_at ?? undefined,
    };
  }
}
