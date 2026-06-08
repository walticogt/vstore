import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import * as QRCode from 'qrcode';

import { PrintBatch } from '../models/print-batch.model';
import { TagCode } from '../models/tag-code.model';

/**
 * Layout de la hoja A4 (mm). Grid 5×8 = 40 stickers por hoja.
 * Sticker ≈ 38.4 × 34.1 mm; QR 20×20 mm centrado; código (8 chars) debajo.
 */
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 5;
const COLS = 5;
const ROWS = 8;
const GAP = 2;
const PER_PAGE = COLS * ROWS;

const CELL_W = (PAGE_W - 2 * MARGIN - (COLS - 1) * GAP) / COLS;
const CELL_H = (PAGE_H - 2 * MARGIN - (ROWS - 1) * GAP) / ROWS;

const QR_SIZE = 20;          // mm
const BARCODE_H = 12;        // mm
const CODE_CHARS = 8;        // primeros caracteres del UUID mostrados como texto
const LABEL_GAP = 1.5;       // mm de separación entre el código y su texto
const LABEL_H = 2.5;         // mm de altura aproximada del texto (≈7pt)

/**
 * PrintService — generación e impresión de etiquetas (capability: label-printing).
 *
 * Dibuja el PDF directamente con jsPDF (addImage para QR/barras + texto) en lugar
 * de html2canvas: mayor nitidez del código y posicionamiento exacto. 100% offline.
 */
@Injectable({ providedIn: 'root' })
export class PrintService {
  /**
   * Genera el PDF A4 con un sticker por cada tag, en grid 5×8. Pagina automáticamente
   * si hay más de 40 tags. Cada sticker lleva el QR/barras y los primeros 8 chars del id.
   */
  async generatePdf(batch: PrintBatch, tags: TagCode[]): Promise<Blob> {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const indexInPage = i % PER_PAGE;
      if (i > 0 && indexInPage === 0) {
        doc.addPage();
      }

      const col = indexInPage % COLS;
      const row = Math.floor(indexInPage / COLS);
      const cellX = MARGIN + col * (CELL_W + GAP);
      const cellY = MARGIN + row * (CELL_H + GAP);
      const centerX = cellX + CELL_W / 2;

      const dataUrl =
        batch.codeType === 'BARCODE'
          ? this.barcodeDataUrl(tag.id)
          : await this.qrDataUrl(tag.id);

      // Alto del código + separación + texto, para centrar el bloque verticalmente
      // y colocar la etiqueta pegada justo debajo del código.
      const codeH = batch.codeType === 'BARCODE' ? BARCODE_H : QR_SIZE;
      const blockH = codeH + LABEL_GAP + LABEL_H;
      const codeTop = cellY + Math.max(1, (CELL_H - blockH) / 2);

      if (batch.codeType === 'BARCODE') {
        const bw = CELL_W - 4;
        doc.addImage(dataUrl, 'PNG', centerX - bw / 2, codeTop, bw, BARCODE_H);
      } else {
        doc.addImage(dataUrl, 'PNG', centerX - QR_SIZE / 2, codeTop, QR_SIZE, QR_SIZE);
      }

      doc.setFontSize(7);
      const label = tag.id.slice(0, CODE_CHARS).toUpperCase();
      doc.text(label, centerX, codeTop + codeH + LABEL_GAP + LABEL_H, { align: 'center' });
    }

    return doc.output('blob');
  }

  /**
   * Comparte el PDF mediante el diálogo nativo (Android) para imprimir/enviar.
   * En navegador dispara una descarga directa del archivo.
   */
  async sharePdf(pdf: Blob, filename: string): Promise<void> {
    if (Capacitor.getPlatform() === 'web') {
      const url = URL.createObjectURL(pdf);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      return;
    }

    const base64 = await this.blobToBase64(pdf);
    const written = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title: filename,
      url: written.uri,
      dialogTitle: 'Imprimir / compartir etiquetas',
    });
  }

  /** Genera un QR como data URL PNG (alta resolución para impresión nítida). */
  private qrDataUrl(text: string): Promise<string> {
    return QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
    });
  }

  /** Genera un código de barras CODE128 como data URL PNG mediante un canvas offscreen. */
  private barcodeDataUrl(text: string): string {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, text, {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      height: 60,
      width: 1,
    });
    return canvas.toDataURL('image/png');
  }

  /** Convierte un Blob a base64 (sin el prefijo data:) para Filesystem.writeFile. */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] ?? '');
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
}
