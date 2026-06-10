import { Component, OnInit } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

import { ConfigService } from './core/services/config.service';
import { DatabaseService } from './core/services/database.service';
import { SessionService } from './core/services/session.service';
import { SyncService } from './core/services/sync.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  get user(): string {
    return this.session.currentUser;
  }

  get isLoggedIn(): boolean {
    return this.session.isLoggedIn;
  }

  async logout(): Promise<void> {
    this.session.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  constructor(
    private readonly database: DatabaseService,
    private readonly router: Router,
    private readonly sync: SyncService,
    private readonly session: SessionService,
    private readonly config: ConfigService,
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
    await this.applyStatusBar();
    try {
      await this.database.initDatabase();
      // Verificación de disponibilidad (capability local-persistence).
      const probe = await this.database.query<{ ok: number }>('SELECT 1 AS ok;');
      console.log('[VStore] SQLite listo. SELECT 1 =>', probe[0]?.ok);
      // Siembra catálogos por defecto (colores/tallas) y migra proveedores de texto a tabla.
      await this.config.ensureDefaults();
      // Arranca el auto-sync a Firestore (no bloquea el arranque si falla).
      void this.sync.initAutoSync();
    } catch (err) {
      console.error('[VStore] Error inicializando SQLite:', err);
    }
  }

  /** Status bar navy con texto claro, a juego con el toolbar (solo nativo). */
  private async applyStatusBar(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    try {
      await StatusBar.setBackgroundColor({ color: '#0F172A' });
      await StatusBar.setStyle({ style: Style.Dark });
    } catch {
      // En algunos dispositivos/SO la API puede no estar disponible; no es crítico.
    }
  }
}
