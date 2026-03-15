import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerSaleHandlers(): void {
  ipcMain.handle(
    'sales:create',
    (
      _event,
      input: {
        items: {
          product_id: number
          quantity: number
          price: number
          cost_price: number
        }[]
        remark?: string
      }
    ) => {
      const db = getDb()

      const createSale = db.transaction(() => {
        const total = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

        const saleResult = db
          .prepare(`INSERT INTO sales (date, total_amount, remark) VALUES (datetime('now'), ?, ?)`)
          .run(total, input.remark ?? null)

        const saleId = saleResult.lastInsertRowid as number

        const insertItem = db.prepare(
          `INSERT INTO sale_items (sale_id, product_id, quantity, price, cost_price) VALUES (?, ?, ?, ?, ?)`
        )
        const decrementStock = db.prepare(
          `UPDATE products SET stock_on_hand = stock_on_hand - ?, updated_at = datetime('now') WHERE id = ?`
        )

        for (const item of input.items) {
          insertItem.run(saleId, item.product_id, item.quantity, item.price, item.cost_price)
          decrementStock.run(item.quantity, item.product_id)
        }

        return { saleId, total }
      })

      return createSale()
    }
  )

  ipcMain.handle(
    'sales:list',
    (
      _event,
      params: { page: number; pageSize: number; dateFrom?: string; dateTo?: string; storeId?: number }
    ) => {
      const db = getDb()
      const { page, pageSize, dateFrom, dateTo, storeId } = params

      const conditions: string[] = []
      const whereParams: unknown[] = []

      if (dateFrom) {
        conditions.push('s.date >= ?')
        whereParams.push(dateFrom)
      }
      if (dateTo) {
        conditions.push('s.date <= ?')
        whereParams.push(dateTo)
      }
      if (storeId) {
        conditions.push(
          'EXISTS (SELECT 1 FROM sale_items si JOIN products p ON p.id = si.product_id WHERE si.sale_id = s.id AND p.store_id = ?)'
        )
        whereParams.push(storeId)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const countResult = db
        .prepare(`SELECT COUNT(*) as total FROM sales s ${where}`)
        .get(...whereParams) as { total: number }

      const data = db
        .prepare(`SELECT s.* FROM sales s ${where} ORDER BY s.date DESC LIMIT ? OFFSET ?`)
        .all(...whereParams, pageSize, (page - 1) * pageSize)

      return { data, total: countResult.total, page, pageSize }
    }
  )

  ipcMain.handle('sales:detail', (_event, id: number) => {
    const db = getDb()

    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id)
    if (!sale) return null

    const items = db
      .prepare(
        `SELECT si.*, p.name as product_name
         FROM sale_items si
         JOIN products p ON p.id = si.product_id
         WHERE si.sale_id = ?`
      )
      .all(id)

    return { ...sale, items }
  })

  ipcMain.handle(
    'sales:profit',
    (_event, dateFrom?: string, dateTo?: string, storeId?: number) => {
      const db = getDb()

      const conditions: string[] = ['p.exclude_from_profit = 0']
      const whereParams: unknown[] = []

      if (dateFrom) {
        conditions.push('s.date >= ?')
        whereParams.push(dateFrom)
      }
      if (dateTo) {
        conditions.push('s.date <= ?')
        whereParams.push(dateTo)
      }
      if (storeId) {
        conditions.push('p.store_id = ?')
        whereParams.push(storeId)
      }

      const where = `WHERE ${conditions.join(' AND ')}`

      const result = db
        .prepare(
          `SELECT
            COALESCE(SUM(si.price * si.quantity), 0) as total_revenue,
            COALESCE(SUM(si.cost_price * si.quantity), 0) as total_cost,
            COALESCE(SUM(si.price * si.quantity) - SUM(si.cost_price * si.quantity), 0) as total_profit,
            COUNT(DISTINCT s.id) as sale_count
           FROM sales s
           JOIN sale_items si ON si.sale_id = s.id
           JOIN products p ON p.id = si.product_id
           ${where}`
        )
        .get(...whereParams)

      return result
    }
  )
}
