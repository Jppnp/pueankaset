import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { getDb } from '../database'

/** Insert a stock movement record. Must be called within the same transaction as the stock change. */
export function insertStockMovement(
  db: Database.Database,
  params: {
    productId: number
    type: 'in' | 'out' | 'adjust'
    quantity: number
    stockBefore: number
    stockAfter: number
    reason: string
    referenceType?: string
    referenceId?: number
    createdBy: string
  }
): void {
  db.prepare(
    `INSERT INTO stock_movements (product_id, type, quantity, stock_before, stock_after, reason, reference_type, reference_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    params.productId,
    params.type,
    params.quantity,
    params.stockBefore,
    params.stockAfter,
    params.reason,
    params.referenceType ?? null,
    params.referenceId ?? null,
    params.createdBy
  )
}

export function registerStockMovementHandlers(): void {
  // List movements for a product (paginated)
  ipcMain.handle(
    'stock-movements:list',
    (
      _event,
      params: {
        productId: number
        page: number
        pageSize: number
        dateFrom?: string
        dateTo?: string
      }
    ) => {
      const db = getDb()
      const { productId, page, pageSize, dateFrom, dateTo } = params

      const conditions: string[] = ['sm.product_id = ?']
      const whereParams: unknown[] = [productId]

      if (dateFrom) {
        conditions.push('sm.created_at >= ?')
        whereParams.push(dateFrom)
      }
      if (dateTo) {
        conditions.push('sm.created_at <= ?')
        whereParams.push(dateTo)
      }

      const where = `WHERE ${conditions.join(' AND ')}`

      const countResult = db
        .prepare(`SELECT COUNT(*) as total FROM stock_movements sm ${where}`)
        .get(...whereParams) as { total: number }

      const data = db
        .prepare(
          `SELECT sm.*, p.name as product_name
           FROM stock_movements sm
           JOIN products p ON p.id = sm.product_id
           ${where}
           ORDER BY sm.created_at DESC
           LIMIT ? OFFSET ?`
        )
        .all(...whereParams, pageSize, (page - 1) * pageSize)

      return { data, total: countResult.total, page, pageSize }
    }
  )

  // Add stock (restock)
  ipcMain.handle(
    'stock-movements:add-stock',
    (
      _event,
      input: { productId: number; quantity: number; reason: string; createdBy: string }
    ) => {
      if (!input.quantity || input.quantity <= 0) throw new Error('จำนวนต้องมากกว่า 0')
      if (!input.reason?.trim()) throw new Error('กรุณาระบุเหตุผล')

      const db = getDb()

      const doAdd = db.transaction(() => {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(input.productId) as
          | { id: number; stock_on_hand: number }
          | undefined
        if (!product) throw new Error('ไม่พบสินค้า')

        const stockBefore = product.stock_on_hand
        const stockAfter = stockBefore + input.quantity

        db.prepare(
          "UPDATE products SET stock_on_hand = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(stockAfter, input.productId)

        insertStockMovement(db, {
          productId: input.productId,
          type: 'in',
          quantity: input.quantity,
          stockBefore,
          stockAfter,
          reason: input.reason.trim(),
          referenceType: 'manual',
          createdBy: input.createdBy
        })

        return db
          .prepare(
            'SELECT sm.*, p.name as product_name FROM stock_movements sm JOIN products p ON p.id = sm.product_id WHERE sm.id = last_insert_rowid()'
          )
          .get()
      })

      return doAdd()
    }
  )

  // Adjust stock (set to exact number)
  ipcMain.handle(
    'stock-movements:adjust-stock',
    (
      _event,
      input: { productId: number; newQuantity: number; reason: string; createdBy: string }
    ) => {
      if (typeof input.newQuantity !== 'number' || input.newQuantity < 0)
        throw new Error('จำนวนต้องไม่ติดลบ')
      if (!input.reason?.trim()) throw new Error('กรุณาระบุเหตุผล')

      const db = getDb()

      const doAdjust = db.transaction(() => {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(input.productId) as
          | { id: number; stock_on_hand: number }
          | undefined
        if (!product) throw new Error('ไม่พบสินค้า')

        const stockBefore = product.stock_on_hand
        if (stockBefore === input.newQuantity) return null // No change needed

        const difference = Math.abs(input.newQuantity - stockBefore)

        db.prepare(
          "UPDATE products SET stock_on_hand = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(input.newQuantity, input.productId)

        insertStockMovement(db, {
          productId: input.productId,
          type: 'adjust',
          quantity: difference,
          stockBefore,
          stockAfter: input.newQuantity,
          reason: input.reason.trim(),
          referenceType: 'manual',
          createdBy: input.createdBy
        })

        return db
          .prepare(
            'SELECT sm.*, p.name as product_name FROM stock_movements sm JOIN products p ON p.id = sm.product_id WHERE sm.id = last_insert_rowid()'
          )
          .get()
      })

      return doAdjust()
    }
  )
}
