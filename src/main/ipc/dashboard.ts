import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerDashboardHandlers(): void {
  // Today's summary: revenue, cost, profit, order count
  ipcMain.handle(
    'dashboard:summary',
    (_event, dateFrom: string, dateTo: string, storeId?: number) => {
      const db = getDb()

      const conditions: string[] = ['p.exclude_from_profit = 0']
      const params: unknown[] = []

      conditions.push('s.date >= ?')
      params.push(dateFrom)
      conditions.push('s.date <= ?')
      params.push(dateTo)

      if (storeId) {
        conditions.push('p.store_id = ?')
        params.push(storeId)
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
        .get(...params)

      return result
    }
  )

  // Top-selling products by quantity
  ipcMain.handle(
    'dashboard:top-products',
    (_event, dateFrom: string, dateTo: string, limit?: number, storeId?: number) => {
      const db = getDb()

      const conditions: string[] = []
      const params: unknown[] = []

      conditions.push('s.date >= ?')
      params.push(dateFrom)
      conditions.push('s.date <= ?')
      params.push(dateTo)

      if (storeId) {
        conditions.push('p.store_id = ?')
        params.push(storeId)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const rows = db
        .prepare(
          `SELECT
            p.id, p.name, p.sale_price,
            SUM(si.quantity) as total_quantity,
            SUM(si.price * si.quantity) as total_revenue
           FROM sale_items si
           JOIN sales s ON s.id = si.sale_id
           JOIN products p ON p.id = si.product_id
           ${where}
           GROUP BY p.id
           ORDER BY total_quantity DESC
           LIMIT ?`
        )
        .all(...params, limit ?? 10)

      return rows
    }
  )

  // Products with low stock
  ipcMain.handle(
    'dashboard:low-stock',
    (_event, threshold?: number, storeId?: number) => {
      const db = getDb()

      const conditions: string[] = []
      const params: unknown[] = []

      conditions.push('stock_on_hand <= ?')
      params.push(threshold ?? 10)

      if (storeId) {
        conditions.push('store_id = ?')
        params.push(storeId)
      }

      const where = `WHERE ${conditions.join(' AND ')}`

      const rows = db
        .prepare(
          `SELECT id, name, stock_on_hand, sale_price, store_id
           FROM products
           ${where}
           ORDER BY stock_on_hand ASC
           LIMIT 20`
        )
        .all(...params)

      return rows
    }
  )

  // Daily revenue trend for the past N days
  ipcMain.handle(
    'dashboard:revenue-trend',
    (_event, dateFrom: string, dateTo: string, storeId?: number) => {
      const db = getDb()

      const conditions: string[] = []
      const params: unknown[] = []

      conditions.push('s.date >= ?')
      params.push(dateFrom)
      conditions.push('s.date <= ?')
      params.push(dateTo)

      if (storeId) {
        conditions.push('p.store_id = ?')
        params.push(storeId)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const rows = db
        .prepare(
          `SELECT
            date(s.date) as day,
            COALESCE(SUM(si.price * si.quantity), 0) as revenue,
            COUNT(DISTINCT s.id) as order_count
           FROM sales s
           JOIN sale_items si ON si.sale_id = s.id
           JOIN products p ON p.id = si.product_id
           ${where}
           GROUP BY date(s.date)
           ORDER BY day ASC`
        )
        .all(...params)

      return rows
    }
  )
}
