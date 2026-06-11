import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';

import { Color, Supplier } from '../../../../core/models/config.model';
import { Product, ProductVariant } from '../../../../core/models/product.model';
import { TagCode } from '../../../../core/models/tag-code.model';
import { ConfigService } from '../../../../core/services/config.service';
import { ProductService } from '../../../../core/services/product.service';
import { TagService } from '../../../../core/services/tag.service';
import { whatsappUrl } from '../../../../core/utils/whatsapp.util';

/**
 * ProductDetailPage — detalle del producto y sus prendas (variantes). Cada prenda es una
 * pieza individual (stock 1) con su propio código. Se pueden agregar prendas nuevas (+,
 * escaneando su código) o quitarlas (−).
 */
@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.page.html',
  styleUrls: ['./product-detail.page.scss'],
  standalone: false,
})
export class ProductDetailPage {
  product: Product | null = null;
  supplier: Supplier | null = null;
  highlightVariantId = '';
  photoIndex = 0;

  private colorHexByName = new Map<string, string>();
  private tagByVariant = new Map<string, TagCode>();
  private photoTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly productService: ProductService,
    private readonly tags: TagService,
    private readonly config: ConfigService,
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.highlightVariantId = this.route.snapshot.queryParamMap.get('variant') ?? '';
    await this.reload();
    this.startCarousel();
  }

  ionViewWillLeave(): void {
    this.stopCarousel();
  }

  get photos(): string[] {
    return this.product?.images ?? [];
  }

  /** Rota las fotos cada 1s en bucle si hay más de una. */
  private startCarousel(): void {
    this.stopCarousel();
    this.photoIndex = 0;
    if (this.photos.length > 1) {
      this.photoTimer = setInterval(() => {
        this.photoIndex = (this.photoIndex + 1) % this.photos.length;
      }, 1000);
    }
  }

  private stopCarousel(): void {
    if (this.photoTimer) {
      clearInterval(this.photoTimer);
      this.photoTimer = undefined;
    }
  }

  /** Stock disponible = prendas en estado ACTIVE (cada prenda es 1). */
  get stockTotal(): number {
    return this.product?.variants.filter((v) => v.status === 'ACTIVE').length ?? 0;
  }

  /** Código (tag) actualmente vinculado a una variante, si existe. */
  variantTag(variantId: string): TagCode | undefined {
    return this.tagByVariant.get(variantId);
  }

  /** Hex del color por su nombre (del catálogo), para pintar el círculo. */
  colorHex(name: string): string | undefined {
    return this.colorHexByName.get((name ?? '').trim().toLowerCase());
  }

  /** Agrega otra prenda a este producto: escanea su código (stock 1, amarrada al QR/barras). */
  async addPrenda(): Promise<void> {
    if (!this.product) {
      return;
    }
    await this.router.navigate(['/tabs/link'], { queryParams: { product: this.product.id } });
  }

  /** Vende una prenda: pide el precio (pre-llenado con el del producto) y la marca VENDIDA. */
  async sellVariant(variant: ProductVariant): Promise<void> {
    const label = `${variant.color || '—'} · ${variant.size || '—'}`;
    const defaultPrice = this.product?.price ?? 0;
    const alert = await this.alertCtrl.create({
      header: 'Vender prenda',
      message: `Precio de venta de "${label}":`,
      inputs: [
        {
          name: 'price',
          type: 'number',
          value: defaultPrice,
          placeholder: 'Precio (S/)',
          min: 0,
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Vender',
          handler: (data: { price?: string | number }) => {
            const price = Number(data.price);
            if (Number.isNaN(price) || price < 0) {
              void this.toast('Precio inválido.');
              return false;
            }
            void this.doSell(variant.id, price);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private async doSell(variantId: string, price: number): Promise<void> {
    await this.productService.markVariantSold(variantId, price);
    await this.reload();
    await this.toast('Prenda vendida.');
  }

  /** Marca una prenda como EXTRAVIADA (queda en gris). Requiere escribir "extraviada". */
  async lostVariant(variant: ProductVariant): Promise<void> {
    const label = `${variant.color || '—'} · ${variant.size || '—'}`;
    const alert = await this.alertCtrl.create({
      header: 'Marcar extraviada',
      message: `Vas a marcar "${label}" como extraviada (queda en gris para reportes de pérdidas). Para confirmar, escribe: extraviada`,
      inputs: [{ name: 'confirm', type: 'text', placeholder: 'extraviada' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          role: 'destructive',
          handler: (data: { confirm?: string }) => {
            if ((data.confirm ?? '').trim().toLowerCase() !== 'extraviada') {
              void this.toast('Texto incorrecto. No se marcó nada.');
              return false;
            }
            void this.productService.markVariantLost(variant.id).then(() => {
              void this.reload();
              void this.toast('Prenda marcada extraviada.');
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  /**
   * Revierte una prenda a disponible. La palabra de confirmación depende del estado:
   * vendida → "anular compra"; extraviada → "recuperar".
   */
  async revertVariant(variant: ProductVariant): Promise<void> {
    const label = `${variant.color || '—'} · ${variant.size || '—'}`;
    const isSold = variant.status === 'SOLD';
    const word = isSold ? 'anular compra' : 'recuperar';
    const alert = await this.alertCtrl.create({
      header: isSold ? 'Anular compra' : 'Recuperar prenda',
      message: `Vas a volver "${label}" a Disponible. Para confirmar, escribe: ${word}`,
      inputs: [{ name: 'confirm', type: 'text', placeholder: word }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: (data: { confirm?: string }) => {
            if ((data.confirm ?? '').trim().toLowerCase() !== word) {
              void this.toast('Texto incorrecto. No se hizo nada.');
              return false;
            }
            void this.productService.revertVariant(variant.id).then(() => {
              void this.reload();
              void this.toast(isSold ? 'Compra anulada. Prenda disponible.' : 'Prenda recuperada.');
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private async toast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 1200, position: 'bottom' });
    await toast.present();
  }

  private async reload(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    this.product = await this.productService.getProductById(id);
    this.supplier = this.product?.supplierId
      ? await this.config.getSupplierById(this.product.supplierId)
      : null;
    const colors: Color[] = await this.config.getColors();
    this.colorHexByName = new Map(colors.map((c) => [c.name.trim().toLowerCase(), c.hex]));
    const activeTags = await this.tags.getActiveTagsByProduct(id);
    this.tagByVariant = new Map(
      activeTags.filter((t) => t.variantId).map((t) => [t.variantId as string, t]),
    );
  }

  /** Abre WhatsApp con el proveedor, mencionando este producto (mensaje editable). */
  async openSupplierWhatsApp(): Promise<void> {
    const storeName = localStorage.getItem('vstore.storeName') ?? 'mi tienda';
    const message = `Hola ${this.supplier?.name ?? ''}, le escribe ${storeName}. Consulto por: ${this.product?.name ?? ''}.`;
    const url = whatsappUrl(this.supplier?.whatsapp, message);
    if (!url) {
      const toast = await this.toastCtrl.create({
        message: 'El proveedor no tiene WhatsApp.',
        duration: 1500,
      });
      await toast.present();
      return;
    }
    window.open(url, '_blank');
  }
}
