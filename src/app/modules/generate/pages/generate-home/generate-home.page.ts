import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LoadingController, ToastController } from '@ionic/angular';
import { Observable } from 'rxjs';

import { CodeType, PrintBatch } from '../../../../core/models/print-batch.model';
import { DEFAULT_BATCH_QUANTITY, TagService } from '../../../../core/services/tag.service';
import { PrintService } from '../../../../core/services/print.service';
import { SyncService } from '../../../../core/services/sync.service';

/**
 * GenerateHomePage — generar e imprimir un lote de etiquetas (módulo Generate).
 * Flujo: generateBatch → getBatchTags → generatePdf → sharePdf. 100% offline.
 */
@Component({
  selector: 'app-generate-home',
  templateUrl: './generate-home.page.html',
  styleUrls: ['./generate-home.page.scss'],
  standalone: false,
})
export class GenerateHomePage {
  readonly form: FormGroup = this.fb.group({
    codeType: ['QR' as CodeType, Validators.required],
    quantity: [
      DEFAULT_BATCH_QUANTITY,
      [Validators.required, Validators.min(1), Validators.max(200)],
    ],
  });

  batches: PrintBatch[] = [];
  generating = false;

  readonly isSyncing$: Observable<boolean> = this.sync.isSyncing$;
  readonly lastSyncAt$: Observable<string | null> = this.sync.lastSyncAt$;

  constructor(
    private readonly fb: FormBuilder,
    private readonly tags: TagService,
    private readonly print: PrintService,
    private readonly sync: SyncService,
    private readonly loadingCtrl: LoadingController,
    private readonly toastCtrl: ToastController,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    await this.loadBatches();
  }

  async generateAndPrint(): Promise<void> {
    if (this.form.invalid || this.generating) {
      this.form.markAllAsTouched();
      return;
    }

    this.generating = true;
    const loading = await this.loadingCtrl.create({ message: 'Generando lote…' });
    await loading.present();

    try {
      const { codeType, quantity } = this.form.value as { codeType: CodeType; quantity: number };
      const batch = await this.tags.generateBatch(quantity, codeType);
      const batchTags = await this.tags.getBatchTags(batch.id);

      const pdf = await this.print.generatePdf(batch, batchTags);
      await this.print.sharePdf(pdf, `etiquetas-${batch.id.slice(0, 8)}.pdf`);

      await this.loadBatches();
      await this.showToast(`Lote de ${quantity} etiquetas generado.`, 'success');
    } catch (err) {
      console.error('[Generate] Error generando lote:', err);
      await this.showToast('No se pudo generar el lote.', 'danger');
    } finally {
      await loading.dismiss();
      this.generating = false;
    }
  }

  async syncNow(): Promise<void> {
    try {
      await this.sync.syncAll();
      await this.loadBatches();
      await this.showToast('Sincronización completada.', 'success');
    } catch {
      await this.showToast('No se pudo sincronizar.', 'danger');
    }
  }

  private async loadBatches(): Promise<void> {
    this.batches = await this.tags.getAllBatches();
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2500 });
    await toast.present();
  }
}
