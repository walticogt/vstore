import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { v4 as uuidv4 } from 'uuid';

import { Product } from '../../../../core/models/product.model';
import { NewProductInput, ProductService } from '../../../../core/services/product.service';
import { TagService } from '../../../../core/services/tag.service';
import { buildSku } from '../../../../core/utils/sku.util';

type LinkMode = 'new' | 'existing';

/**
 * LinkFormPage — vincula un código (QR) a UNA variante específica (capabilities:
 * product-management + tag-linking). El QR identifica una variante (color/talla).
 *
 * Modo "Producto nuevo": crea el producto con esta primera variante.
 * Modo "Producto existente": agrega esta variante a un producto ya creado.
 * En ambos casos el QR queda vinculado a esa variante.
 */
@Component({
  selector: 'app-link-form',
  templateUrl: './link-form.page.html',
  styleUrls: ['./link-form.page.scss'],
  standalone: false,
})
export class LinkFormPage {
  tagId = '';
  saving = false;
  mode: LinkMode = 'new';
  productList: Product[] = [];
  photos: string[] = [];
  /** Producto preseleccionado (al venir de "Agregar prenda"); bloquea la elección. */
  lockedProductId = '';

  /** Sufijo estable del SKU (no cambia mientras se edita el formulario). */
  readonly skuSuffix = uuidv4().replace(/-/g, '').slice(0, 4);

  readonly form: FormGroup = this.fb.group({
    // Producto nuevo
    name: [''],
    price: [null],
    supplier: [''],
    costPrice: [null],
    // Producto existente
    productId: [''],
    // Variante (ambos modos) — cada prenda es individual, stock siempre 1.
    color: [''],
    size: [''],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly tags: TagService,
    private readonly productService: ProductService,
    private readonly toastCtrl: ToastController,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.tagId = this.route.snapshot.paramMap.get('tagId') ?? '';
    const tag = await this.tags.getTagById(this.tagId);

    if (!tag) {
      await this.showToast('Código no reconocido.', 'danger');
      await this.router.navigate(['/tabs/link']);
      return;
    }
    if (tag.status === 'ASSIGNED' && tag.productId) {
      await this.router.navigate(['/tabs/inventory/product', tag.productId]);
      return;
    }

    this.productList = await this.productService.getAllProducts();

    // Si se llega desde "Agregar prenda" de un producto, queda preseleccionado y bloqueado.
    this.lockedProductId = this.route.snapshot.queryParamMap.get('product') ?? '';
    if (this.lockedProductId) {
      this.mode = 'existing';
      this.form.patchValue({ productId: this.lockedProductId });
    } else {
      this.mode = this.productList.length === 0 ? 'new' : this.mode;
    }
  }

  /** SKU autogenerado en vivo a partir de proveedor + nombre (modo producto nuevo). */
  get generatedSku(): string {
    const { name, supplier } = this.form.value as { name: string; supplier: string };
    return buildSku(name, supplier, this.skuSuffix);
  }

  /** Nombre del producto preseleccionado (para mostrarlo cuando está bloqueado). */
  get lockedProductName(): string {
    return this.productList.find((p) => p.id === this.lockedProductId)?.name ?? '';
  }

  async save(): Promise<void> {
    if (this.saving) {
      return;
    }
    const v = this.form.value as {
      name: string;
      price: number | null;
      supplier: string;
      costPrice: number | null;
      productId: string;
      color: string;
      size: string;
    };

    if (this.mode === 'new' && (!v.name?.trim() || v.price == null)) {
      this.form.markAllAsTouched();
      await this.showToast('Nombre y precio son obligatorios.', 'danger');
      return;
    }
    if (this.mode === 'existing' && !v.productId) {
      await this.showToast('Elige un producto.', 'danger');
      return;
    }

    this.saving = true;
    try {
      // Cada prenda es una pieza individual: stock siempre 1.
      const variant = {
        color: v.color?.trim() ?? '',
        size: v.size?.trim() ?? '',
        stock: 1,
      };

      let productId: string;
      let variantId: string;

      if (this.mode === 'new') {
        const input: NewProductInput = {
          name: v.name.trim(),
          price: Number(v.price),
          sku: this.generatedSku,
          supplier: v.supplier?.trim() || undefined,
          costPrice: v.costPrice != null ? Number(v.costPrice) : undefined,
          images: this.photos.length ? this.photos : undefined,
          variants: [variant],
        };
        const product = await this.productService.createProduct(input);
        productId = product.id;
        variantId = product.variants[0].id;
      } else {
        productId = v.productId;
        const created = await this.productService.addVariant(productId, variant);
        variantId = created.id;
      }

      await this.tags.assignTag(this.tagId, productId, variantId);
      await this.showToast('Código vinculado a la variante.', 'success');
      await this.router.navigate(['/tabs/inventory/product', productId]);
    } catch (err) {
      console.error('[LinkForm] Error vinculando:', err);
      await this.showToast('No se pudo vincular.', 'danger');
    } finally {
      this.saving = false;
    }
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2500 });
    await toast.present();
  }
}
