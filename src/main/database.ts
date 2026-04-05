import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'pueankaset.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations()
}

// Migrations inlined for reliable bundling with electron-vite
const migrations: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  cost_price REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  stock_on_hand INTEGER NOT NULL DEFAULT 0,
  exclude_from_profit INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  total_amount REAL NOT NULL DEFAULT 0,
  remark TEXT
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  cost_price REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS parked_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT,
  items_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`
  },
  {
    version: 2,
    sql: `
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO stores (id, name) VALUES (1, 'ร้านหลัก');

ALTER TABLE products ADD COLUMN store_id INTEGER DEFAULT 1;

UPDATE products SET store_id = 1 WHERE store_id IS NULL;
`
  },
  {
    version: 3,
    sql: `
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES ('owner_password', '1234');

ALTER TABLE sales ADD COLUMN seller_role TEXT NOT NULL DEFAULT 'owner';
`
  },
  {
    version: 4,
    sql: `
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE sales ADD COLUMN customer_id INTEGER DEFAULT NULL;
ALTER TABLE sales ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'cash';

CREATE TABLE IF NOT EXISTS customer_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
`
  },
  {
    version: 5,
    sql: `
CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  total_amount REAL NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sale_id) REFERENCES sales(id)
);

CREATE TABLE IF NOT EXISTS refund_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  refund_id INTEGER NOT NULL,
  sale_item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  FOREIGN KEY (refund_id) REFERENCES refunds(id),
  FOREIGN KEY (sale_item_id) REFERENCES sale_items(id)
);
`
  },
  {
    version: 6,
    sql: `
CREATE TABLE IF NOT EXISTS exchanges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_sale_id INTEGER NOT NULL,
  refund_id INTEGER NOT NULL,
  new_sale_id INTEGER NOT NULL,
  price_difference REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (original_sale_id) REFERENCES sales(id),
  FOREIGN KEY (refund_id) REFERENCES refunds(id),
  FOREIGN KEY (new_sale_id) REFERENCES sales(id)
);
`
  },
  {
    version: 7,
    sql: `
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('in', 'out', 'adjust')),
  quantity INTEGER NOT NULL,
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  reason TEXT,
  reference_type TEXT,
  reference_id INTEGER,
  created_by TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);
`
  },
  {
    version: 8,
    sql: `
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
`
  }
]

function runMigrations(): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`)

  const currentVersion =
    (db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null })
      ?.v ?? 0

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue

    const migrate = db.transaction(() => {
      db.exec(migration.sql)
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version)
    })

    migrate()
    console.log(`Migration ${migration.version} applied`)
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close()
  }
}
