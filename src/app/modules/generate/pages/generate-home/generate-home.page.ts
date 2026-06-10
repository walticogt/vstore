import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LoadingController, ToastController } from '@ionic/angular';
import { Observable } from 'rxjs';

import { CodeType, PrintBatch } from '../../../../core/models/print-batch.model';
import { SHEET_QUANTITY, TagService } from '../../../../core/services/tag.service';
import { PrintService } from '../../../../core/services/print.service';
import { SyncService } from '../../../../core/services/sync.service';

/** Tope de páginas por lote. */
const MAX_PAGES = 9;

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
  readonly maxPages = MAX_PAGES;

  readonly form: FormGroup = this.fb.group({
    codeType: ['QR' as CodeType, Validators.required],
    pages: [1, [Validators.required, Validators.min(1), Validators.max(MAX_PAGES)]],
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

  /** Códigos por hoja según el tipo seleccionado (QR 40 / Barras 50). */
  get perSheet(): number {
    return SHEET_QUANTITY[this.form.value.codeType as CodeType];
  }

  /** Total de códigos = páginas × códigos por hoja. */
  get totalCodes(): number {
    return (Number(this.form.value.pages) || 0) * this.perSheet;
  }

  /** Filas del grid de previsualización: 8 (QR) o 10 (Barras). */
  get previewRows(): number {
    return this.form.value.codeType === 'BARCODE' ? 10 : 8;
  }

  /** Celdas a dibujar en la hoja de previsualización (5 × filas). */
  get previewCells(): number[] {
    return Array.from({ length: this.previewRows * 5 }, (_, i) => i);
  }

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
      const { codeType, pages } = this.form.value as { codeType: CodeType; pages: number };
      const quantity = Number(pages) * SHEET_QUANTITY[codeType];
      const batch = await this.tags.generateBatch(quantity, codeType);
      const batchTags = await this.tags.getBatchTags(batch.id);

      const pdf = await this.print.generatePdf(batch, batchTags);
      await this.print.sharePdf(pdf, `etiquetas-${batch.id.slice(0, 8)}.pdf`);

      await this.loadBatches();
      await this.showToast(`${pages} hoja(s) · ${quantity} códigos generados.`, 'success');
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
