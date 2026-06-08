export type TagStatus = 'PENDING' | 'ASSIGNED' | 'REPLACED';

/**
 * TagCode — el código QR/barras. Su `id` (UUID v4) es el dato codificado en el QR.
 * Estado inicial PENDING (impreso sin producto) → ASSIGNED al vincularse.
 */
export interface TagCode {
  id: string;            // UUID v4 — identificador único (es el dato del QR)
  status: TagStatus;     // PENDING = impreso sin producto | ASSIGNED = vinculado | REPLACED = anulado por reemplazo
  createdAt: string;     // ISO 8601
  assignedAt?: string;   // ISO 8601, se llena al vincular
  assignedBy?: string;   // Usuario que realizó la vinculación (default si no hay login)
  productId?: string;    // FK → Product.id, undefined si PENDING
  printBatchId: string;  // ID del lote de impresión al que pertenece
  syncedAt?: string;     // Última sincronización a Firebase
}
