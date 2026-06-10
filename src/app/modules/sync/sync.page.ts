import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Observable } from 'rxjs';

import { SyncService } from '../../core/services/sync.service';

/** Dirección de sincronización de una categoría (subir/bajar independientes). */
type DirSel = { up: boolean; down: boolean };
/** Selección direccional del modal de sincronización. */
type SyncSelection = { products: DirSel; tags: DirSel; batches: DirSel };

/**
 * SyncPage — pantalla de sincronización: muestra estado, conteos y un botón para
 * sincronizar manualmente (no sincroniza solo al entrar).
 */
@Component({
  selector: 'app-sync',
  templateUrl: './sync.page.html',
  styleUrls: ['./sync.page.scss'],
  standalone: false,
})
export class SyncPage {
  readonly isSyncing$: Observable<boolean> = this.sync.isSyncing$;
  readonly lastSyncAt$: Observable<string | null> = this.sync.lastSyncAt$;
  readonly isOnline$: Observable<boolean> = this.sync.isOnline$;

  stats = { products: 0, tags: 0, batches: 0, pending: 0 };
  pendingUpload = 0;
  checkingUpload = false;
  pendingDownload = 0;
  checkingDownload = false;
  downloadError: string | null = null;
  autoSync = true;

  constructor(
    private readonly sync: SyncService,
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.autoSync = this.sync.autoSyncEnabled;
    await this.loadStats();
    await this.checkUpload();
    await this.checkDownload();
  }

  /** Vuelve a consultar conteos locales y pendientes de nube. */
  async refresh(): Promise<void> {
    await this.loadStats();
    await this.checkUpload();
    await this.checkDownload();
  }

  /**
   * Cuenta lo pendiente por SUBIR comparando contra la nube (detecta nube blanqueada).
   * Si no hay red, cae al conteo local de cambios sin sincronizar.
   */
  async checkUpload(): Promise<void> {
    this.checkingUpload = true;
    try {
      this.pendingUpload = await this.sync.getPendingUpload();
    } catch {
      this.pendingUpload = this.stats.pending;
    } finally {
      this.checkingUpload = false;
    }
  }

  /** Cuenta lo pendiente por bajar (red). Si falla, muestra el error en pantalla. */
  async checkDownload(): Promise<void> {
    this.checkingDownload = true;
    this.downloadError = null;
    try {
      this.pendingDownload = await this.sync.getPendingDownload();
    } catch (err) {
      this.pendingDownload = 0;
      this.downloadError = err instanceof Error ? err.message : String(err);
      console.error('[Sync] Error consultando pendientes por bajar:', err);
    } finally {
      this.checkingDownload = false;
    }
  }

  onAutoSyncChange(): void {
    this.sync.autoSyncEnabled = this.autoSync;
  }

  /**
   * Abre el modal de sincronización direccional: por cada categoría puedes elegir ⬆ Subir
   * y/o ⬇ Bajar de forma independiente. Las categorías "ignoradas" (eliminadas antes)
   * aparecen sin marcar; marcar ⬇ Bajar las reactiva.
   */
  async openSyncModal(): Promise<void> {
    await this.loadStats();
    const on = (c: 'products' | 'tags' | 'batches'): boolean => !this.sync.isIgnored(c);
    const alert = await this.alertCtrl.create({
      header: 'Sincronizar',
      message: 'Elige qué subir (⬆ local → nube) y qué bajar (⬇ nube → local) por categoría.',
      inputs: [
        { type: 'checkbox', label: `Productos ⬆ Subir (${this.stats.products})`, value: 'products.up', checked: on('products') },
        { type: 'checkbox', label: `Productos ⬇ Bajar`, value: 'products.down', checked: on('products') },
        { type: 'checkbox', label: `Tags ⬆ Subir (${this.stats.tags})`, value: 'tags.up', checked: on('tags') },
        { type: 'checkbox', label: `Tags ⬇ Bajar`, value: 'tags.down', checked: on('tags') },
        { type: 'checkbox', label: `Lotes ⬆ Subir (${this.stats.batches})`, value: 'batches.up', checked: on('batches') },
        { type: 'checkbox', label: `Lotes ⬇ Bajar`, value: 'batches.down', checked: on('batches') },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Sincronizar', handler: (sel: string[]) => void this.runSelection(sel) },
      ],
    });
    await alert.present();
  }

  private async runSelection(selected: string[]): Promise<void> {
    const has = (v: string): boolean => selected.includes(v);
    const sel: SyncSelection = {
      products: { up: has('products.up'), down: has('products.down') },
      tags: { up: has('tags.up'), down: has('tags.down') },
      batches: { up: has('batches.up'), down: has('batches.down') },
    };
    try {
      await this.sync.applySyncSelection(sel);
      await this.loadStats();
      await this.checkUpload();
      await this.checkDownload();
      await this.showToast('Sincronización aplicada.', 'success');
    } catch {
      await this.showToast('No se pudo sincronizar.', 'danger');
    }
  }

  /**
   * Abre el modal de borrado local (acción aparte): elimina del celular las categorías
   * marcadas (la nube las conserva). Pide confirmación escrita por ser destructivo.
   */
  async openDeleteModal(): Promise<void> {
    await this.loadStats();
    const alert = await this.alertCtrl.create({
      header: 'Eliminar del celular',
      message: 'Marca lo que quieres ELIMINAR de este celular. La nube lo conserva como respaldo y no se volverá a bajar (hasta que lo bajes de nuevo).',
      inputs: [
        { type: 'checkbox', label: `Productos (${this.stats.products})`, value: 'products', checked: false },
        { type: 'checkbox', label: `Tags (${this.stats.tags})`, value: 'tags', checked: false },
        { type: 'checkbox', label: `Lotes (${this.stats.batches})`, value: 'batches', checked: false },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Continuar', handler: (sel: string[]) => void this.confirmDelete(sel) },
      ],
    });
    await alert.present();
  }

  private async confirmDelete(selected: string[]): Promise<void> {
    const del = {
      products: selected.includes('products'),
      tags: selected.includes('tags'),
      batches: selected.includes('batches'),
    };
    if (!del.products && !del.tags && !del.batches) {
      await this.showToast('No seleccionaste nada para eliminar.', 'danger');
      return;
    }

    const impact = await this.sync.getDeletionImpact(del);
    const parts: string[] = [];
    if (impact.products) parts.push(`${impact.products} producto(s)`);
    if (impact.tags) parts.push(`${impact.tags} tag(s)`);
    if (impact.batches) parts.push(`${impact.batches} lote(s)`);

    const confirm = await this.alertCtrl.create({
      header: '¿Eliminar de este celular?',
      message: `Se eliminarán de ESTE celular: ${parts.join(', ')}. La nube los conserva como respaldo y no se volverán a bajar (hasta que los bajes de nuevo). Para confirmar, escribe: eliminar`,
      inputs: [{ name: 'confirm', type: 'text', placeholder: 'eliminar' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: (data: { confirm?: string }) => {
            if ((data.confirm ?? '').trim().toLowerCase() !== 'eliminar') {
              void this.showToast('Texto incorrecto. No se eliminó nada.', 'danger');
              return false;
            }
            void this.runDelete(del);
            return true;
          },
        },
      ],
    });
    await confirm.present();
  }

  private async runDelete(del: { products: boolean; tags: boolean; batches: boolean }): Promise<void> {
    try {
      await this.sync.deleteCategories(del);
      await this.loadStats();
      await this.checkUpload();
      await this.checkDownload();
      await this.showToast('Eliminado de este celular.', 'success');
    } catch {
      await this.showToast('No se pudo eliminar.', 'danger');
    }
  }

  private async loadStats(): Promise<void> {
    this.stats = await this.sync.getStats();
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2500 });
    await toast.present();
  }
}
