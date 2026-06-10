import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';

import { SyncService } from '../../core/services/sync.service';
import { SessionService } from '../../core/services/session.service';

/**
 * SettingsPage — configuración de la app: nombre de la tienda, info de impresión,
 * cuenta y datos de la app.
 */
@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage {
  storeName = '';
  autoSync = true;
  readonly version = '1.0.0';

  constructor(
    private readonly sync: SyncService,
    private readonly session: SessionService,
    private readonly router: Router,
    private readonly alertCtrl: AlertController,
    private readonly loadingCtrl: LoadingController,
    private readonly toastCtrl: ToastController,
  ) {}

  ionViewWillEnter(): void {
    this.storeName = localStorage.getItem('vstore.storeName') ?? 'Mi tienda';
    this.autoSync = this.sync.autoSyncEnabled;
  }

  get user(): string {
    return this.session.currentUser;
  }

  saveStoreName(): void {
    localStorage.setItem('vstore.storeName', this.storeName.trim() || 'Mi tienda');
  }

  onAutoSyncChange(): void {
    this.sync.autoSyncEnabled = this.autoSync;
  }

  async logout(): Promise<void> {
    this.session.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  async confirmReset(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Borrar todos los datos',
      message:
        'Esto borra TODOS los productos, códigos y lotes — en este dispositivo Y en la nube. No se puede deshacer. Para confirmar, escribe: borrar todo',
      inputs: [{ name: 'confirm', type: 'text', placeholder: 'borrar todo' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Borrar todo',
          role: 'destructive',
          handler: (data: { confirm?: string }) => {
            if ((data.confirm ?? '').trim().toLowerCase() !== 'borrar todo') {
              void this.showToast('Texto incorrecto. No se borró nada.');
              return false;
            }
            void this.doReset();
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private async doReset(): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Borrando todo…' });
    await loading.present();
    try {
      await this.sync.resetEverything();
      await this.showToast('Todo borrado. Empezando de cero.');
      await this.router.navigateByUrl('/dashboard', { replaceUrl: true });
    } catch {
      await this.showToast('No se pudo borrar todo.');
    } finally {
      await loading.dismiss();
    }
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500 });
    await toast.present();
  }
}
