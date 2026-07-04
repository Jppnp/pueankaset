import { useFreshUserDataDir } from './mocks/electron'
import { initDatabase, getDb } from '../src/main/database'

/** Create a clean database (all migrations applied) for one test. */
export function freshDb(): ReturnType<typeof getDb> {
  useFreshUserDataDir()
  initDatabase()
  return getDb()
}

export function createProduct(
  db: ReturnType<typeof getDb>,
  overrides: Partial<{
    name: string
    cost_price: number
    sale_price: number
    stock_on_hand: number
    exclude_from_profit: number
    is_deleted: number
    store_id: number
  }> = {}
): number {
  const p = {
    name: 'ปุ๋ยทดสอบ',
    cost_price: 80,
    sale_price: 100,
    stock_on_hand: 50,
    exclude_from_profit: 0,
    is_deleted: 0,
    store_id: 1,
    ...overrides
  }
  const result = db
    .prepare(
      `INSERT INTO products (name, cost_price, sale_price, stock_on_hand, exclude_from_profit, is_deleted, store_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(p.name, p.cost_price, p.sale_price, p.stock_on_hand, p.exclude_from_profit, p.is_deleted, p.store_id)
  return result.lastInsertRowid as number
}

export function createCustomer(db: ReturnType<typeof getDb>, name = 'ลูกค้าทดสอบ'): number {
  return db.prepare('INSERT INTO customers (name) VALUES (?)').run(name).lastInsertRowid as number
}

export function getStock(db: ReturnType<typeof getDb>, productId: number): number {
  const row = db.prepare('SELECT stock_on_hand FROM products WHERE id = ?').get(productId) as {
    stock_on_hand: number
  }
  return row.stock_on_hand
}

export function countRows(db: ReturnType<typeof getDb>, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }
  return row.n
}
