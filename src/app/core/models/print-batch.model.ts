export type PrintLayout = '5x8' | '5x10';
export type CodeType = 'QR' | 'BARCODE';

/**
 * PrintBatch — lote de impresión. Agrupa los TagCode generados en una misma hoja.
 */
export interface PrintBatch {
  id: string;            // UUID v4
  createdAt: string;     // ISO 8601
  quantity: number;      // Cantidad de stickers (default 40)
  layout: PrintLayout;   // Grid de impresión (extensible en el futuro)
  codeType: CodeType;
  syncedAt?: string;
}
