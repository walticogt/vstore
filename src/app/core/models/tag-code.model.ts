export type TagStatus = 'PENDING' | 'ASSIGNED' | 'REPLACED' | 'DISCARDED';

/** Procedencia del código: generado en un lote normal, o recuperado (escaneado sin registro local). */
export type TagOrigin = 'GENERATED' | 'RECOVERED';

/**
 * TagCode — el código QR/barras. Su `id` (UUID v4) es el dato codificado en el QR.
 * Estado inicial PENDING (impreso sin producto) → ASSIGNED al vincularse.
 */
export interface TagCode {
  id: string;            // UUID v4 — identificador único (es el dato del QR)
  status: TagStatus;     // PENDING = impreso sin producto | ASSIGNED = vinculado | REPLACED = anulado por reemplazo | DISCARDED = desechado (perdido/dañado)
  createdAt: string;     // ISO 8601
  assignedAt?: string;   // ISO 8601, se llena al vincular
  assignedBy?: string;   // Usuario que realizó la vinculación (default si no hay login)
  productId?: string;    // FK → Product.id (denormalizado), undefined si PENDING
  variantId?: string;    // FK → ProductVariant.id — el QR identifica una variante específica
  printBatchId: string;  // ID del lote de impresión al que pertenece
  codeType?: 'QR' | 'BARCODE'; // Tipo heredado del lote (para renderizar QR o barras)
  origin?: TagOrigin;    // GENERATED (lote normal) | RECOVERED (escaneado sin registro, recuperado)
  syncedAt?: string;     // Última sincronización a Firebase
}
