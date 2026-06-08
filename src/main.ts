import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { Capacitor } from '@capacitor/core';
import { defineCustomElements as defineJeepSqlite } from 'jeep-sqlite/loader';

import { AppModule } from './app/app.module';

/**
 * En navegador, @capacitor-community/sqlite usa el web component <jeep-sqlite>
 * (sql.js sobre wasm). Lo registramos y montamos antes de bootstrap.
 */
async function bootstrap(): Promise<void> {
  if (Capacitor.getPlatform() === 'web') {
    defineJeepSqlite(window);
    const jeepEl = document.createElement('jeep-sqlite');
    document.body.appendChild(jeepEl);
    await customElements.whenDefined('jeep-sqlite');
  }

  await platformBrowserDynamic()
    .bootstrapModule(AppModule)
    .catch((err) => console.error(err));
}

void bootstrap();
