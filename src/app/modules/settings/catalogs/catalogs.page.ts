import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';

import { Color, Size, Supplier } from '../../../core/models/config.model';
import { ConfigService } from '../../../core/services/config.service';
import { whatsappUrl } from '../../../core/utils/whatsapp.util';

type CatalogSegment = 'colors' | 'sizes' | 'suppliers';

/**
 * CatalogsPage — gestión de catálogos (capability: configuration): colores (paleta), tallas
 * y proveedores. Alimentan el formulario de vinculación. Incluye atajo a WhatsApp del proveedor.
 */
@Component({
  selector: 'app-catalogs',
  templateUrl: './catalogs.page.html',
  styleUrls: ['./catalogs.page.scss'],
  standalone: false,
})
export class CatalogsPage {
  segment: CatalogSegment = 'colors';

  colors: Color[] = [];
  sizes: Size[] = [];
  suppliers: Supplier[] = [];

  newColorName = '';
  newColorHex = '#E53935';
  newSizeLabel = '';
  newSupplierName = '';
  newSupplierWhatsapp = '';
  newSupplierAddress = '';

  constructor(
    private readonly config: ConfigService,
    private readonly router: Router,
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.colors = await this.config.getColors();
    this.sizes = await this.config.getSizes();
    this.suppliers = await this.config.getSuppliers();
  }

  // --------------------------------------------------------------------------- Colores
  async addColor(): Promise<void> {
    const name = this.newColorName.trim();
    if (!name) {
      await this.toast('Escribe un nombre de color.');
      return;
    }
    await this.config.addColor(name, this.newColorHex);
    this.newColorName = '';
    await this.reload();
  }

  async removeColor(color: Color): Promise<void> {
    if (await this.confirmDelete(`color "${color.name}"`)) {
      await this.config.removeColor(color.id);
      await this.reload();
    }
  }

  // --------------------------------------------------------------------------- Tallas
  async addSize(): Promise<void> {
    const label = this.newSizeLabel.trim();
    if (!label) {
      await this.toast('Escribe una talla.');
      return;
    }
    await this.config.addSize(label);
    this.newSizeLabel = '';
    await this.reload();
  }

  async removeSize(size: Size): Promise<void> {
    if (await this.confirmDelete(`talla "${size.label}"`)) {
      await this.config.removeSize(size.id);
      await this.reload();
    }
  }

  // --------------------------------------------------------------------------- Proveedores
  async addSupplier(): Promise<void> {
    const name = this.newSupplierName.trim();
    if (!name) {
      await this.toast('Escribe el nombre del proveedor.');
      return;
    }
    await this.config.addSupplier({
      name,
      whatsapp: this.newSupplierWhatsapp,
      address: this.newSupplierAddress,
    });
    this.newSupplierName = '';
    this.newSupplierWhatsapp = '';
    this.newSupplierAddress = '';
    await this.reload();
  }

  /** Abre la pantalla dedicada para editar el proveedor. */
  async editSupplier(supplier: Supplier): Promise<void> {
    await this.router.navigate(['/catalogs/supplier', supplier.id]);
  }

  async removeSupplier(supplier: Supplier): Promise<void> {
    if (await this.confirmDelete(`proveedor "${supplier.name}"`)) {
      await this.config.removeSupplier(supplier.id);
      await this.reload();
    }
  }

  /** Abre WhatsApp con el proveedor (chat con mensaje predefinido, editable antes de enviar). */
  async openWhatsApp(supplier: Supplier): Promise<void> {
    const storeName = localStorage.getItem('vstore.storeName') ?? 'mi tienda';
    const message = `Hola ${supplier.name}, le escribe ${storeName}.`;
    const url = whatsappUrl(supplier.whatsapp, message);
    if (!url) {
      await this.toast('Este proveedor no tiene WhatsApp.');
      return;
    }
    window.open(url, '_blank');
  }

  private async confirmDelete(what: string): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar',
      message: `¿Eliminar ${what}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role !== 'cancel' && role !== 'backdrop';
  }

  private async toast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 1800 });
    await toast.present();
  }
}
