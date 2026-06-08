import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { ToastController } from '@ionic/angular';

import { TagService } from '../../../../core/services/tag.service';

/**
 * ScanLookupPage — escanear/buscar un código para abrir directamente el detalle del
 * producto vinculado (capability: inventory-consultation). Si el código está PENDING,
 * informa que aún no está vinculado; si no existe, "no reconocido".
 */
@Component({
  selector: 'app-scan-lookup',
  templateUrl: './scan-lookup.page.html',
  styleUrls: ['./scan-lookup.page.scss'],
  standalone: false,
})
export class ScanLookupPage {
  cameraSupported = false;
  manualCode = '';

  constructor(
    private readonly tags: TagService,
    private readonly router: Router,
    private readonly toastCtrl: ToastController,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.cameraSupported = (await BarcodeScanner.isSupported()).supported;
  }

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
        await this.lookup(value);
      }
    } catch (err) {
      console.error('[ScanLookup] Error escaneando:', err);
      await this.showToast('No se pudo iniciar el escaneo.', 'danger');
    }
  }

  async submitManual(): Promise<void> {
    const value = this.manualCode.trim();
    if (value) {
      await this.lookup(value);
    }
  }

  private async lookup(code: string): Promise<void> {
    const tag = await this.tags.getTagById(code);

    if (!tag) {
      await this.showToast('Código no reconocido.', 'danger');
      return;
    }
    if (tag.status === 'REPLACED') {
      await this.showToast('Este código fue reemplazado y está anulado.', 'danger');
      return;
    }
    if (tag.status === 'PENDING' || !tag.productId) {
      await this.showToast('Este código aún no está vinculado a un producto.', 'warning');
      return;
    }
    await this.router.navigate(['/tabs/inventory/product', tag.productId]);
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2500 });
    await toast.present();
  }
}
