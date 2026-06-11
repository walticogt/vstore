import { Injectable } from '@angular/core';

import { DatabaseService } from './database.service';

/** Filtros de un reporte: rango de fechas (YYYY-MM-DD) y proveedor opcional. */
export interface ReportFilters {
  from?: string;
  to?: string;
  supplierId?: string;
}

/** Resumen del periodo: total vendido (S/), unidades vendidas y prendas extraviadas. */
export interface SalesSummary {
  totalSold: number;
  unitsSold: number;
  lost: number;
}

/** Fila de ventas por periodo (día YYYY-MM-DD o mes YYYY-MM). */
export interface PeriodRow {
  period: string;
  total: number;
  units: number;
}

export type ReportGroup = 'day' | 'month';

/**
 * ReportService — reportes de ventas y pérdidas (capability: sales-reporting). Lecturas
 * agregadas 100% locales (SQLite) sobre el ciclo de vida de la prenda. No usa red.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  constructor(private readonly db: DatabaseService) {}

  /** Resumen: total vendido + unidades (SOLD) y prendas extraviadas (LOST) del periodo. */
  async getSummary(filters: ReportFilters): Promise<SalesSummary> {
    const sold = this.buildWhere('v.sold_at', 'SOLD', filters);
    const soldRows = await this.db.query<{ total: number; units: number }>(
      `SELECT COALESCE(SUM(COALESCE(v.sale_price, 0)), 0) AS total, COUNT(*) AS units
       FROM product_variant v ${sold.join} ${sold.where};`,
      sold.params,
    );

    const lost = this.buildWhere('v.lost_at', 'LOST', filters);
    const lostRows = await this.db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM product_variant v ${lost.join} ${lost.where};`,
      lost.params,
    );

    return {
      totalSold: soldRows[0]?.total ?? 0,
      unitsSold: soldRows[0]?.units ?? 0,
      lost: lostRows[0]?.n ?? 0,
    };
  }

  /** Ventas agrupadas por día o por mes (más recientes primero). */
  async getSalesByPeriod(filters: ReportFilters, group: ReportGroup): Promise<PeriodRow[]> {
    const len = group === 'day' ? 10 : 7; // YYYY-MM-DD vs YYYY-MM
    const period = `substr(v.sold_at, 1, ${len})`;
    const w = this.buildWhere('v.sold_at', 'SOLD', filters);
    return this.db.query<PeriodRow>(
      `SELECT ${period} AS period,
              COALESCE(SUM(COALESCE(v.sale_price, 0)), 0) AS total,
              COUNT(*) AS units
       FROM product_variant v ${w.join} ${w.where}
       GROUP BY period
       ORDER BY period DESC;`,
      w.params,
    );
  }

  /**
   * Arma JOIN/WHERE/params según estado y filtros. Las fechas se comparan por prefijo
   * YYYY-MM-DD del ISO almacenado (inclusive). El proveedor exige JOIN a product.
   */
  private buildWhere(
    dateCol: string,
    status: string,
    f: ReportFilters,
  ): { join: string; where: string; params: unknown[] } {
    const conds = ['v.status = ?'];
    const params: unknown[] = [status];
    let join = '';

    if (f.from) {
      conds.push(`substr(${dateCol}, 1, 10) >= ?`);
      params.push(f.from);
    }
    if (f.to) {
      conds.push(`substr(${dateCol}, 1, 10) <= ?`);
      params.push(f.to);
    }
    if (f.supplierId) {
      join = 'JOIN product p ON p.id = v.product_id';
      conds.push('p.supplier_id = ?');
      params.push(f.supplierId);
    }

    return { join, where: `WHERE ${conds.join(' AND ')}`, params };
  }
}
