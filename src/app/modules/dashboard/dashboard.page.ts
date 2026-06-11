import { Component } from '@angular/core';
import { Observable } from 'rxjs';

import { Permission, SessionService } from '../../core/services/session.service';
import { SyncService } from '../../core/services/sync.service';

/**
 * DashboardPage — Panel Principal: accesos rápidos (Generar / Escanear / Inventario)
 * y un resumen de stats. Es la pantalla de inicio tras iniciar sesión.
 */
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage {
  readonly lastSyncAt$: Observable<string | null> = this.sync.lastSyncAt$;
  stats = { products: 0, tags: 0, batches: 0, pending: 0 };

  constructor(
    private readonly sync: SyncService,
    private readonly session: SessionService,
  ) {}

  get user(): string {
    return this.session.currentUser;
  }

  /** Permiso del rol actual (para mostrar/ocultar accesos). */
  can(permission: Permission): boolean {
    return this.session.can(permission);
  }

  async ionViewWillEnter(): Promise<void> {
    this.stats = await this.sync.getStats();
  }
}
