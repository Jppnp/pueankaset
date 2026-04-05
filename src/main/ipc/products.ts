import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerProductHandlers(): void {
  ipcMain.handle('products:list', (_event, query?: string, storeId?: number) => {
    const db = getDb()
    const conditions: string[] = []
    const params: unknown[] = []

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
    return db.prepare(`SELECT * FROM products ${where} ORDER BY name`).all(...params)
  })

  ipcMain.handle('products:get', (_event, id: number) => {
    const db = getDb()
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id) ?? null
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

  ipcMain.handle('products:search', (_event, query: string) => {
    const db = getDb()
    if (!query.trim()) return []
    const term = `%${query.trim()}%`
    return db
      .prepare(
        `SELECT * FROM products WHERE name LIKE ? OR description LIKE ? ORDER BY name LIMIT 50`
      )
      .all(term, term)
  })
}
