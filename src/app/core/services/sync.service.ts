import { EnvironmentInjector, Injectable, runInInjectionContext } from '@angular/core';
import { Auth, signInAnonymously } from '@angular/fire/auth';
import { Firestore, collection, deleteDoc, doc, getDocs, setDoc } from '@angular/fire/firestore';
import { Network } from '@capacitor/network';
import { BehaviorSubject, Observable, debounceTime } from 'rxjs';

import { ProductVariant } from '../models/product.model';
import { DatabaseService } from './database.service';
import { ProductService } from './product.service';

interface SyncRow {
  id: string;
  [key: string]: unknown;
}

/**
 * SyncService — sincronización bidireccional SQLite ⇄ Firestore (capability: cloud-sync).
 *
 * En cada sincronización: primero **baja** de Firestore lo que falte o sea más nuevo
 * (last-write-wins por fecha) — clave para que un dispositivo/instalación nueva reciba
 * los datos existentes — y luego **sube** los registros locales sin `syncedAt`. Se dispara
 * al recuperar conectividad. No borra registros en ningún sentido.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly syncing$ = new BehaviorSubject<boolean>(false);
  private readonly lastSync$ = new BehaviorSubject<string | null>(null);
  private readonly online$ = new BehaviorSubject<boolean>(true);
  /** Marca que hubo cambios locales durante una sync en curso (subir al terminar). */
  private pushQueued = false;
  /** Temporizador de seguridad: libera la bandera "sincronizando" si una sync se cuelga. */
  private watchdog?: ReturnType<typeof setTimeout>;
  private static readonly WATCHDOG_MS = 30000;

  get isSyncing$(): Observable<boolean> {
    return this.syncing$.asObservable();
  }

  get isOnline$(): Observable<boolean> {
    return this.online$.asObservable();
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

  /** Auto-sincronización al reconectar (persistida en localStorage). */
  get autoSyncEnabled(): boolean {
    return localStorage.getItem('vstore.autoSync') !== 'false';
  }
  set autoSyncEnabled(value: boolean) {
    localStorage.setItem('vstore.autoSync', value ? 'true' : 'false');
  }

  /**
   * Inicia el auto-sync: sincroniza completo al arrancar y al reconectar, y **sube
   * automáticamente** (con un pequeño retraso) cada vez que hay cambios locales, si la
   * auto-sincronización está activa y hay conexión. Sin internet, espera y sube al reconectar.
   */
  async initAutoSync(): Promise<void> {
    // Registrar PRIMERO la auto-subida ante cambios locales, para que un fallo del plugin
    // Network no impida que se active (debounce para agrupar escrituras seguidas).
    this.db.changes$.pipe(debounceTime(2500)).subscribe(() => {
      if (!this.autoSyncEnabled || !this.online$.value) {
        return;
      }
      if (this.syncing$.value) {
        // Hay una sync en curso: recordamos que hay cambios y subimos al terminar.
        this.pushQueued = true;
        return;
      }
      console.log('[Sync] Cambio local → auto-subida…');
      void this.pushPending();
    });

    // Estado de red + sync al arrancar/reconectar. Protegido: si el plugin Network falla,
    // asumimos "en línea" para no bloquear la auto-subida.
    try {
      const status = await Network.getStatus();
      this.online$.next(status.connected);
      if (status.connected && this.autoSyncEnabled) {
        void this.syncAll();
      }
      await Network.addListener('networkStatusChange', (s) => {
        this.online$.next(s.connected);
        if (s.connected && this.autoSyncEnabled) {
          void this.syncAll();
        }
      });
    } catch (err) {
      console.warn('[Sync] Plugin Network no disponible; asumo en línea.', err);
      this.online$.next(true);
    }
  }

  /** Sube solo los registros pendientes (sin bajar). Usado por la auto-subida. */
  async pushPending(): Promise<void> {
    if (this.syncing$.value) {
      this.pushQueued = true;
      return;
    }
    this.setSyncing(true);
    this.pushQueued = false;
    try {
      await this.ensureAuth();
      await this.pushCatalogs();
      await this.syncBatches();
      await this.syncProducts();
      await this.syncTags();
      this.lastSync$.next(new Date().toISOString());
      console.log('[Sync] Auto-subida completada.');
    } catch (err) {
      console.error('[Sync] Error subiendo cambios:', err);
    } finally {
      this.setSyncing(false);
      this.flushQueuedPush();
    }
  }

  /**
   * Cambia la bandera "sincronizando" y arma/limpia un watchdog: si una sincronización
   * tarda más de WATCHDOG_MS (p. ej. una llamada a Firestore colgada en una red inestable),
   * libera la bandera para que la UI no quede pegada en "Sincronizando…".
   */
  private setSyncing(value: boolean): void {
    this.syncing$.next(value);
    this.clearWatchdog();
    if (value) {
      this.watchdog = setTimeout(() => {
        console.warn('[Sync] Watchdog: la sincronización tardó demasiado; liberando estado.');
        this.watchdog = undefined;
        this.syncing$.next(false);
      }, SyncService.WATCHDOG_MS);
    }
  }

  private clearWatchdog(): void {
    if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.watchdog = undefined;
    }
  }

  /** Si quedaron cambios pendientes durante una sync, los sube ahora. */
  private flushQueuedPush(): void {
    if (this.pushQueued && this.autoSyncEnabled && this.online$.value && !this.syncing$.value) {
      this.pushQueued = false;
      void this.pushPending();
    }
  }

  /**
   * Cuenta los registros que faltan por BAJAR (existen en la nube y localmente no están
   * o son más antiguos). Requiere red; si falla devuelve 0. No descarga nada, solo compara.
   */
  async getPendingDownload(): Promise<number> {
    await this.ensureAuth();
    let count = 0;

    const batches = await this.fetchCollection('batches');
    const productsPreview = await this.fetchCollection('products');
    const tagsPreview = await this.fetchCollection('tags');
    console.log(
      `[Sync] Nube → ${batches.length} lotes, ${productsPreview.length} productos, ${tagsPreview.length} tags. Auth: ${this.auth.currentUser ? 'sí (' + this.auth.currentUser.uid + ')' : 'NO'}`,
    );

    // Carga local en bloque (3 consultas) en vez de una por registro.
    const localBatchIds = await this.localIdSet('print_batch');
    const localProd = await this.localTimestampMap('SELECT id, updated_at AS ts FROM product;');
    const localTags = await this.localTimestampMap(
      'SELECT id, COALESCE(assigned_at, created_at) AS ts FROM tag_code;',
    );

    for (const b of batches) {
      if (!localBatchIds.has(b['id'] as string)) {
        count++;
      }
    }
    for (const p of productsPreview) {
      const local = localProd.get(p['id'] as string);
      if (local === undefined || local < ((p['updatedAt'] as string) ?? '')) {
        count++;
      }
    }
    for (const t of tagsPreview) {
      const cloudTs = ((t['assignedAt'] as string) || (t['createdAt'] as string)) ?? '';
      const local = localTags.get(t['id'] as string);
      if (local === undefined || local < cloudTs) {
        count++;
      }
    }

    return count;
  }

  /** Conjunto de ids locales de una tabla (1 consulta). */
  private async localIdSet(table: string): Promise<Set<string>> {
    const rows = await this.db.query<{ id: string }>(`SELECT id FROM ${table};`);
    return new Set(rows.map((r) => r.id));
  }

  /** Mapa id → timestamp local a partir de un SELECT que devuelve (id, ts) (1 consulta). */
  private async localTimestampMap(sql: string): Promise<Map<string, string>> {
    const rows = await this.db.query<{ id: string; ts: string | null }>(sql);
    return new Map(rows.map((r) => [r.id, r.ts ?? '']));
  }

  /**
   * Cuenta los registros que faltan por SUBIR comparando contra la nube (no contra el
   * estado local `synced_at`): local que no existe en Firestore o es más nuevo. Así, si
   * la nube fue blanqueada, reconoce que TODO lo local está pendiente de subir aunque
   * ya estuviera marcado como sincronizado. Requiere red; si falla, propaga el error.
   */
  async getPendingUpload(): Promise<number> {
    await this.ensureAuth();
    let count = 0;

    // Lotes: pendientes si el id local no está en la nube (los lotes son inmutables).
    const cloudBatches = new Set(
      (await this.fetchCollection('batches')).map((b) => b['id'] as string),
    );
    const localBatches = await this.db.query<{ id: string }>('SELECT id FROM print_batch;');
    for (const b of localBatches) {
      if (!cloudBatches.has(b.id)) {
        count++;
      }
    }

    // Productos: pendientes si faltan en la nube o el local es más nuevo (por updated_at).
    const cloudProducts = new Map(
      (await this.fetchCollection('products')).map((p) => [
        p['id'] as string,
        (p['updatedAt'] as string) ?? '',
      ]),
    );
    const localProducts = await this.db.query<{ id: string; ts: string | null }>(
      'SELECT id, updated_at AS ts FROM product;',
    );
    for (const p of localProducts) {
      const cloudTs = cloudProducts.get(p.id);
      if (cloudTs === undefined || (p.ts ?? '') > cloudTs) {
        count++;
      }
    }

    // Tags: pendientes si faltan en la nube o el local es más nuevo (por assigned_at ?? created_at).
    const cloudTags = new Map(
      (await this.fetchCollection('tags')).map((t) => [
        t['id'] as string,
        ((t['assignedAt'] as string) || (t['createdAt'] as string)) ?? '',
      ]),
    );
    const localTags = await this.db.query<{ id: string; ts: string | null }>(
      'SELECT id, COALESCE(assigned_at, created_at) AS ts FROM tag_code;',
    );
    for (const t of localTags) {
      const cloudTs = cloudTags.get(t.id);
      if (cloudTs === undefined || (t.ts ?? '') > cloudTs) {
        count++;
      }
    }

    return count;
  }

  /** Conteos para la pantalla de sincronización. */
  async getStats(): Promise<{ products: number; tags: number; batches: number; pending: number }> {
    const count = async (sql: string): Promise<number> => {
      const rows = await this.db.query<{ n: number }>(sql);
      return rows[0]?.n ?? 0;
    };
    return {
      products: await count('SELECT COUNT(*) AS n FROM product;'),
      tags: await count('SELECT COUNT(*) AS n FROM tag_code;'),
      batches: await count('SELECT COUNT(*) AS n FROM print_batch;'),
      pending: await count(
        `SELECT (SELECT COUNT(*) FROM product WHERE synced_at IS NULL)
              + (SELECT COUNT(*) FROM tag_code WHERE synced_at IS NULL)
              + (SELECT COUNT(*) FROM print_batch WHERE synced_at IS NULL) AS n;`,
      ),
    };
  }

  /** Baja lo más nuevo de la nube y luego sube los registros locales pendientes. */
  async syncAll(): Promise<void> {
    if (this.syncing$.value) {
      return;
    }
    this.setSyncing(true);
    try {
      await this.ensureAuth();
      // 1) Bajar (nube → local): un dispositivo nuevo se trae los datos existentes.
      await this.pullCatalogs();
      await this.pullBatches();
      await this.pullProducts();
      await this.pullTags();
      // 2) Subir (local → nube): registros aún sin syncedAt.
      await this.pushCatalogs();
      await this.syncBatches();
      await this.syncProducts();
      await this.syncTags();
      this.lastSync$.next(new Date().toISOString());
    } catch (err) {
      console.error('[Sync] Error sincronizando:', err);
      throw err;
    } finally {
      this.setSyncing(false);
      this.flushQueuedPush();
    }
  }

  /**
   * Fuerza la re-subida de TODO lo local: marca todos los registros como no sincronizados
   * y sincroniza. Útil para subir datos/fotos que quedaron sin marcar como pendientes.
   */
  async forceResyncAll(): Promise<void> {
    await this.db.execute('UPDATE product SET synced_at = NULL;');
    await this.db.execute('UPDATE tag_code SET synced_at = NULL;');
    await this.db.execute('UPDATE print_batch SET synced_at = NULL;');
    await this.syncAll();
  }

  // ---------------------------------------------------------------------------
  // SINCRONIZACIÓN SELECTIVA (por categoría)
  // ---------------------------------------------------------------------------

  /** Categorías sincronizables. */
  private categoryKey(cat: 'products' | 'tags' | 'batches'): string {
    return `vstore.syncIgnore.${cat}`;
  }

  /** True si la categoría está marcada como "ignorar bajada" (no se vuelve a descargar). */
  isIgnored(cat: 'products' | 'tags' | 'batches'): boolean {
    return localStorage.getItem(this.categoryKey(cat)) === 'true';
  }

  private setIgnored(cat: 'products' | 'tags' | 'batches', value: boolean): void {
    localStorage.setItem(this.categoryKey(cat), value ? 'true' : 'false');
  }

  /**
   * Cuenta cuántos registros se ELIMINARÍAN del local según la selección de borrado,
   * incluyendo la cascada (borrar Lotes arrastra todos los Tags; borrar Productos arrastra
   * los Tags vinculados). Para mostrar el impacto real antes de confirmar.
   */
  async getDeletionImpact(del: {
    products: boolean;
    tags: boolean;
    batches: boolean;
  }): Promise<{ products: number; tags: number; batches: number }> {
    const count = async (sql: string): Promise<number> =>
      (await this.db.query<{ n: number }>(sql))[0]?.n ?? 0;

    const products = del.products ? await count('SELECT COUNT(*) AS n FROM product;') : 0;
    const batches = del.batches ? await count('SELECT COUNT(*) AS n FROM print_batch;') : 0;
    let tags = 0;
    if (del.tags || del.batches) {
      // Borrar Tags directamente, o borrar Lotes (todo tag pertenece a un lote) ⇒ todos.
      tags = await count('SELECT COUNT(*) AS n FROM tag_code;');
    } else if (del.products) {
      // Borrar Productos arrastra solo los tags vinculados a un producto.
      tags = await count('SELECT COUNT(*) AS n FROM tag_code WHERE product_id IS NOT NULL;');
    }
    return { products, tags, batches };
  }

  /**
   * Sincronización selectiva por dirección independiente: cada categoría puede BAJARSE
   * (nube → local) y/o SUBIRSE (local → nube) por separado. Bajar reactiva la categoría
   * (limpia "ignorar"); subir fuerza la re-subida (cubre el caso de nube blanqueada).
   * El borrado local es una acción aparte (ver `deleteCategories`).
   */
  async applySyncSelection(sel: {
    products: { up: boolean; down: boolean };
    tags: { up: boolean; down: boolean };
    batches: { up: boolean; down: boolean };
  }): Promise<void> {
    if (this.syncing$.value) {
      return;
    }
    this.setSyncing(true);
    try {
      await this.ensureAuth();

      // BAJAR (nube → local). Orden FK: lotes → productos → tags. Reactiva la categoría.
      if (sel.batches.down) {
        this.setIgnored('batches', false);
        await this.pullBatches();
      }
      if (sel.products.down) {
        this.setIgnored('products', false);
        await this.pullProducts();
      }
      if (sel.tags.down) {
        this.setIgnored('tags', false);
        await this.pullTags();
      }

      // SUBIR (local → nube) con re-subida forzada. Mismo orden FK.
      if (sel.batches.up) {
        await this.db.execute('UPDATE print_batch SET synced_at = NULL;');
        await this.syncBatches();
      }
      if (sel.products.up) {
        await this.db.execute('UPDATE product SET synced_at = NULL;');
        await this.syncProducts();
      }
      if (sel.tags.up) {
        await this.db.execute('UPDATE tag_code SET synced_at = NULL;');
        await this.syncTags();
      }

      this.lastSync$.next(new Date().toISOString());
    } finally {
      this.setSyncing(false);
      this.flushQueuedPush();
    }
  }

  /**
   * Elimina categorías del local (acción explícita, independiente de la sincronización).
   * Marca las eliminadas como "ignorar bajada" para que el auto-sync no las vuelva a
   * descargar (la nube las conserva). Borrado en cascada FK-segura: borrar Lotes arrastra
   * todos los Tags; borrar Productos arrastra los Tags vinculados.
   */
  async deleteCategories(del: {
    products: boolean;
    tags: boolean;
    batches: boolean;
  }): Promise<void> {
    if (this.syncing$.value) {
      return;
    }
    this.setSyncing(true);
    try {
      if (del.products) {
        this.setIgnored('products', true);
      }
      // Borrar Lotes elimina TODOS los tags (cascada) ⇒ también se ignora la bajada de tags.
      if (del.tags || del.batches) {
        this.setIgnored('tags', true);
      }
      if (del.batches) {
        this.setIgnored('batches', true);
      }
      await this.deleteLocalCategories(del);
    } finally {
      this.setSyncing(false);
    }
  }

  /** Elimina del local las categorías indicadas, respetando llaves foráneas (cascada). */
  private async deleteLocalCategories(del: {
    products: boolean;
    tags: boolean;
    batches: boolean;
  }): Promise<void> {
    if (!del.products && !del.tags && !del.batches) {
      return;
    }
    const set: { statement: string; values: unknown[] }[] = [];
    // 1) Tags primero (otras tablas no dependen de tags). Todo tag referencia un lote,
    //    así que borrar Lotes obliga a borrar TODOS los tags; borrar Productos arrastra
    //    los tags vinculados a un producto.
    if (del.tags || del.batches) {
      set.push({ statement: 'DELETE FROM tag_code;', values: [] });
    } else if (del.products) {
      set.push({ statement: 'DELETE FROM tag_code WHERE product_id IS NOT NULL;', values: [] });
    }
    // 2) Productos (y sus variantes) — explícito por si FK cascade no está activo.
    if (del.products) {
      set.push({ statement: 'DELETE FROM product_variant;', values: [] });
      set.push({ statement: 'DELETE FROM product;', values: [] });
    }
    // 3) Lotes al final (ya no quedan tags que los referencien).
    if (del.batches) {
      set.push({ statement: 'DELETE FROM print_batch;', values: [] });
    }
    await this.db.executeSet(set);
  }

  /**
   * Borra TODO: primero los documentos de la nube (Firestore) y luego la base local.
   * Empieza de cero. Si no clarara la nube, la siguiente bajada repoblaría lo local.
   */
  async resetEverything(): Promise<void> {
    if (this.syncing$.value) {
      return;
    }
    this.setSyncing(true);
    try {
      await this.ensureAuth();
      for (const col of ['tags', 'products', 'batches']) {
        const snap = await runInInjectionContext(this.injector, () =>
          getDocs(collection(this.firestore, col)),
        );
        for (const d of snap.docs) {
          await runInInjectionContext(this.injector, () =>
            deleteDoc(doc(this.firestore, col, d.id)),
          );
        }
      }
      await this.db.resetAll();
      this.lastSync$.next(null);
    } finally {
      this.setSyncing(false);
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

  // ---------------------------------------------------------------------------
  // BAJADA (Firestore → SQLite)
  // ---------------------------------------------------------------------------

  /** Lotes: inmutables; se insertan los que no existan localmente. */
  private async pullBatches(): Promise<void> {
    if (this.isIgnored('batches')) {
      return;
    }
    const docs = await this.fetchCollection('batches');
    const now = new Date().toISOString();
    for (const b of docs) {
      const exists = await this.exists('print_batch', b['id'] as string);
      if (!exists) {
        await this.db.execute(
          `INSERT OR IGNORE INTO print_batch (id, created_at, quantity, layout, code_type, synced_at)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [b['id'], b['createdAt'], b['quantity'], b['layout'], b['codeType'], now],
        );
      }
    }
  }

  /** Productos: last-write-wins por updatedAt; reemplaza producto + variantes. */
  private async pullProducts(): Promise<void> {
    if (this.isIgnored('products')) {
      return;
    }
    const docs = await this.fetchCollection('products');
    const now = new Date().toISOString();
    for (const p of docs) {
      const id = p['id'] as string;
      const cloudUpdated = (p['updatedAt'] as string) ?? '';
      const localUpdated = await this.localTimestamp('SELECT updated_at AS ts FROM product WHERE id = ?;', id);

      if (localUpdated !== null && localUpdated >= cloudUpdated) {
        continue; // local igual o más nuevo
      }

      const variants = (p['variants'] as ProductVariant[] | undefined) ?? [];
      const cloudImages = (p['images'] as string[] | undefined) ?? [];
      const set: { statement: string; values: unknown[] }[] = [
        {
          statement: `INSERT OR REPLACE INTO product
            (id, name, sku, price, cost_price, supplier, supplier_id, purchase_doc, category, created_by, images, created_at, updated_at, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          values: [
            id,
            p['name'],
            p['sku'] ?? null,
            p['price'],
            p['costPrice'] ?? null,
            p['supplier'] ?? null,
            p['supplierId'] ?? null,
            p['purchaseDoc'] ?? null,
            p['category'] ?? null,
            p['createdBy'] ?? null,
            cloudImages.length ? JSON.stringify(cloudImages) : null,
            p['createdAt'],
            p['updatedAt'],
            now,
          ],
        },
      ];
      // INSERT OR REPLACE del producto borra en cascada las variantes viejas; reinsertamos.
      for (const v of variants) {
        set.push({
          statement:
            'INSERT INTO product_variant (id, product_id, color, size, stock) VALUES (?, ?, ?, ?, ?);',
          values: [v.id, id, v.color ?? '', v.size ?? '', v.stock ?? 0],
        });
      }
      await this.db.executeSet(set);
    }
  }

  /** Tags: last-write-wins por (assignedAt ?? createdAt). */
  private async pullTags(): Promise<void> {
    if (this.isIgnored('tags')) {
      return;
    }
    const docs = await this.fetchCollection('tags');
    const now = new Date().toISOString();
    // Carga local en bloque (3 consultas) en vez de varias por cada tag.
    const localTags = await this.localTimestampMap(
      'SELECT id, COALESCE(assigned_at, created_at) AS ts FROM tag_code;',
    );
    const localBatchIds = await this.localIdSet('print_batch');
    const localProdIds = await this.localIdSet('product');

    for (const t of docs) {
      const id = t['id'] as string;
      const cloudTs = ((t['assignedAt'] as string) || (t['createdAt'] as string)) ?? '';
      const localTs = localTags.get(id);

      if (localTs !== undefined && localTs >= cloudTs) {
        continue;
      }

      // Integridad FK: un tag necesita su lote local; si referencia un producto que no está
      // localmente, no se baja (evita violar llaves foráneas al bajar Tags sin Lotes/Productos).
      const batchId = t['printBatchId'] as string;
      if (!localBatchIds.has(batchId)) {
        continue;
      }
      const refProductId = (t['productId'] as string) ?? null;
      if (refProductId && !localProdIds.has(refProductId)) {
        continue;
      }

      await this.db.execute(
        `INSERT OR REPLACE INTO tag_code
          (id, status, created_at, assigned_at, assigned_by, product_id, variant_id, print_batch_id, origin, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          t['status'],
          t['createdAt'],
          t['assignedAt'] ?? null,
          t['assignedBy'] ?? null,
          t['productId'] ?? null,
          t['variantId'] ?? null,
          t['printBatchId'],
          (t['origin'] as string) ?? 'GENERATED',
          now,
        ],
      );
    }
  }

  private async fetchCollection(name: string): Promise<Record<string, unknown>[]> {
    const snap = await runInInjectionContext(this.injector, () =>
      getDocs(collection(this.firestore, name)),
    );
    return snap.docs.map((d) => d.data() as Record<string, unknown>);
  }

  private async exists(table: string, id: string): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>(
      `SELECT id FROM ${table} WHERE id = ? LIMIT 1;`,
      [id],
    );
    return rows.length > 0;
  }

  private async localTimestamp(sql: string, id: string): Promise<string | null> {
    const rows = await this.db.query<{ ts: string | null }>(sql, [id]);
    return rows.length ? (rows[0].ts ?? '') : null;
  }

  /**
   * True si conviene sobrescribir la fila local con la de la nube: no existe, o existe pero
   * ya está sincronizada (sin edición local pendiente). Evita pisar un cambio local sin subir.
   */
  private async shouldOverwrite(table: string, id: string): Promise<boolean> {
    const rows = await this.db.query<{ synced_at: string | null }>(
      `SELECT synced_at FROM ${table} WHERE id = ? LIMIT 1;`,
      [id],
    );
    return rows.length === 0 || rows[0].synced_at !== null;
  }

  /** Baja los catálogos (colores, tallas, proveedores) de la nube. */
  private async pullCatalogs(): Promise<void> {
    const now = new Date().toISOString();

    for (const c of await this.fetchCollection('colors')) {
      const id = c['id'] as string;
      if (!(await this.shouldOverwrite('color', id))) {
        continue;
      }
      await this.db.execute(
        'INSERT OR REPLACE INTO color (id, name, hex, sort_order, created_at, synced_at) VALUES (?, ?, ?, ?, ?, ?);',
        [id, c['name'], c['hex'], c['sortOrder'] ?? 0, c['createdAt'] ?? now, now],
      );
    }

    for (const s of await this.fetchCollection('sizes')) {
      const id = s['id'] as string;
      if (!(await this.shouldOverwrite('size', id))) {
        continue;
      }
      await this.db.execute(
        'INSERT OR REPLACE INTO size (id, label, sort_order, created_at, synced_at) VALUES (?, ?, ?, ?, ?);',
        [id, s['label'], s['sortOrder'] ?? 0, s['createdAt'] ?? now, now],
      );
    }

    for (const p of await this.fetchCollection('suppliers')) {
      const id = p['id'] as string;
      if (!(await this.shouldOverwrite('supplier', id))) {
        continue;
      }
      await this.db.execute(
        'INSERT OR REPLACE INTO supplier (id, name, whatsapp, address, created_at, synced_at) VALUES (?, ?, ?, ?, ?, ?);',
        [id, p['name'], p['whatsapp'] ?? null, p['address'] ?? null, p['createdAt'] ?? now, now],
      );
    }
  }

  // ---------------------------------------------------------------------------
  // SUBIDA (SQLite → Firestore)
  // ---------------------------------------------------------------------------

  private async syncBatches(): Promise<void> {
    const rows = await this.db.query<SyncRow>('SELECT * FROM print_batch WHERE synced_at IS NULL;');
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
        variantId: r['variant_id'],
        printBatchId: r['print_batch_id'],
        origin: r['origin'],
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
        // Las fotos (base64 livianas) viajan dentro del documento Firestore — así se
        // respaldan y descargan a otros dispositivos sin Firebase Storage. Salvaguarda:
        // si el documento superara ~900KB, se omiten las fotos para no exceder 1MB.
        const docData: Record<string, unknown> = { ...product };
        if (product.images?.length && JSON.stringify(docData).length > 900_000) {
          console.warn('[Sync] Documento muy grande; se omiten fotos en la nube.');
          docData['images'] = [];
        }
        await this.upload('products', id, docData);
      }
      await this.markSynced('product', id);
    }
  }

  /** Sube los catálogos locales pendientes (colores, tallas, proveedores). */
  private async pushCatalogs(): Promise<void> {
    for (const r of await this.db.query<SyncRow>('SELECT * FROM color WHERE synced_at IS NULL;')) {
      await this.upload('colors', r.id, {
        id: r['id'],
        name: r['name'],
        hex: r['hex'],
        sortOrder: r['sort_order'],
        createdAt: r['created_at'],
      });
      await this.markSynced('color', r.id);
    }
    for (const r of await this.db.query<SyncRow>('SELECT * FROM size WHERE synced_at IS NULL;')) {
      await this.upload('sizes', r.id, {
        id: r['id'],
        label: r['label'],
        sortOrder: r['sort_order'],
        createdAt: r['created_at'],
      });
      await this.markSynced('size', r.id);
    }
    for (const r of await this.db.query<SyncRow>('SELECT * FROM supplier WHERE synced_at IS NULL;')) {
      await this.upload('suppliers', r.id, {
        id: r['id'],
        name: r['name'],
        whatsapp: r['whatsapp'],
        address: r['address'],
        createdAt: r['created_at'],
      });
      await this.markSynced('supplier', r.id);
    }
  }

  /** Escribe un documento en Firestore (elimina undefined que Firestore rechaza). */
  private async upload(collectionName: string, id: string, data: unknown): Promise<void> {
    const clean = JSON.parse(JSON.stringify(data));
    await runInInjectionContext(this.injector, () =>
      setDoc(doc(this.firestore, collectionName, id), clean),
    );
  }

  private async markSynced(table: string, id: string): Promise<void> {
    await this.db.execute(`UPDATE ${table} SET synced_at = ? WHERE id = ?;`, [
      new Date().toISOString(),
      id,
    ]);
  }
}
