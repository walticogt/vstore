import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { ToastController } from '@ionic/angular';

import { TagCode } from '../../../../core/models/tag-code.model';
import { TagService } from '../../../../core/services/tag.service';

/**
 * ScanPage — escanea un código y redirige según su estado (capability: tag-linking).
 * PENDING → formulario de vinculación · ASSIGNED → detalle · inexistente → error.
 *
 * La cámara (mlkit) es solo nativa; en navegador se usa la entrada manual para probar
 * el flujo (pegar/teclear el id del código o el de un tag pendiente).
 */
@Component({
  selector: 'app-scan',
  templateUrl: './scan.page.html',
  styleUrls: ['./scan.page.scss'],
  standalone: false,
})
export class ScanPage {
  cameraSupported = false;
  manualCode = '';
  pending: TagCode[] = [];

  constructor(
    private readonly tags: TagService,
    private readonly router: Router,
    private readonly toastCtrl: ToastController,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.cameraSupported = (await BarcodeScanner.isSupported()).supported;
    // Lista de pendientes como atajo para pruebas (sobre todo en navegador).
    this.pending = await this.tags.getPendingTags();
  }

  /** Escaneo con la cámara nativa (mlkit). */
  async scanWithCamera(): Promise<void> {
    try {
      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera !== 'granted' && camera !== 'limited') {
        await this.showToast('Permiso de cámara denegado.', 'danger');
        return;
      }
      const { barcodes } = await BarcodeScanner.scan();
      const value = barcodes[0]?.rawValue;
      if (value) {
        await this.resolveCode(value);
      }
    } catch (err) {
      console.error('[Scan] Error escaneando:', err);
      await this.showToast('No se pudo iniciar el escaneo.', 'danger');
    }
  }

  /** Resolución manual (navegador / respaldo). */
  async submitManual(): Promise<void> {
    const value = this.manualCode.trim();
    if (value) {
      await this.resolveCode(value);
    }
  }

  /** Redirige según el estado del tag resuelto. */
  async resolveCode(code: string): Promise<void> {
    const tag = await this.tags.getTagById(code);

    if (!tag) {
      await this.showToast('Código no reconocido.', 'danger');
      return;
    }

    if (tag.status === 'REPLACED') {
      await this.showToast('Este código fue reemplazado y está anulado.', 'danger');
      return;
    }

    if (tag.status === 'PENDING') {
      await this.router.navigate(['/tabs/link/form', tag.id]);
    } else if (tag.productId) {
      await this.router.navigate(['/tabs/inventory/product', tag.productId]);
    }
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2500 });
    await toast.present();
  }
}
