import { Component } from '@angular/core';

import { Supplier } from '../../core/models/config.model';
import { ConfigService } from '../../core/services/config.service';
import {
  PeriodRow,
  ReportGroup,
  ReportService,
  SalesSummary,
} from '../../core/services/report.service';

/**
 * ReportsPage — reportes de ventas y pérdidas (capability: sales-reporting). Resumen y
 * desglose por día/mes con filtros de fecha y proveedor. 100% local (offline-first).
 */
@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  standalone: false,
})
export class ReportsPage {
  group: ReportGroup = 'day';
  from = '';
  to = '';
  supplierId = '';
  suppliers: Supplier[] = [];
  summary: SalesSummary = { totalSold: 0, unitsSold: 0, lost: 0 };
  rows: PeriodRow[] = [];

  constructor(
    private readonly reports: ReportService,
    private readonly config: ConfigService,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.suppliers = await this.config.getSuppliers();
    if (!this.from || !this.to) {
      const now = new Date();
      this.from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      this.to = now.toISOString().slice(0, 10);
    }
    await this.load();
  }

  /** Recalcula el reporte con los filtros actuales. */
  async load(): Promise<void> {
    const filters = {
      from: this.from || undefined,
      to: this.to || undefined,
      supplierId: this.supplierId || undefined,
    };
    this.summary = await this.reports.getSummary(filters);
    this.rows = await this.reports.getSalesByPeriod(filters, this.group);
  }

  onFilterChange(): void {
    void this.load();
  }
}
