import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { v4 as uuidv4 } from 'uuid';

import { Color, Size, Supplier } from '../../../../core/models/config.model';
import { Product } from '../../../../core/models/product.model';
import { ConfigService } from '../../../../core/services/config.service';
import { NewProductInput, ProductService } from '../../../../core/services/product.service';
import { TagService } from '../../../../core/services/tag.service';
import { buildSku } from '../../../../core/utils/sku.util';

type LinkMode = 'new' | 'existing';

/**
 * LinkFormPage — asistente de 2 pasos para vincular un código (QR/barras) a UNA prenda.
 * Paso 1: el producto (nuevo o existente, proveedor, documento). Paso 2: la variante de
 * este código (color de la paleta, talla por radio). Cada prenda es individual: stock 1.
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
  step: 1 | 2 = 1;
  mode: LinkMode = 'new';
  productList: Product[] = [];
  photos: string[] = [];
  /** Producto preseleccionado (al venir de "Agregar prenda"); bloquea la elección. */
  lockedProductId = '';

  // Catálogos (configuración) que alimentan el paso 2 y el proveedor.
  colors: Color[] = [];
  sizes: Size[] = [];
  suppliers: Supplier[] = [];

  /** Sufijo estable del SKU (no cambia mientras se edita el formulario). */
  readonly skuSuffix = uuidv4().replace(/-/g, '').slice(0, 4);

  readonly form: FormGroup = this.fb.group({
    // Producto nuevo
    name: [''],
    price: [null],
    supplierId: [''],
    purchaseDoc: [''],
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
    private readonly config: ConfigService,
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.step = 1;
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
    this.colors = await this.config.getColors();
    this.sizes = await this.config.getSizes();
    this.suppliers = await this.config.getSuppliers();

    // Si se llega desde "Agregar prenda" de un producto, queda preseleccionado y bloqueado.
    this.lockedProductId = this.route.snapshot.queryParamMap.get('product') ?? '';
    if (this.lockedProductId) {
      this.mode = 'existing';
      this.form.patchValue({ productId: this.lockedProductId });
    } else {
      this.mode = this.productList.length === 0 ? 'new' : this.mode;
    }
  }

  /** Nombre del proveedor seleccionado (para el SKU y la vista). */
  get selectedSupplierName(): string {
    return this.suppliers.find((s) => s.id === this.form.value.supplierId)?.name ?? '';
  }

  /** SKU autogenerado en vivo a partir de proveedor + nombre (modo producto nuevo). */
  get generatedSku(): string {
    return buildSku(this.form.value.name ?? '', this.selectedSupplierName, this.skuSuffix);
  }

  /** Nombre del producto preseleccionado (para mostrarlo cuando está bloqueado). */
  get lockedProductName(): string {
    return this.productList.find((p) => p.id === this.lockedProductId)?.name ?? '';
  }

  // --------------------------------------------------------------------------- Paso 2: paleta
  selectColor(color: Color): void {
    this.form.patchValue({ color: color.name });
  }

  isColorSelected(color: Color): boolean {
    return this.form.value.color === color.name;
  }

  // --------------------------------------------------------------------------- Proveedor nuevo
  async addSupplierInline(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Nuevo proveedor',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Nombre *' },
        { name: 'whatsapp', type: 'tel', placeholder: 'WhatsApp (ej. 51987654321)' },
        { name: 'address', type: 'text', placeholder: 'Dirección' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Agregar',
          handler: (data: { name?: string; whatsapp?: string; address?: string }) => {
            if (!data.name?.trim()) {
              void this.showToast('El nombre es obligatorio.', 'danger');
              return false;
            }
            void this.createSupplier(data);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private async createSupplier(data: { name?: string; whatsapp?: string; address?: string }): Promise<void> {
    const id = await this.config.addSupplier({
      name: data.name ?? '',
      whatsapp: data.whatsapp,
      address: data.address,
    });
    this.suppliers = await this.config.getSuppliers();
    this.form.patchValue({ supplierId: id });
  }

  // --------------------------------------------------------------------------- Navegación
  async goToStep2(): Promise<void> {
    const v = this.form.value;
    if (this.mode === 'new' && (!v.name?.trim() || v.price == null)) {
      this.form.markAllAsTouched();
      await this.showToast('Nombre y precio son obligatorios.', 'danger');
      return;
    }
    if (this.mode === 'existing' && !v.productId) {
      await this.showToast('Elige un producto.', 'danger');
      return;
    }
    this.step = 2;
  }

  backToStep1(): void {
    this.step = 1;
  }

  async save(): Promise<void> {
    if (this.saving) {
      return;
    }
    const v = this.form.value as {
      name: string;
      price: number | null;
      supplierId: string;
      purchaseDoc: string;
      costPrice: number | null;
      productId: string;
      color: string;
      size: string;
    };

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
          supplier: this.selectedSupplierName || undefined,
          supplierId: v.supplierId || undefined,
          purchaseDoc: v.purchaseDoc?.trim() || undefined,
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
      await this.showToast('Prenda vinculada a su código.', 'success');
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
