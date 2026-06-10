import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { AlertController, ToastController } from '@ionic/angular';

import { Product } from '../../../../core/models/product.model';
import { TagCode } from '../../../../core/models/tag-code.model';
import { ProductService } from '../../../../core/services/product.service';
import { TagService } from '../../../../core/services/tag.service';

/**
 * RelinkPage — re-vincula un producto a un código nuevo (reemplazo por sticker dañado).
 * El código anterior queda marcado como REPLACED (anulado). Selección por lista,
 * cámara (nativa ML Kit o web ZXing) o entrada manual; confirma antes de reemplazar.
 */
@Component({
  selector: 'app-relink',
  templateUrl: './relink.page.html',
  styleUrls: ['./relink.page.scss'],
  standalone: false,
})
export class RelinkPage {
  productId = '';
  variantId = '';
  product: Product | null = null;
  pending: TagCode[] = [];
  manualCode = '';
  canScan = false;
  scanning = false;

  private nativeScan = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly tags: TagService,
    private readonly products: ProductService,
    private readonly alertCtrl: AlertController,
    private readonly toastCtrl: ToastController,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.productId = this.route.snapshot.paramMap.get('id') ?? '';
    this.variantId = this.route.snapshot.paramMap.get('variantId') ?? '';
    this.product = await this.products.getProductById(this.productId);
    this.pending = await this.tags.getPendingTags();
    this.nativeScan = (await BarcodeScanner.isSupported()).supported;
    this.canScan = this.nativeScan || this.hasWebCamera();
  }

  /** True cuando se re-vincula el código principal del producto (no una variante). */
  get isProductLevel(): boolean {
    return this.variantId === 'main';
  }

  /** Etiqueta del objetivo del reemplazo (para mostrar contexto). */
  get variantLabel(): string {
    if (this.isProductLevel) {
      return 'Código principal del producto';
    }
    const v = this.product?.variants.find((x) => x.id === this.variantId);
    return v ? `${v.color || '—'} · ${v.size || '—'}` : '';
  }

  /** Pendientes filtrados en vivo por el código escrito. */
  get filteredPending(): TagCode[] {
    const q = this.manualCode.trim().toLowerCase();
    if (!q) {
      return this.pending;
    }
    return this.pending.filter((t) => t.id.toLowerCase().includes(q));
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
    void this.confirmReplace(code);
  }

  onScannerClosed(): void {
    this.scanning = false;
  }

  async submitManual(): Promise<void> {
    const value = this.manualCode.trim();
    if (value) {
      await this.confirmReplace(value);
    }
  }

  async confirmReplace(newCode: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar reemplazo',
      message: `El código ${newCode
        .slice(0, 8)
        .toUpperCase()} reemplazará al actual. El código anterior quedará anulado (Reemplazado). ¿Continuar?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Reemplazar',
          role: 'confirm',
          handler: () => {
            void this.doReplace(newCode);
          },
        },
      ],
    });
    await alert.present();
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
        await this.confirmReplace(value);
      }
    } catch (err) {
      console.error('[Relink] Error escaneando:', err);
      await this.showToast('No se pudo iniciar el escaneo.', 'danger');
    }
  }

  private async doReplace(newCode: string): Promise<void> {
    try {
      if (this.isProductLevel) {
        await this.tags.replaceProductTag(this.productId, newCode);
      } else {
        await this.tags.replaceTagForVariant(this.productId, this.variantId, newCode);
      }
      await this.showToast('Código vinculado correctamente.', 'success');
      await this.router.navigate(['/tabs/inventory/product', this.productId]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo re-vincular.';
      await this.showToast(message, 'danger');
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
