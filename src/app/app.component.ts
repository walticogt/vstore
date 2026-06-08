import { Component, OnInit } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';

import { DatabaseService } from './core/services/database.service';
import { SyncService } from './core/services/sync.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(
    private readonly database: DatabaseService,
    private readonly router: Router,
    private readonly sync: SyncService,
  ) {
    // Evita el warning de a11y "aria-hidden on a focused element": al navegar,
    // Ionic marca la página saliente con aria-hidden mientras el botón pulsado
    // aún tiene el foco. Lo quitamos antes de que arranque la transición.
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        const active = document.activeElement as HTMLElement | null;
        active?.blur();
      }
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.database.initDatabase();
      // Verificación de disponibilidad (capability local-persistence).
      const probe = await this.database.query<{ ok: number }>('SELECT 1 AS ok;');
      console.log('[VStore] SQLite listo. SELECT 1 =>', probe[0]?.ok);
      // Arranca el auto-sync a Firestore (no bloquea el arranque si falla).
      void this.sync.initAutoSync();
    } catch (err) {
      console.error('[VStore] Error inicializando SQLite:', err);
    }
  }
}
