import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';

import { PrintBatch } from '../../../../core/models/print-batch.model';
import { TagCode, TagStatus } from '../../../../core/models/tag-code.model';
import { PrintService } from '../../../../core/services/print.service';
import { TagService } from '../../../../core/services/tag.service';

/**
 * BatchDetailPage — tags de un lote con su estado (PENDING/ASSIGNED) y reimpresión.
 */
@Component({
  selector: 'app-batch-detail',
  templateUrl: './batch-detail.page.html',
  styleUrls: ['./batch-detail.page.scss'],
  standalone: false,
})
export class BatchDetailPage {
  batch: PrintBatch | null = null;
  tags: TagCode[] = [];
  reprinting = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly tagService: TagService,
    private readonly print: PrintService,
    private readonly loadingCtrl: LoadingController,
    private readonly toastCtrl: ToastController,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    this.batch = await this.tagService.getBatchById(id);
    this.tags = await this.tagService.getBatchTags(id);
  }

  get assignedCount(): number {
    return this.tags.filter((t) => t.status === 'ASSIGNED').length;
  }

  statusLabel(status: TagStatus): string {
    return status === 'ASSIGNED' ? 'Vinculado' : status === 'REPLACED' ? 'Reemplazado' : 'Pendiente';
  }

  statusColor(status: TagStatus): string {
    return status === 'ASSIGNED' ? 'success' : status === 'REPLACED' ? 'warning' : 'medium';
  }

  async reprint(): Promise<void> {
    if (!this.batch || this.reprinting) {
      return;
    }
    this.reprinting = true;
    const loading = await this.loadingCtrl.create({ message: 'Preparando PDF…' });
    await loading.present();
    try {
      const pdf = await this.print.generatePdf(this.batch, this.tags);
      await this.print.sharePdf(pdf, `etiquetas-${this.batch.id.slice(0, 8)}.pdf`);
    } catch (err) {
      console.error('[BatchDetail] Error reimprimiendo:', err);
      const toast = await this.toastCtrl.create({
        message: 'No se pudo generar el PDF.',
        color: 'danger',
        duration: 2500,
      });
      await toast.present();
    } finally {
      await loading.dismiss();
      this.reprinting = false;
    }
  }
}
