import { ipcMain } from 'electron'
import { getDb } from '../database'
import { insertStockMovement } from './stock-movements'

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
        extraAmount?: number
        sellerRole: 'owner' | 'employee'
        customerId?: number
        paymentType?: 'cash' | 'card' | 'credit'
      }
    ) => {
      if (!['owner', 'employee'].includes(input.sellerRole)) {
        throw new Error('Invalid seller role')
      }

      const paymentType = input.paymentType ?? 'cash'
      if (!['cash', 'card', 'credit'].includes(paymentType)) {
        throw new Error('Invalid payment type')
      }

      if (paymentType === 'credit' && !input.customerId) {
        throw new Error('ต้องเลือกลูกค้าก่อนใช้การเชื่อ')
      }

      const db = getDb()

      if (input.customerId) {
        const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(input.customerId)
        if (!customer) throw new Error('ไม่พบลูกค้า')
      }

      const createSale = db.transaction(() => {
        const itemsTotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
        const total = itemsTotal + (input.extraAmount ?? 0)

        const saleResult = db
          .prepare(`INSERT INTO sales (date, total_amount, remark, seller_role, customer_id, payment_type) VALUES (datetime('now'), ?, ?, ?, ?, ?)`)
          .run(total, input.remark ?? null, input.sellerRole, input.customerId ?? null, paymentType)

        const saleId = saleResult.lastInsertRowid as number

        const insertItem = db.prepare(
          `INSERT INTO sale_items (sale_id, product_id, quantity, price, cost_price) VALUES (?, ?, ?, ?, ?)`
        )
        const decrementStock = db.prepare(
          `UPDATE products SET stock_on_hand = stock_on_hand - ?, updated_at = datetime('now') WHERE id = ?`
        )

        const checkStock = db.prepare(
          `SELECT stock_on_hand, name FROM products WHERE id = ?`
        )

        for (const item of input.items) {
          const product = checkStock.get(item.product_id) as
            | { stock_on_hand: number; name: string }
            | undefined
          if (!product) {
            throw new Error(`ไม่พบสินค้า (id: ${item.product_id})`)
          }
          if (product.stock_on_hand < item.quantity) {
            throw new Error(
              `สินค้า "${product.name}" มีสต็อกไม่เพียงพอ (คงเหลือ ${product.stock_on_hand} ต้องการ ${item.quantity})`
            )
          }
          insertItem.run(saleId, item.product_id, item.quantity, item.price, item.cost_price)
          decrementStock.run(item.quantity, item.product_id)
          insertStockMovement(db, {
            productId: item.product_id,
            type: 'out',
            quantity: item.quantity,
            stockBefore: product.stock_on_hand,
            stockAfter: product.stock_on_hand - item.quantity,
            reason: `ขายสินค้า (ใบเสร็จ #${saleId})`,
            referenceType: 'sale',
            referenceId: saleId,
            createdBy: input.sellerRole
          })
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
      params: { page: number; pageSize: number; dateFrom?: string; dateTo?: string; storeId?: number; customerId?: number }
    ) => {
      const db = getDb()
      const { page, pageSize, dateFrom, dateTo, storeId, customerId } = params

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
      if (customerId) {
        conditions.push('s.customer_id = ?')
        whereParams.push(customerId)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const countResult = db
        .prepare(`SELECT COUNT(*) as total FROM sales s ${where}`)
        .get(...whereParams) as { total: number }

      const data = db
        .prepare(
          `SELECT s.*, c.name as customer_name,
            EXISTS (SELECT 1 FROM refunds r WHERE r.sale_id = s.id) as has_refund,
            EXISTS (SELECT 1 FROM exchanges e WHERE e.original_sale_id = s.id) as has_exchange
           FROM sales s
           LEFT JOIN customers c ON c.id = s.customer_id
           ${where} ORDER BY s.date DESC LIMIT ? OFFSET ?`
        )
        .all(...whereParams, pageSize, (page - 1) * pageSize)

      return { data, total: countResult.total, page, pageSize }
    }
  )

  ipcMain.handle('sales:detail', (_event, id: number) => {
    const db = getDb()

    const sale = db
      .prepare(
        `SELECT s.*, c.name as customer_name, c.phone as customer_phone
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         WHERE s.id = ?`
      )
      .get(id)
    if (!sale) return null

    const items = db
      .prepare(
        `SELECT si.*, p.name as product_name,
          COALESCE((SELECT SUM(ri.quantity) FROM refund_items ri WHERE ri.sale_item_id = si.id), 0) as refunded_qty
         FROM sale_items si
         JOIN products p ON p.id = si.product_id
         WHERE si.sale_id = ?`
      )
      .all(id)

    const refunds = db
      .prepare('SELECT * FROM refunds WHERE sale_id = ? ORDER BY date DESC')
      .all(id) as { id: number }[]

    const getRefundItems = db.prepare(
      `SELECT ri.*, p.name as product_name
       FROM refund_items ri
       JOIN sale_items si ON si.id = ri.sale_item_id
       JOIN products p ON p.id = si.product_id
       WHERE ri.refund_id = ?`
    )

    const refundsWithItems = refunds.map((r) => ({
      ...r,
      items: getRefundItems.all(r.id)
    }))

    // Fetch exchanges
    const exchanges = db
      .prepare('SELECT * FROM exchanges WHERE original_sale_id = ? ORDER BY date DESC')
      .all(id) as { id: number; refund_id: number; new_sale_id: number }[]

    const getExchangeRefundItems = db.prepare(
      `SELECT ri.*, p.name as product_name
       FROM refund_items ri
       JOIN sale_items si ON si.id = ri.sale_item_id
       JOIN products p ON p.id = si.product_id
       WHERE ri.refund_id = ?`
    )
    const getExchangeNewItems = db.prepare(
      `SELECT si.*, p.name as product_name
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = ?`
    )

    const exchangesWithDetails = exchanges.map((e) => ({
      ...e,
      returnItems: getExchangeRefundItems.all(e.refund_id),
      newItems: getExchangeNewItems.all(e.new_sale_id)
    }))

    return { ...sale, items, refunds: refundsWithItems, exchanges: exchangesWithDetails }
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

      const gross = db
        .prepare(
          `SELECT
            COALESCE(SUM(si.price * si.quantity), 0) as total_revenue,
            COALESCE(SUM(si.cost_price * si.quantity), 0) as total_cost,
            COUNT(DISTINCT s.id) as sale_count
           FROM sales s
           JOIN sale_items si ON si.sale_id = s.id
           JOIN products p ON p.id = si.product_id
           ${where}`
        )
        .get(...whereParams) as { total_revenue: number; total_cost: number; sale_count: number }

      // Subtract refunded amounts
      const refundConditions: string[] = ['p.exclude_from_profit = 0']
      const refundParams: unknown[] = []
      if (dateFrom) { refundConditions.push('s.date >= ?'); refundParams.push(dateFrom) }
      if (dateTo) { refundConditions.push('s.date <= ?'); refundParams.push(dateTo) }
      if (storeId) { refundConditions.push('p.store_id = ?'); refundParams.push(storeId) }
      const refundWhere = `WHERE ${refundConditions.join(' AND ')}`

      const refunded = db
        .prepare(
          `SELECT
            COALESCE(SUM(ri.price * ri.quantity), 0) as refund_revenue,
            COALESCE(SUM(si.cost_price * ri.quantity), 0) as refund_cost
           FROM refund_items ri
           JOIN refunds r ON r.id = ri.refund_id
           JOIN sale_items si ON si.id = ri.sale_item_id
           JOIN sales s ON s.id = r.sale_id
           JOIN products p ON p.id = si.product_id
           ${refundWhere}`
        )
        .get(...refundParams) as { refund_revenue: number; refund_cost: number }

      const total_revenue = gross.total_revenue - refunded.refund_revenue
      const total_cost = gross.total_cost - refunded.refund_cost

      // Expenses for the date range (business-wide, not store-specific)
      const expenseConditions: string[] = []
      const expenseParams: unknown[] = []
      if (dateFrom) { expenseConditions.push('date >= ?'); expenseParams.push(dateFrom) }
      if (dateTo) { expenseConditions.push('date <= ?'); expenseParams.push(dateTo) }
      const expenseWhere = expenseConditions.length > 0 ? `WHERE ${expenseConditions.join(' AND ')}` : ''

      const expenses = db
        .prepare(`SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses ${expenseWhere}`)
        .get(...expenseParams) as { total_expenses: number }

      const totalProfit = total_revenue - total_cost

      return {
        total_revenue,
        total_cost,
        total_profit: totalProfit,
        sale_count: gross.sale_count,
        total_expenses: expenses.total_expenses,
        net_profit: totalProfit - expenses.total_expenses
      }
    }
  )
}
