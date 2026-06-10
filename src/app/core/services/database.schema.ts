/**
 * Schema SQLite de VStore (capability: local-persistence).
 * Se ejecuta de forma idempotente en cada arranque (`CREATE TABLE IF NOT EXISTS`).
 *
 * Orden de creación: las tablas padre (print_batch, product) van antes que las
 * que las referencian (product_variant, tag_code) para evitar referencias colgantes.
 * `PRAGMA foreign_keys = ON` es necesario para que `ON DELETE CASCADE` aplique.
 */
export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS print_batch (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 40,
  layout TEXT NOT NULL DEFAULT '5x8',
  code_type TEXT NOT NULL DEFAULT 'QR',
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS product (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  price REAL NOT NULL,
  cost_price REAL,
  supplier TEXT,
  category TEXT,
  created_by TEXT,
  images TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS product_variant (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  color TEXT,
  size TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tag_code (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL,
  assigned_at TEXT,
  assigned_by TEXT,
  product_id TEXT,
  variant_id TEXT,
  print_batch_id TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'GENERATED',
  synced_at TEXT,
  FOREIGN KEY (product_id) REFERENCES product(id),
  FOREIGN KEY (variant_id) REFERENCES product_variant(id),
  FOREIGN KEY (print_batch_id) REFERENCES print_batch(id)
);

CREATE TABLE IF NOT EXISTS supplier (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  whatsapp TEXT,
  address TEXT,
  created_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS color (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hex TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS size (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tag_code_status ON tag_code(status);
CREATE INDEX IF NOT EXISTS idx_tag_code_batch ON tag_code(print_batch_id);
CREATE INDEX IF NOT EXISTS idx_tag_code_product ON tag_code(product_id);
CREATE INDEX IF NOT EXISTS idx_variant_product ON product_variant(product_id);
`;
