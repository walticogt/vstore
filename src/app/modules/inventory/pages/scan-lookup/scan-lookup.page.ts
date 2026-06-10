import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { AlertController, ToastController } from '@ionic/angular';

import { TagService } from '../../../../core/services/tag.service';

/**
 * ScanLookupPage — escanear/buscar un código para abrir el detalle del producto vinculado
 * (capability: inventory-consultation). Cámara nativa (ML Kit) o web (ZXing), + manual.
 */
@Component({
  selector: 'app-scan-lookup',
  templateUrl: './scan-lookup.page.html',
  styleUrls: ['./scan-lookup.page.scss'],
  standalone: false,
})
export class ScanLookupPage {
  canScan = false;
  scanning = false;
  manualCode = '';

  private nativeScan = false;

  constructor(
    private readonly tags: TagService,
    private readonly router: Router,
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.nativeScan = (await BarcodeScanner.isSupported()).supported;
    this.canScan = this.nativeScan || this.hasWebCamera();
    // Abre la cámara directamente al entrar (esta pantalla es para escanear).
    if (this.canScan) {
      await this.startScan();
    }
  }

  ionViewWillLeave(): void {
    this.scanning = false;
  }

  async startScan(): Promise<void> {
    if (this.nativeScan) {
      await this.scanNative();
    } else {
      this.scanning = true;
    }
  }

  onScanned(code: string): void {
    this.scanning = false;
    void this.lookup(code);
  }

  onScannerClosed(): void {
    this.scanning = false;
  }

  async submitManual(): Promise<void> {
    const value = this.manualCode.trim();
    if (value) {
      await this.lookup(value);
    }
  }

  private async lookup(code: string): Promise<void> {
    const tag = await this.tags.resolveByCode(code);

    if (!tag) {
      await this.offerRecovery(code);
      return;
    }
    if (tag.status === 'REPLACED') {
      await this.showToast('Este código fue reemplazado y está anulado.', 'danger');
      return;
    }
    if (tag.status === 'DISCARDED') {
      await this.showToast('Este código fue desechado.', 'danger');
      return;
    }
    if (tag.status === 'PENDING' || !tag.productId) {
      await this.showToast('Este código aún no está vinculado a un producto.', 'warning');
      return;
    }
    await this.router.navigate(['/tabs/inventory/product', tag.productId], {
      queryParams: { variant: tag.variantId },
    });
  }

  /**
   * Código no encontrado localmente (posiblemente generado en otra versión y cuyo registro
   * se perdió): ofrece registrarlo como "Recuperado" y seguir el flujo normal de vinculación.
   */
  private async offerRecovery(code: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Código no encontrado',
      message:
        '¿Desea registrarlo? Se guardará como "Recuperado" y continuará con la vinculación normal.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Registrar', handler: () => void this.recoverAndLink(code) },
      ],
    });
    await alert.present();
  }

  private async recoverAndLink(code: string): Promise<void> {
    try {
      const tag = await this.tags.recoverCode(code);
      await this.router.navigate(['/tabs/link/form', tag.id]);
    } catch (err) {
      console.error('[ScanLookup] Error recuperando código:', err);
      await this.showToast('No se pudo registrar el código.', 'danger');
    }
  }

  private async scanNative(): Promise<void> {
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

  private hasWebCamera(): boolean {
    return Capacitor.getPlatform() === 'web' && !!navigator.mediaDevices?.getUserMedia;
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2500 });
    await toast.present();
  }
}
