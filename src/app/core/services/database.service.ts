import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { Observable, Subject } from 'rxjs';

import { SCHEMA_SQL } from './database.schema';

/**
 * DatabaseService — punto único de acceso a SQLite (capability: local-persistence).
 *
 * Responsabilidades:
 * - Inicializar SQLite al arrancar (incluye el web store de jeep-sqlite en navegador).
 * - Ejecutar el schema (database.schema.ts) de forma idempotente.
 * - Exponer CRUD genérico parametrizado (`query`, `execute`) usado por los demás servicios.
 *
 * Funciona 100% offline: en nativo usa SQLite real; en web usa sql.js (jeep-sqlite)
 * persistido en IndexedDB mediante `saveToStore`.
 */
@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private readonly sqlite = new SQLiteConnection(CapacitorSQLite);
  private readonly dbName = 'vstore';
  private db?: SQLiteDBConnection;
  /** Promesa compartida de inicialización (evita carreras y dobles init). */
  private initPromise?: Promise<void>;

  /** Emite tras cada escritura (para disparar auto-sincronización). */
  private readonly changed = new Subject<void>();
  get changes$(): Observable<void> {
    return this.changed.asObservable();
  }

  /** True cuando corremos en navegador (sql.js) y hay que persistir a IndexedDB. */
  private get isWeb(): boolean {
    return Capacitor.getPlatform() === 'web';
  }

  /**
   * Inicializa la base local (idempotente). Cualquier consulta también la dispara, así
   * que no importa el orden de arranque: la BD siempre estará lista antes de usarse.
   */
  initDatabase(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInit();
    }
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    if (this.isWeb) {
      // Persistencia del store de sql.js en IndexedDB (jeep-sqlite ya montado en main.ts).
      await this.sqlite.initWebStore();
    }

    // Reutiliza la conexión si ya existe (p. ej. tras un hot-reload), si no la crea.
    const consistency = (await this.sqlite.checkConnectionsConsistency()).result ?? false;
    const alreadyConnected = (await this.sqlite.isConnection(this.dbName, false)).result ?? false;

    this.db =
      consistency && alreadyConnected
        ? await this.sqlite.retrieveConnection(this.dbName, false)
        : await this.sqlite.createConnection(this.dbName, false, 'no-encryption', 1, false);

    await this.db.open();
    await this.db.execute(SCHEMA_SQL);
    await this.runMigrations();

    if (this.isWeb) {
      await this.sqlite.saveToStore(this.dbName);
    }
  }

  /**
   * Migraciones idempotentes para bases ya creadas (el `CREATE TABLE IF NOT EXISTS`
   * no agrega columnas a tablas existentes). Usa la conexión directa (no `query`) para
   * no auto-esperar la inicialización en curso.
   */
  private async runMigrations(): Promise<void> {
    await this.ensureColumn('product', 'created_by', 'created_by TEXT');
    await this.ensureColumn('product', 'images', 'images TEXT');
    await this.ensureColumn('tag_code', 'assigned_by', 'assigned_by TEXT');
    await this.ensureColumn('tag_code', 'variant_id', 'variant_id TEXT');
    await this.ensureColumn('tag_code', 'origin', "origin TEXT NOT NULL DEFAULT 'GENERATED'");
    await this.ensureColumn('product', 'supplier_id', 'supplier_id TEXT');
    await this.ensureColumn('product', 'purchase_doc', 'purchase_doc TEXT');
  }

  private async ensureColumn(table: string, column: string, ddl: string): Promise<void> {
    const result = await this.db!.query(`PRAGMA table_info(${table});`);
    const cols = (result.values ?? []) as { name: string }[];
    if (!cols.some((c) => c.name === column)) {
      await this.db!.execute(`ALTER TABLE ${table} ADD COLUMN ${ddl};`);
    }
  }

  /** Ejecuta un SELECT parametrizado y devuelve las filas tipadas. */
  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.initDatabase();
    const db = this.requireDb();
    const result = await db.query(sql, params as never[]);
    return (result.values ?? []) as T[];
  }

  /**
   * Ejecuta un INSERT/UPDATE/DELETE parametrizado. En web persiste el store tras escribir.
   */
  async execute(sql: string, params: unknown[] = []): Promise<void> {
    await this.initDatabase();
    const db = this.requireDb();
    await db.run(sql, params as never[], false);
    if (this.isWeb) {
      await this.sqlite.saveToStore(this.dbName);
    }
    this.changed.next();
  }

  /**
   * Ejecuta un conjunto de sentencias parametrizadas en una sola transacción y
   * persiste el store una única vez (en web). Ideal para inserciones por lote.
   */
  async executeSet(set: { statement: string; values: unknown[] }[]): Promise<void> {
    if (set.length === 0) {
      return;
    }
    await this.initDatabase();
    const db = this.requireDb();
    await db.executeSet(set as never[], false);
    if (this.isWeb) {
      await this.sqlite.saveToStore(this.dbName);
    }
    this.changed.next();
  }

  /** Borra todos los datos locales (no el schema). Útil para empezar de cero. */
  async resetAll(): Promise<void> {
    await this.execute('DELETE FROM tag_code;');
    await this.execute('DELETE FROM product_variant;');
    await this.execute('DELETE FROM product;');
    await this.execute('DELETE FROM print_batch;');
  }

  private requireDb(): SQLiteDBConnection {
    if (!this.db) {
      throw new Error('DatabaseService: la base de datos no está disponible.');
    }
    return this.db;
  }
}
