import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import { getDb } from '../database'

type ProductListStatus = 'notDeleted' | 'deleted' | 'all'

interface ProductListOptions {
  status?: ProductListStatus
}

function normalizeStatus(status?: ProductListStatus): ProductListStatus {
  return ['notDeleted', 'deleted', 'all'].includes(status ?? '')
    ? status!
    : 'notDeleted'
}

function getProductById(db: Database.Database, id: number): unknown {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id) ?? null
}

export function registerProductHandlers(): void {
  ipcMain.handle(
    'products:list',
    (_event, query?: string, storeId?: number, options?: ProductListOptions) => {
    const db = getDb()
    const conditions: string[] = []
    const params: unknown[] = []
    const status = normalizeStatus(options?.status)

    if (status === 'deleted') {
      conditions.push('is_deleted = 1')
    } else if (status === 'notDeleted') {
      conditions.push('is_deleted = 0')
    }

    if (storeId) {
      conditions.push('store_id = ?')
      params.push(storeId)
    }
    if (query && query.trim()) {
      const term = `%${query.trim()}%`
      conditions.push('(name LIKE ? OR description LIKE ?)')
      params.push(term, term)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    return db
      .prepare(`SELECT * FROM products ${where} ORDER BY is_deleted ASC, name`)
      .all(...params)
    }
  )

  ipcMain.handle('products:get', (_event, id: number) => {
    const db = getDb()
    return getProductById(db, id)
  })

  ipcMain.handle(
    'products:create',
    (
      _event,
      product: {
        name: string
        description: string | null
        cost_price: number
        sale_price: number
        stock_on_hand: number
        exclude_from_profit: number
        store_id: number
      }
    ) => {
      if (!product.name?.trim()) throw new Error('ชื่อสินค้าห้ามว่าง')
      if (typeof product.cost_price !== 'number' || product.cost_price < 0)
        throw new Error('ราคาทุนต้องไม่ติดลบ')
      if (typeof product.sale_price !== 'number' || product.sale_price < 0)
        throw new Error('ราคาขายต้องไม่ติดลบ')
      if (typeof product.stock_on_hand !== 'number' || product.stock_on_hand < 0)
        throw new Error('จำนวนคงเหลือต้องไม่ติดลบ')

      const db = getDb()
      const result = db
        .prepare(
          `INSERT INTO products (name, description, cost_price, sale_price, stock_on_hand, exclude_from_profit, store_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          product.name,
          product.description,
          product.cost_price,
          product.sale_price,
          product.stock_on_hand,
          product.exclude_from_profit,
          product.store_id ?? 1
        )
      return db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid)
    }
  )

  ipcMain.handle(
    'products:update',
    (_event, id: number, updates: Record<string, unknown>) => {
      const db = getDb()
      const allowed = [
        'name',
        'description',
        'cost_price',
        'sale_price',
        'stock_on_hand',
        'exclude_from_profit',
        'store_id'
      ]
      const fields: string[] = []
      const values: unknown[] = []

      for (const key of allowed) {
        if (key in updates) {
          fields.push(`${key} = ?`)
          values.push(updates[key])
        }
      }

      if (fields.length === 0) {
        return db.prepare('SELECT * FROM products WHERE id = ?').get(id)
      }

      fields.push(`updated_at = datetime('now')`)
      values.push(id)

      db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...values)
      return db.prepare('SELECT * FROM products WHERE id = ?').get(id)
    }
  )

  ipcMain.handle('products:check-duplicate', (_event, name: string, excludeId?: number) => {
    const db = getDb()
    const trimmed = name?.trim()
    if (!trimmed) return null
    if (excludeId) {
      return db
        .prepare('SELECT id, name FROM products WHERE name = ? AND id != ? AND is_deleted = 0')
        .get(trimmed, excludeId) ?? null
    }
    return db
      .prepare('SELECT id, name FROM products WHERE name = ? AND is_deleted = 0')
      .get(trimmed) ?? null
  })

  ipcMain.handle('products:search', (_event, query: string) => {
    const db = getDb()
    if (!query.trim()) return []
    const term = `%${query.trim()}%`
    return db
      .prepare(
        `SELECT *
         FROM products
         WHERE is_deleted = 0
           AND (name LIKE ? OR description LIKE ?)
         ORDER BY name
         LIMIT 50`
      )
      .all(term, term)
  })

  ipcMain.handle('products:delete', (_event, id: number) => {
    const db = getDb()
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(id)
    if (!product) throw new Error('ไม่พบสินค้า')

    db.prepare(
      `UPDATE products
       SET is_deleted = 1,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(id)

    return { success: true }
  })

  ipcMain.handle('products:restore', (_event, id: number) => {
    const db = getDb()
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(id)
    if (!product) throw new Error('ไม่พบสินค้า')

    db.prepare(
      `UPDATE products
       SET is_deleted = 0,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(id)

    return getProductById(db, id)
  })
}
