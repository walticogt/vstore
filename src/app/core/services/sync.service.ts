import { EnvironmentInjector, Injectable, runInInjectionContext } from '@angular/core';
import { Auth, signInAnonymously } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Network } from '@capacitor/network';
import { BehaviorSubject, Observable } from 'rxjs';

import { DatabaseService } from './database.service';
import { ProductService } from './product.service';

interface SyncRow {
  id: string;
  [key: string]: unknown;
}

/**
 * SyncService — sincronización unidireccional SQLite → Firestore (capability: cloud-sync).
 * Sube los registros locales sin `syncedAt` a las colecciones tags/batches/products,
 * marca `syncedAt`, y se dispara al recuperar conectividad. No descarga datos (MVP).
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly syncing$ = new BehaviorSubject<boolean>(false);
  private readonly lastSync$ = new BehaviorSubject<string | null>(null);

  get isSyncing$(): Observable<boolean> {
    return this.syncing$.asObservable();
  }

  get lastSyncAt$(): Observable<string | null> {
    return this.lastSync$.asObservable();
  }

  constructor(
    private readonly db: DatabaseService,
    private readonly products: ProductService,
    private readonly firestore: Firestore,
    private readonly auth: Auth,
    private readonly injector: EnvironmentInjector,
  ) {}

  /** Inicia el auto-sync: sincroniza al arrancar (si hay red) y al reconectar. */
  async initAutoSync(): Promise<void> {
    const status = await Network.getStatus();
    if (status.connected) {
      void this.syncAll();
    }
    await Network.addListener('networkStatusChange', (s) => {
      if (s.connected) {
        void this.syncAll();
      }
    });
  }

  /** Sube todos los registros pendientes (sin syncedAt) a Firestore. */
  async syncAll(): Promise<void> {
    if (this.syncing$.value) {
      return;
    }
    this.syncing$.next(true);
    try {
      await this.ensureAuth();
      await this.syncBatches();
      await this.syncProducts();
      await this.syncTags();
      this.lastSync$.next(new Date().toISOString());
    } catch (err) {
      console.error('[Sync] Error sincronizando:', err);
      throw err;
    } finally {
      this.syncing$.next(false);
    }
  }

  /** Autenticación anónima (no bloquea la sync si está deshabilitada y las reglas lo permiten). */
  private async ensureAuth(): Promise<void> {
    if (this.auth.currentUser) {
      return;
    }
    try {
      await runInInjectionContext(this.injector, () => signInAnonymously(this.auth));
    } catch (err) {
      console.warn('[Sync] Auth anónima no disponible (¿habilitada en Firebase?):', err);
    }
  }

  private async syncBatches(): Promise<void> {
    const rows = await this.db.query<SyncRow>(
      'SELECT * FROM print_batch WHERE synced_at IS NULL;',
    );
    for (const r of rows) {
      await this.upload('batches', r.id, {
        id: r['id'],
        createdAt: r['created_at'],
        quantity: r['quantity'],
        layout: r['layout'],
        codeType: r['code_type'],
      });
      await this.markSynced('print_batch', r.id);
    }
  }

  private async syncTags(): Promise<void> {
    const rows = await this.db.query<SyncRow>('SELECT * FROM tag_code WHERE synced_at IS NULL;');
    for (const r of rows) {
      await this.upload('tags', r.id, {
        id: r['id'],
        status: r['status'],
        createdAt: r['created_at'],
        assignedAt: r['assigned_at'],
        assignedBy: r['assigned_by'],
        productId: r['product_id'],
        printBatchId: r['print_batch_id'],
      });
      await this.markSynced('tag_code', r.id);
    }
  }

  private async syncProducts(): Promise<void> {
    const rows = await this.db.query<{ id: string }>(
      'SELECT id FROM product WHERE synced_at IS NULL;',
    );
    for (const { id } of rows) {
      const product = await this.products.getProductById(id);
      if (product) {
        // Variantes embebidas como array (estructura Firestore del spec).
        await this.upload('products', id, { ...product });
      }
      await this.markSynced('product', id);
    }
  }

  /** Escribe un documento en Firestore (elimina undefined que Firestore rechaza). */
  private async upload(collection: string, id: string, data: unknown): Promise<void> {
    const clean = JSON.parse(JSON.stringify(data));
    await runInInjectionContext(this.injector, () =>
      setDoc(doc(this.firestore, collection, id), clean),
    );
  }

  private async markSynced(table: string, id: string): Promise<void> {
    await this.db.execute(`UPDATE ${table} SET synced_at = ? WHERE id = ?;`, [
      new Date().toISOString(),
      id,
    ]);
  }
}
