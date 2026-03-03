import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerProductHandlers(): void {
  ipcMain.handle('products:list', (_event, query?: string) => {
    const db = getDb()
    if (query && query.trim()) {
      const term = `%${query.trim()}%`
      return db
        .prepare(
          `SELECT * FROM products WHERE name LIKE ? OR description LIKE ? ORDER BY name`
        )
        .all(term, term)
    }
    return db.prepare('SELECT * FROM products ORDER BY name').all()
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
      }
    ) => {
      const db = getDb()
      const result = db
        .prepare(
          `INSERT INTO products (name, description, cost_price, sale_price, stock_on_hand, exclude_from_profit)
         VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          product.name,
          product.description,
          product.cost_price,
          product.sale_price,
          product.stock_on_hand,
          product.exclude_from_profit
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
        'exclude_from_profit'
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
