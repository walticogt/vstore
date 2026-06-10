import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

import { ProductService } from '../../../../core/services/product.service';

/**
 * ProductEditPage — edita los datos del producto (capability: product-management).
 * Edita campos escalares (nombre, precio, proveedor, SKU, costo). El stock por variante
 * se ajusta directamente en el detalle (+/-).
 */
@Component({
  selector: 'app-product-edit',
  templateUrl: './product-edit.page.html',
  styleUrls: ['./product-edit.page.scss'],
  standalone: false,
})
export class ProductEditPage {
  productId = '';
  saving = false;
  photos: string[] = [];

  readonly form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    price: [null, [Validators.required, Validators.min(0)]],
    supplier: [''],
    sku: [''],
    costPrice: [null],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly products: ProductService,
    private readonly toastCtrl: ToastController,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.productId = this.route.snapshot.paramMap.get('id') ?? '';
    const product = await this.products.getProductById(this.productId);
    if (product) {
      this.photos = product.images ? [...product.images] : [];
      this.form.patchValue({
        name: product.name,
        price: product.price,
        supplier: product.supplier ?? '',
        sku: product.sku ?? '',
        costPrice: product.costPrice ?? null,
      });
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
        sku: string;
        costPrice: number | null;
      };
      await this.products.updateProduct(this.productId, {
        name: value.name.trim(),
        price: Number(value.price),
        supplier: value.supplier?.trim() || undefined,
        sku: value.sku?.trim() || undefined,
        costPrice: value.costPrice != null ? Number(value.costPrice) : undefined,
        images: this.photos,
      });
      await this.showToast('Producto actualizado.', 'success');
      await this.router.navigate(['/tabs/inventory/product', this.productId]);
    } catch (err) {
      console.error('[ProductEdit] Error guardando:', err);
      await this.showToast('No se pudo guardar.', 'danger');
    } finally {
      this.saving = false;
    }
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2000 });
    await toast.present();
  }
}
