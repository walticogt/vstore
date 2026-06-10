import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { AlertController, ToastController } from '@ionic/angular';

import { TagCode } from '../../../../core/models/tag-code.model';
import { TagService } from '../../../../core/services/tag.service';

/**
 * ScanPage — escanea un código y redirige según su estado (capability: tag-linking).
 * PENDING → formulario de vinculación · ASSIGNED → detalle · inexistente → error.
 *
 * Escaneo con cámara: en nativo usa ML Kit; en navegador usa el escáner web (ZXing)
 * vía CameraScannerComponent. La entrada manual queda como respaldo.
 */
@Component({
  selector: 'app-scan',
  templateUrl: './scan.page.html',
  styleUrls: ['./scan.page.scss'],
  standalone: false,
})
export class ScanPage {
  canScan = false;
  scanning = false;
  manualCode = '';
  pending: TagCode[] = [];

  private nativeScan = false;
  /** Si se llega desde "Agregar prenda" de un producto, su id (para vincular ahí directo). */
  private addToProductId = '';

  constructor(
    private readonly tags: TagService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController,
  ) {}

  /** Pendientes filtrados en vivo por lo que se escribe en el campo de código. */
  get filteredPending(): TagCode[] {
    const q = this.manualCode.trim().toLowerCase();
    if (!q) {
      return this.pending;
    }
    return this.pending.filter((t) => t.id.toLowerCase().includes(q));
  }

  async ionViewWillEnter(): Promise<void> {
    this.addToProductId = this.route.snapshot.queryParamMap.get('product') ?? '';
    this.nativeScan = (await BarcodeScanner.isSupported()).supported;
    this.canScan = this.nativeScan || this.hasWebCamera();
    this.pending = await this.tags.getPendingTags();
  }

  /** Opciones de navegación al formulario, propagando el producto destino si lo hay. */
  private formNavExtras(): { queryParams: { product: string } } | undefined {
    return this.addToProductId ? { queryParams: { product: this.addToProductId } } : undefined;
  }

  ionViewWillLeave(): void {
    this.scanning = false;
  }

  /** Inicia el escaneo: nativo (ML Kit) o muestra el escáner web. */
  async startScan(): Promise<void> {
    if (this.nativeScan) {
      await this.scanNative();
    } else {
      this.scanning = true;
    }
  }

  onScanned(code: string): void {
    this.scanning = false;
    void this.resolveCode(code);
  }

  onScannerClosed(): void {
    this.scanning = false;
  }

  async submitManual(): Promise<void> {
    const value = this.manualCode.trim();
    if (value) {
      await this.resolveCode(value);
    }
  }

  /**
   * Desecha (oculta) todos los códigos pendientes, previa confirmación escribiendo
   * exactamente "desechar codigos". Para stickers perdidos/dañados que nunca se vincularán.
   */
  async discardPending(): Promise<void> {
    const total = this.pending.length;
    const alert = await this.alertCtrl.create({
      header: 'Desechar códigos',
      message: `Se ocultarán los ${total} códigos pendientes (perdidos o dañados). No se borran, quedan como "Desechado". Para confirmar, escribe: desechar codigos`,
      inputs: [{ name: 'confirm', type: 'text', placeholder: 'desechar codigos' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desechar',
          role: 'destructive',
          handler: (data: { confirm?: string }) => {
            const ok = (data.confirm ?? '').trim().toLowerCase() === 'desechar codigos';
            if (!ok) {
              void this.showToast('Texto incorrecto. No se desechó nada.', 'danger');
              return false;
            }
            void this.doDiscard();
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private async doDiscard(): Promise<void> {
    const n = await this.tags.discardAllPending();
    this.pending = await this.tags.getPendingTags();
    this.manualCode = '';
    await this.showToast(`${n} código(s) desechado(s).`, 'success');
  }

  /** Redirige según el estado del tag resuelto. */
  async resolveCode(code: string): Promise<void> {
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
    if (tag.status === 'PENDING') {
      await this.router.navigate(['/tabs/link/form', tag.id], this.formNavExtras());
    } else if (tag.productId) {
      await this.router.navigate(['/tabs/inventory/product', tag.productId], {
        queryParams: { variant: tag.variantId },
      });
    }
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
      await this.router.navigate(['/tabs/link/form', tag.id], this.formNavExtras());
    } catch (err) {
      console.error('[Scan] Error recuperando código:', err);
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
        await this.resolveCode(value);
      }
    } catch (err) {
      console.error('[Scan] Error escaneando:', err);
      await this.showToast('No se pudo iniciar el escaneo.', 'danger');
    }
  }

  private hasWebCamera(): boolean {
    return Capacitor.getPlatform() === 'web' && !!navigator.mediaDevices?.getUserMedia;
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2500 });
    await toast.present();
  }
}
