import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';

import { Supplier } from '../../../../core/models/config.model';
import { ConfigService } from '../../../../core/services/config.service';
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
  suppliers: Supplier[] = [];

  readonly form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    price: [null, [Validators.required, Validators.min(0)]],
    supplierId: [''],
    purchaseDoc: [''],
    sku: [''],
    costPrice: [null],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly products: ProductService,
    private readonly config: ConfigService,
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.productId = this.route.snapshot.paramMap.get('id') ?? '';
    this.suppliers = await this.config.getSuppliers();
    const product = await this.products.getProductById(this.productId);
    if (product) {
      this.photos = product.images ? [...product.images] : [];
      this.form.patchValue({
        name: product.name,
        price: product.price,
        supplierId: product.supplierId ?? '',
        purchaseDoc: product.purchaseDoc ?? '',
        sku: product.sku ?? '',
        costPrice: product.costPrice ?? null,
      });
    }
  }

  /** Nombre del proveedor seleccionado (para denormalizar en el producto). */
  get selectedSupplierName(): string {
    return this.suppliers.find((s) => s.id === this.form.value.supplierId)?.name ?? '';
  }

  /** Alta rápida de proveedor desde el formulario. */
  async addSupplierInline(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Nuevo proveedor',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Nombre *' },
        { name: 'whatsapp', type: 'tel', placeholder: 'WhatsApp (ej. 987654321)' },
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
        supplierId: string;
        purchaseDoc: string;
        sku: string;
        costPrice: number | null;
      };
      await this.products.updateProduct(this.productId, {
        name: value.name.trim(),
        price: Number(value.price),
        supplierId: value.supplierId || undefined,
        supplier: this.selectedSupplierName || undefined,
        purchaseDoc: value.purchaseDoc?.trim() || undefined,
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
