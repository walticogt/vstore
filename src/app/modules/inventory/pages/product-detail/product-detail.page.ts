import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';

import { Product, ProductVariant } from '../../../../core/models/product.model';
import { TagCode } from '../../../../core/models/tag-code.model';
import { ProductService } from '../../../../core/services/product.service';
import { TagService } from '../../../../core/services/tag.service';

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
  highlightVariantId = '';
  photoIndex = 0;

  private tagByVariant = new Map<string, TagCode>();
  private photoTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly productService: ProductService,
    private readonly tags: TagService,
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

  get stockTotal(): number {
    return this.product?.variants.reduce((sum, v) => sum + v.stock, 0) ?? 0;
  }

  /** Código (tag) actualmente vinculado a una variante, si existe. */
  variantTag(variantId: string): TagCode | undefined {
    return this.tagByVariant.get(variantId);
  }

  /** Agrega otra prenda a este producto: escanea su código (stock 1, amarrada al QR/barras). */
  async addPrenda(): Promise<void> {
    if (!this.product) {
      return;
    }
    await this.router.navigate(['/tabs/link'], { queryParams: { product: this.product.id } });
  }

  /** Quita una prenda (variante) del producto, previa confirmación. */
  async removeVariant(variant: ProductVariant): Promise<void> {
    const label = `${variant.color || '—'} · ${variant.size || '—'}`;
    const alert = await this.alertCtrl.create({
      header: 'Quitar prenda',
      message: `¿Quitar la prenda "${label}"? Su código quedará desechado (fuera de circulación).`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Quitar', role: 'destructive', handler: () => void this.doRemoveVariant(variant.id) },
      ],
    });
    await alert.present();
  }

  private async doRemoveVariant(variantId: string): Promise<void> {
    await this.productService.removeVariant(variantId);
    await this.reload();
    const toast = await this.toastCtrl.create({
      message: 'Prenda quitada.',
      duration: 1200,
      position: 'bottom',
    });
    await toast.present();
  }

  private async reload(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    this.product = await this.productService.getProductById(id);
    const activeTags = await this.tags.getActiveTagsByProduct(id);
    this.tagByVariant = new Map(
      activeTags.filter((t) => t.variantId).map((t) => [t.variantId as string, t]),
    );
  }
}
