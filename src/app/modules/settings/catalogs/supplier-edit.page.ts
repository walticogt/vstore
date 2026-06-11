import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

import { Supplier } from '../../../core/models/config.model';
import { ConfigService } from '../../../core/services/config.service';
import { whatsappUrl } from '../../../core/utils/whatsapp.util';

/**
 * SupplierEditPage — pantalla dedicada para editar un proveedor (nombre, WhatsApp, dirección).
 * Incluye atajo para abrir WhatsApp con un mensaje predefinido editable.
 */
@Component({
  selector: 'app-supplier-edit',
  templateUrl: './supplier-edit.page.html',
  styleUrls: ['./supplier-edit.page.scss'],
  standalone: false,
})
export class SupplierEditPage {
  supplier: Supplier | null = null;
  name = '';
  whatsapp = '';
  address = '';
  saving = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly config: ConfigService,
    private readonly toastCtrl: ToastController,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.supplier = await this.config.getSupplierById(id);
    if (!this.supplier) {
      await this.toast('Proveedor no encontrado.');
      await this.router.navigate(['/catalogs']);
      return;
    }
    this.name = this.supplier.name;
    this.whatsapp = this.supplier.whatsapp ?? '';
    this.address = this.supplier.address ?? '';
  }

  async save(): Promise<void> {
    if (this.saving || !this.supplier) {
      return;
    }
    if (!this.name.trim()) {
      await this.toast('El nombre es obligatorio.');
      return;
    }
    this.saving = true;
    try {
      await this.config.updateSupplier(this.supplier.id, {
        name: this.name,
        whatsapp: this.whatsapp,
        address: this.address,
      });
      await this.toast('Proveedor actualizado.');
      await this.router.navigate(['/catalogs']);
    } catch {
      await this.toast('No se pudo guardar.');
    } finally {
      this.saving = false;
    }
  }

  /** Abre WhatsApp con un mensaje predefinido (editable antes de enviar). */
  openWhatsApp(): void {
    const storeName = localStorage.getItem('vstore.storeName') ?? 'mi tienda';
    const message = `Hola ${this.name.trim() || 'proveedor'}, le escribe ${storeName}.`;
    const url = whatsappUrl(this.whatsapp, message);
    if (!url) {
      void this.toast('Escribe un número de WhatsApp.');
      return;
    }
    window.open(url, '_blank');
  }

  private async toast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 1800 });
    await toast.present();
  }
}
