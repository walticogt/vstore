import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { AlertController, ToastController } from '@ionic/angular';

import { Product } from '../../../../core/models/product.model';
import { TagCode } from '../../../../core/models/tag-code.model';
import { ProductService } from '../../../../core/services/product.service';
import { TagService } from '../../../../core/services/tag.service';

/**
 * RelinkPage — re-vincula un producto a un código nuevo (reemplazo por sticker dañado).
 * El código anterior queda marcado como REPLACED (anulado). El usuario elige un código
 * PENDING por lista, manual o cámara, y confirma.
 */
@Component({
  selector: 'app-relink',
  templateUrl: './relink.page.html',
  styleUrls: ['./relink.page.scss'],
  standalone: false,
})
export class RelinkPage {
  productId = '';
  product: Product | null = null;
  pending: TagCode[] = [];
  manualCode = '';
  cameraSupported = false;

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
    this.product = await this.products.getProductById(this.productId);
    this.pending = await this.tags.getPendingTags();
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
        await this.confirmReplace(value);
      }
    } catch (err) {
      console.error('[Relink] Error escaneando:', err);
      await this.showToast('No se pudo iniciar el escaneo.', 'danger');
    }
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

  private async doReplace(newCode: string): Promise<void> {
    try {
      await this.tags.replaceTag(this.productId, newCode);
      await this.showToast('Producto re-vinculado al nuevo código.', 'success');
      await this.router.navigate(['/tabs/inventory/product', this.productId]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo re-vincular.';
      await this.showToast(message, 'danger');
    }
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2500 });
    await toast.present();
  }
}
