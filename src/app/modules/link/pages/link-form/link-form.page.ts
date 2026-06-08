import { Component } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { v4 as uuidv4 } from 'uuid';

import { NewProductInput, ProductService } from '../../../../core/services/product.service';
import { TagService } from '../../../../core/services/tag.service';
import { buildSku } from '../../../../core/utils/sku.util';

/**
 * LinkFormPage — crea un producto y lo vincula al código escaneado (capabilities:
 * product-management + tag-linking). Al guardar: createProduct → assignTag → detalle.
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

  /** Sufijo estable del SKU (no cambia mientras se edita el formulario). */
  readonly skuSuffix = uuidv4().replace(/-/g, '').slice(0, 4);

  readonly form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    price: [null, [Validators.required, Validators.min(0)]],
    supplier: [''],
    costPrice: [null],
    variants: this.fb.array([this.buildVariant()]),
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly tags: TagService,
    private readonly products: ProductService,
    private readonly toastCtrl: ToastController,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.tagId = this.route.snapshot.paramMap.get('tagId') ?? '';
    const tag = await this.tags.getTagById(this.tagId);

    // Solo se vincula un código PENDING; si no, redirige con aviso.
    if (!tag) {
      await this.showToast('Código no reconocido.', 'danger');
      await this.router.navigate(['/tabs/link']);
    } else if (tag.status === 'ASSIGNED' && tag.productId) {
      await this.router.navigate(['/tabs/inventory/product', tag.productId]);
    }
  }

  get variants(): FormArray {
    return this.form.get('variants') as FormArray;
  }

  /** SKU autogenerado en vivo a partir de proveedor + nombre. */
  get generatedSku(): string {
    const { name, supplier } = this.form.value as { name: string; supplier: string };
    return buildSku(name, supplier, this.skuSuffix);
  }

  addVariant(): void {
    this.variants.push(this.buildVariant());
  }

  removeVariant(index: number): void {
    if (this.variants.length > 1) {
      this.variants.removeAt(index);
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    try {
      const value = this.form.value as {
        name: string;
        price: number;
        supplier: string;
        costPrice: number | null;
        variants: { color: string; size: string; stock: number }[];
      };

      const input: NewProductInput = {
        name: value.name.trim(),
        price: Number(value.price),
        sku: this.generatedSku,
        supplier: value.supplier?.trim() || undefined,
        costPrice: value.costPrice != null ? Number(value.costPrice) : undefined,
        variants: value.variants.map((v) => ({
          color: v.color?.trim() ?? '',
          size: v.size?.trim() ?? '',
          stock: Number(v.stock) || 0,
        })),
      };

      const product = await this.products.createProduct(input);
      await this.tags.assignTag(this.tagId, product.id);

      await this.showToast('Producto vinculado.', 'success');
      await this.router.navigate(['/tabs/inventory/product', product.id]);
    } catch (err) {
      console.error('[LinkForm] Error vinculando:', err);
      await this.showToast('No se pudo vincular el producto.', 'danger');
    } finally {
      this.saving = false;
    }
  }

  private buildVariant(): FormGroup {
    return this.fb.group({
      color: [''],
      size: [''],
      stock: [0, [Validators.required, Validators.min(0)]],
    });
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2500 });
    await toast.present();
  }
}
