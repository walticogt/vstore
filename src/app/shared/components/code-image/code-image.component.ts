import { Component, Input, OnChanges } from '@angular/core';
import JsBarcode from 'jsbarcode';
import * as QRCode from 'qrcode';

import { CodeType } from '../../../core/models/print-batch.model';

/**
 * CodeImageComponent — renderiza un código como imagen, respetando su tipo:
 * QR (qrcode) o código de barras CODE128 (jsbarcode). El dato es el mismo (el id del tag).
 */
@Component({
  selector: 'app-code-image',
  template: `<img *ngIf="dataUrl" [src]="dataUrl" [alt]="value" [style.width.px]="size" />`,
  standalone: false,
})
export class CodeImageComponent implements OnChanges {
  @Input() value = '';
  @Input() type: CodeType = 'QR';
  @Input() size = 120;

  dataUrl = '';

  async ngOnChanges(): Promise<void> {
    if (!this.value) {
      this.dataUrl = '';
      return;
    }
    this.dataUrl =
      this.type === 'BARCODE' ? this.barcodeDataUrl(this.value) : await this.qrDataUrl(this.value);
  }

  private qrDataUrl(text: string): Promise<string> {
    return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: 256 });
  }

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
}
