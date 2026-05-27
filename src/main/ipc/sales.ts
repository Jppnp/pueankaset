import { ipcMain } from 'electron'
import { getDb } from '../database'
import { insertStockMovement } from './stock-movements'

type DeliveryStatus = 'none' | 'waiting' | 'shipped'
type PaymentType = 'cash' | 'card' | 'transfer' | 'credit'

const DELIVERY_STATUSES: DeliveryStatus[] = ['none', 'waiting', 'shipped']
const PAYMENT_TYPES: PaymentType[] = ['cash', 'card', 'transfer', 'credit']
const CARD_FEE_SETTING_KEY = 'card_fee_percent'
const DEFAULT_CARD_FEE_PERCENT = 5

function toPositiveInteger(value: unknown): number | undefined {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : undefined

  return numeric !== undefined && Number.isInteger(numeric) && numeric > 0 ? numeric : undefined
}

export function requirePositiveQuantity(value: unknown, label = 'จำนวน'): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`${label}ต้องมากกว่า 0`)
  }
  if (!Number.isInteger(numeric)) {
    throw new Error(`${label}ต้องเป็นจำนวนเต็ม`)
  }
  return numeric
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeDeliveryStatus(value: unknown): DeliveryStatus {
  return DELIVERY_STATUSES.includes(value as DeliveryStatus) ? value as DeliveryStatus : 'none'
}

function normalizePaymentType(value: unknown): PaymentType {
  if (!PAYMENT_TYPES.includes(value as PaymentType)) {
    throw new Error('Invalid payment type')
  }
  return value as PaymentType
}

function toDeliveryStatusFilter(value: unknown): DeliveryStatus | undefined {
  return DELIVERY_STATUSES.includes(value as DeliveryStatus) ? value as DeliveryStatus : undefined
}

function toPaymentTypeFilters(value: unknown): PaymentType[] {
  const rawValues = Array.isArray(value) ? value : value ? [value] : []
  const paymentTypes = rawValues.filter((item): item is PaymentType =>
    PAYMENT_TYPES.includes(item as PaymentType)
  )
  return Array.from(new Set(paymentTypes))
}

function addInCondition(
  conditions: string[],
  params: unknown[],
  column: string,
  values: unknown[]
): void {
  if (values.length === 0) return
  conditions.push(`${column} IN (${values.map(() => '?').join(', ')})`)
  params.push(...values)
}

function getCardFeePercent(db: ReturnType<typeof getDb>): number {
  const row = db
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(CARD_FEE_SETTING_KEY) as { value: string } | undefined
  const percent = row?.value ? Number(row.value) : DEFAULT_CARD_FEE_PERCENT
  return Number.isFinite(percent) && percent >= 0 ? percent : DEFAULT_CARD_FEE_PERCENT
}

function calcCardFee(total: number, percent: number): number {
  return Math.ceil((total * (percent / 100)) / 10) * 10
}

function removeGeneratedCreditRemark(remark: string | null): string | null {
  if (!remark) return remark

  const remainingParts = remark
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part && !/^เชื่อ(?:\s*-\s*.+)?$/.test(part))

  return remainingParts.length > 0 ? remainingParts.join(' | ') : null
}

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
        paymentType?: PaymentType
        deliveryStatus?: DeliveryStatus
      }
    ) => {
      if (!['owner', 'employee'].includes(input.sellerRole)) {
        throw new Error('Invalid seller role')
      }

      const paymentType = input.paymentType ?? 'cash'
      if (!PAYMENT_TYPES.includes(paymentType)) {
        throw new Error('Invalid payment type')
      }

      const deliveryStatus = normalizeDeliveryStatus(input.deliveryStatus)

      if (paymentType === 'credit' && !input.customerId) {
        throw new Error('ต้องเลือกลูกค้าก่อนใช้การเชื่อ')
      }

      if (!Array.isArray(input.items) || input.items.length === 0) {
        throw new Error('ไม่มีรายการสินค้า')
      }
      for (const item of input.items) {
        requirePositiveQuantity(item.quantity, 'จำนวนสินค้า')
      }

      const db = getDb()

      if (input.customerId) {
        const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(input.customerId)
        if (!customer) throw new Error('ไม่พบลูกค้า')
      }

      const createSale = db.transaction(() => {
        const itemsTotal = Math.round(input.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100
        const total = Math.round((itemsTotal + (input.extraAmount ?? 0)) * 100) / 100

        const saleResult = db
          .prepare(
            `INSERT INTO sales (
              date, total_amount, remark, seller_role, customer_id, payment_type, delivery_status
            ) VALUES (datetime('now'), ?, ?, ?, ?, ?, ?)`
          )
          .run(total, input.remark ?? null, input.sellerRole, input.customerId ?? null, paymentType, deliveryStatus)

        const saleId = saleResult.lastInsertRowid as number

        const insertItem = db.prepare(
          `INSERT INTO sale_items (sale_id, product_id, quantity, price, cost_price) VALUES (?, ?, ?, ?, ?)`
        )
        const decrementStock = db.prepare(
          `UPDATE products SET stock_on_hand = stock_on_hand - ?, updated_at = datetime('now') WHERE id = ?`
        )

        const checkStock = db.prepare(
          `SELECT stock_on_hand, name, is_deleted FROM products WHERE id = ?`
        )

        for (const item of input.items) {
          const product = checkStock.get(item.product_id) as
            | { stock_on_hand: number; name: string; is_deleted: number }
            | undefined
          if (!product) {
            throw new Error(`ไม่พบสินค้า (id: ${item.product_id})`)
          }
          if (product.is_deleted) {
            throw new Error(`สินค้า "${product.name}" ไม่พร้อมขาย`)
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
    'sales:add-item',
    (
      _event,
      input: {
        saleId: number
        productId: number
        quantity: number
        sellerRole: 'owner' | 'employee'
      }
    ) => {
      if (!['owner', 'employee'].includes(input.sellerRole)) {
        throw new Error('Invalid seller role')
      }

      const saleId = toPositiveInteger(input.saleId)
      const productId = toPositiveInteger(input.productId)
      const quantity = toPositiveInteger(input.quantity)

      if (!saleId) throw new Error('Invalid sale id')
      if (!productId) throw new Error('Invalid product id')
      if (!quantity) throw new Error('จำนวนต้องมากกว่า 0')

      const db = getDb()

      const addItemToSale = db.transaction(() => {
        const sale = db.prepare('SELECT id, total_amount FROM sales WHERE id = ?').get(saleId) as
          | { id: number; total_amount: number }
          | undefined
        if (!sale) throw new Error('ไม่พบรายการขาย')

        const product = db
          .prepare('SELECT id, name, sale_price, cost_price, stock_on_hand, is_deleted FROM products WHERE id = ?')
          .get(productId) as
          | {
              id: number
              name: string
              sale_price: number
              cost_price: number
              stock_on_hand: number
              is_deleted: number
            }
          | undefined

        if (!product) throw new Error('ไม่พบสินค้า')
        if (product.is_deleted) {
          throw new Error(`สินค้า "${product.name}" ไม่พร้อมขาย`)
        }

        const lineTotal = roundMoney(product.sale_price * quantity)
        const updatedTotal = roundMoney(sale.total_amount + lineTotal)
        const stockAfter = product.stock_on_hand - quantity

        const existingItem = db
          .prepare(
            `SELECT si.id, si.quantity
             FROM sale_items si
             WHERE si.sale_id = ?
               AND si.product_id = ?
               AND si.price = ?
               AND si.cost_price = ?
               AND NOT EXISTS (
                 SELECT 1 FROM refund_items ri WHERE ri.sale_item_id = si.id
               )
             ORDER BY si.id DESC
             LIMIT 1`
          )
          .get(saleId, productId, product.sale_price, product.cost_price) as
          | { id: number; quantity: number }
          | undefined

        let saleItemId: number
        if (existingItem) {
          saleItemId = existingItem.id
          db.prepare('UPDATE sale_items SET quantity = ? WHERE id = ?')
            .run(existingItem.quantity + quantity, existingItem.id)
        } else {
          const itemResult = db
            .prepare('INSERT INTO sale_items (sale_id, product_id, quantity, price, cost_price) VALUES (?, ?, ?, ?, ?)')
            .run(saleId, productId, quantity, product.sale_price, product.cost_price)
          saleItemId = itemResult.lastInsertRowid as number
        }

        db.prepare('UPDATE sales SET total_amount = ? WHERE id = ?').run(updatedTotal, saleId)
        db.prepare("UPDATE products SET stock_on_hand = ?, updated_at = datetime('now') WHERE id = ?")
          .run(stockAfter, productId)

        insertStockMovement(db, {
          productId,
          type: 'out',
          quantity,
          stockBefore: product.stock_on_hand,
          stockAfter,
          reason: `เพิ่มสินค้าในใบเสร็จ #${saleId}`,
          referenceType: 'sale',
          referenceId: saleId,
          createdBy: input.sellerRole
        })

        return {
          saleId,
          saleItemId,
          productId,
          productName: product.name,
          quantity,
          lineTotal,
          total: updatedTotal
        }
      })

      return addItemToSale()
    }
  )

  ipcMain.handle(
    'sales:update-delivery-status',
    (_event, saleId: number, deliveryStatusInput: DeliveryStatus) => {
      const deliveryStatus = normalizeDeliveryStatus(deliveryStatusInput)
      if (!Number.isInteger(saleId) || saleId <= 0) {
        throw new Error('Invalid sale id')
      }

      const db = getDb()
      const result = db
        .prepare("UPDATE sales SET delivery_status = ? WHERE id = ?")
        .run(deliveryStatus, saleId)

      if (result.changes === 0) {
        throw new Error('ไม่พบรายการขาย')
      }

      return { success: true, deliveryStatus }
    }
  )

  ipcMain.handle(
    'sales:update-payment-type',
    (_event, saleId: number, paymentTypeInput: PaymentType) => {
      const paymentType = normalizePaymentType(paymentTypeInput)
      if (!Number.isInteger(saleId) || saleId <= 0) {
        throw new Error('Invalid sale id')
      }

      const db = getDb()
      const updatePaymentType = db.transaction(() => {
        const sale = db
          .prepare('SELECT id, customer_id, payment_type, remark FROM sales WHERE id = ?')
          .get(saleId) as
          | { id: number; customer_id: number | null; payment_type: PaymentType; remark: string | null }
          | undefined

        if (!sale) {
          throw new Error('ไม่พบรายการขาย')
        }
        if (paymentType === 'credit' && !sale.customer_id) {
          throw new Error('ต้องเลือกลูกค้าก่อนใช้การเชื่อ')
        }

        const itemTotalRow = db
          .prepare('SELECT COALESCE(SUM(price * quantity), 0) as total FROM sale_items WHERE sale_id = ?')
          .get(saleId) as { total: number }
        const itemsTotal = roundMoney(itemTotalRow.total)
        const cardFeeAmount = paymentType === 'card'
          ? roundMoney(calcCardFee(itemsTotal, getCardFeePercent(db)))
          : 0
        const totalAmount = roundMoney(itemsTotal + cardFeeAmount)
        const nextRemark = sale.payment_type === 'credit' && paymentType !== 'credit'
          ? removeGeneratedCreditRemark(sale.remark)
          : sale.remark

        db.prepare('UPDATE sales SET payment_type = ?, total_amount = ?, remark = ? WHERE id = ?')
          .run(paymentType, totalAmount, nextRemark, saleId)

        return {
          success: true,
          paymentType,
          totalAmount,
          itemsTotal,
          cardFeeAmount
        }
      })

      return updatePaymentType()
    }
  )

  ipcMain.handle(
    'sales:list',
    (
      _event,
      params: {
        page: number
        pageSize: number
        dateFrom?: string
        dateTo?: string
        storeId?: number
        customerId?: number
        itemId?: number | string
        deliveryStatus?: DeliveryStatus
        paymentType?: PaymentType
        paymentTypes?: PaymentType[]
      }
    ) => {
      const db = getDb()
      const { page, pageSize, dateFrom, dateTo, storeId, customerId } = params
      const itemId = toPositiveInteger(params.itemId)
      const deliveryStatus = toDeliveryStatusFilter(params.deliveryStatus)
      const paymentTypes = toPaymentTypeFilters(params.paymentTypes ?? params.paymentType)

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
      const itemConditions: string[] = []
      const itemParams: unknown[] = []
      if (storeId) {
        itemConditions.push('p.store_id = ?')
        itemParams.push(storeId)
      }
      if (itemId) {
        itemConditions.push('p.id = ?')
        itemParams.push(itemId)
      }
      if (itemConditions.length > 0) {
        conditions.push(
          `EXISTS (
            SELECT 1
            FROM sale_items si
            JOIN products p ON p.id = si.product_id
            WHERE si.sale_id = s.id AND ${itemConditions.join(' AND ')}
          )`
        )
        whereParams.push(...itemParams)
      }
      if (customerId) {
        conditions.push('s.customer_id = ?')
        whereParams.push(customerId)
      }
      if (deliveryStatus) {
        conditions.push('s.delivery_status = ?')
        whereParams.push(deliveryStatus)
      }
      addInCondition(conditions, whereParams, 's.payment_type', paymentTypes)

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const countResult = db
        .prepare(`SELECT COUNT(*) as total FROM sales s ${where}`)
        .get(...whereParams) as { total: number }

      const data = db
        .prepare(
          `SELECT s.*, c.name as customer_name,
            COALESCE((
              SELECT SUM(si.price * si.quantity)
              FROM sale_items si
              WHERE si.sale_id = s.id
            ), 0) as items_total,
            COALESCE((
              SELECT SUM(ri.price * ri.quantity)
              FROM refund_items ri
              JOIN refunds r ON r.id = ri.refund_id
              WHERE r.sale_id = s.id
            ), 0) as refunded_total,
            EXISTS (SELECT 1 FROM refunds r WHERE r.sale_id = s.id) as has_refund,
            EXISTS (SELECT 1 FROM exchanges e WHERE e.original_sale_id = s.id) as has_exchange,
            (
              SELECT GROUP_CONCAT(p.name, ', ')
              FROM sale_items si
              JOIN products p ON p.id = si.product_id
              WHERE si.sale_id = s.id
            ) as item_names
           FROM sales s
           LEFT JOIN customers c ON c.id = s.customer_id
           ${where} ORDER BY s.date DESC, s.id DESC LIMIT ? OFFSET ?`
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
        `SELECT si.*, p.name as product_name, p.description as product_description,
          COALESCE((SELECT SUM(ri.quantity) FROM refund_items ri WHERE ri.sale_item_id = si.id), 0) as refunded_qty
         FROM sale_items si
         JOIN products p ON p.id = si.product_id
         WHERE si.sale_id = ?`
      )
      .all(id) as { price: number; quantity: number }[]

    const itemsTotal = roundMoney(
      items.reduce((sum, item) => {
        return sum + item.price * item.quantity
      }, 0)
    )
    const totalAmount = (sale as { total_amount: number }).total_amount
    const cardFeeAmount = roundMoney(Math.max(0, totalAmount - itemsTotal))

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

    const refundedTotal = roundMoney(
      (
        db
          .prepare(
            `SELECT COALESCE(SUM(ri.quantity * ri.price), 0) as total
             FROM refund_items ri
             JOIN refunds r ON r.id = ri.refund_id
             WHERE r.sale_id = ?`
          )
          .get(id) as { total: number }
      ).total
    )

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

    return {
      ...sale,
      items_total: itemsTotal,
      card_fee_amount: cardFeeAmount,
      refunded_total: refundedTotal,
      items,
      refunds: refundsWithItems,
      exchanges: exchangesWithDetails
    }
  })

  ipcMain.handle('sales:delete', (_event, id: number) => {
    const db = getDb()

    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as
      | { id: number; customer_id: number | null; payment_type: string }
      | undefined
    if (!sale) {
      return { success: false, error: 'ไม่พบรายการขาย' }
    }

    // Sales tangled in an exchange share refunds and a generated sale, so deleting
    // one would orphan the other. Require the exchange be handled separately.
    const exchange = db
      .prepare('SELECT id FROM exchanges WHERE original_sale_id = ? OR new_sale_id = ? LIMIT 1')
      .get(id, id)
    if (exchange) {
      return {
        success: false,
        error: 'ไม่สามารถลบใบเสร็จที่มีการเปลี่ยนสินค้าได้'
      }
    }

    const doDelete = db.transaction(() => {
      const items = db
        .prepare(
          `SELECT si.id, si.product_id, si.quantity,
            COALESCE((SELECT SUM(ri.quantity) FROM refund_items ri WHERE ri.sale_item_id = si.id), 0) as refunded_qty
           FROM sale_items si WHERE si.sale_id = ?`
        )
        .all(id) as { id: number; product_id: number; quantity: number; refunded_qty: number }[]

      const restoreStock = db.prepare(
        "UPDATE products SET stock_on_hand = stock_on_hand + ?, updated_at = datetime('now') WHERE id = ?"
      )

      for (const item of items) {
        const netQty = item.quantity - item.refunded_qty
        if (netQty <= 0) continue
        const product = db
          .prepare('SELECT stock_on_hand FROM products WHERE id = ?')
          .get(item.product_id) as { stock_on_hand: number } | undefined
        if (!product) continue
        restoreStock.run(netQty, item.product_id)
        insertStockMovement(db, {
          productId: item.product_id,
          type: 'in',
          quantity: netQty,
          stockBefore: product.stock_on_hand,
          stockAfter: product.stock_on_hand + netQty,
          reason: `ลบใบเสร็จ #${id}`,
          referenceType: 'sale-delete',
          referenceId: id,
          createdBy: 'owner'
        })
      }

      // Undo debt adjustments that refunds created for a credit sale.
      const refunds = db.prepare('SELECT id FROM refunds WHERE sale_id = ?').all(id) as {
        id: number
      }[]
      if (sale.customer_id) {
        const deleteAdjustment = db.prepare(
          "DELETE FROM customer_payments WHERE customer_id = ? AND payment_kind = 'adjustment' AND note LIKE ?"
        )
        for (const refund of refunds) {
          deleteAdjustment.run(sale.customer_id, `%คืนสินค้า #${refund.id})%`)
        }
      }

      db.prepare(
        'DELETE FROM refund_items WHERE refund_id IN (SELECT id FROM refunds WHERE sale_id = ?)'
      ).run(id)
      db.prepare('DELETE FROM refunds WHERE sale_id = ?').run(id)
      db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id)
      db.prepare('DELETE FROM sales WHERE id = ?').run(id)

      return { success: true }
    })

    return doDelete()
  })

  ipcMain.handle(
    'sales:profit',
    (
      _event,
      dateFrom?: string,
      dateTo?: string,
      storeId?: number,
      itemIdInput?: number | string,
      deliveryStatusInput?: DeliveryStatus,
      paymentTypeInput?: PaymentType | PaymentType[]
    ) => {
      const db = getDb()
      const itemId = toPositiveInteger(itemIdInput)
      const deliveryStatus = toDeliveryStatusFilter(deliveryStatusInput)
      const paymentTypes = toPaymentTypeFilters(paymentTypeInput)

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
      if (itemId) {
        conditions.push('p.id = ?')
        whereParams.push(itemId)
      }
      if (deliveryStatus) {
        conditions.push('s.delivery_status = ?')
        whereParams.push(deliveryStatus)
      }
      addInCondition(conditions, whereParams, 's.payment_type', paymentTypes)

      const where = `WHERE ${conditions.join(' AND ')}`

      const gross = db
        .prepare(
          `SELECT
            COALESCE(SUM(si.price * si.quantity), 0) as total_revenue,
            COALESCE(SUM(si.cost_price * si.quantity), 0) as total_cost,
            COALESCE(SUM(CASE WHEN s.payment_type != 'credit' THEN si.price * si.quantity ELSE 0 END), 0) as total_paid_revenue,
            COALESCE(SUM(CASE WHEN s.payment_type = 'credit' THEN si.price * si.quantity ELSE 0 END), 0) as total_credit_revenue,
            COUNT(DISTINCT s.id) as sale_count
           FROM sales s
           JOIN sale_items si ON si.sale_id = s.id
           JOIN products p ON p.id = si.product_id
           ${where}`
        )
        .get(...whereParams) as {
          total_revenue: number
          total_cost: number
          total_paid_revenue: number
          total_credit_revenue: number
          sale_count: number
        }

      // Subtract refunded amounts
      const refundConditions: string[] = ['p.exclude_from_profit = 0']
      const refundParams: unknown[] = []
      if (dateFrom) { refundConditions.push('s.date >= ?'); refundParams.push(dateFrom) }
      if (dateTo) { refundConditions.push('s.date <= ?'); refundParams.push(dateTo) }
      if (storeId) { refundConditions.push('p.store_id = ?'); refundParams.push(storeId) }
      if (itemId) {
        refundConditions.push('p.id = ?')
        refundParams.push(itemId)
      }
      if (deliveryStatus) {
        refundConditions.push('s.delivery_status = ?')
        refundParams.push(deliveryStatus)
      }
      addInCondition(refundConditions, refundParams, 's.payment_type', paymentTypes)
      const refundWhere = `WHERE ${refundConditions.join(' AND ')}`

      const refunded = db
        .prepare(
          `SELECT
            COALESCE(SUM(ri.price * ri.quantity), 0) as refund_revenue,
            COALESCE(SUM(si.cost_price * ri.quantity), 0) as refund_cost,
            COALESCE(SUM(CASE WHEN s.payment_type != 'credit' THEN ri.price * ri.quantity ELSE 0 END), 0) as paid_refund_revenue,
            COALESCE(SUM(CASE WHEN s.payment_type = 'credit' THEN ri.price * ri.quantity ELSE 0 END), 0) as credit_refund_revenue
           FROM refund_items ri
           JOIN refunds r ON r.id = ri.refund_id
           JOIN sale_items si ON si.id = ri.sale_item_id
           JOIN sales s ON s.id = r.sale_id
           JOIN products p ON p.id = si.product_id
           ${refundWhere}`
        )
        .get(...refundParams) as {
          refund_revenue: number
          refund_cost: number
          paid_refund_revenue: number
          credit_refund_revenue: number
        }

      const total_revenue = roundMoney(gross.total_revenue - refunded.refund_revenue)
      const total_cost = roundMoney(gross.total_cost - refunded.refund_cost)
      const total_paid_revenue = roundMoney(gross.total_paid_revenue - refunded.paid_refund_revenue)
      const total_credit_revenue = roundMoney(gross.total_credit_revenue - refunded.credit_refund_revenue)

      // Expenses for the selected date range and store scope.
      const expenseConditions: string[] = []
      const expenseParams: unknown[] = []
      if (dateFrom) { expenseConditions.push('date >= ?'); expenseParams.push(dateFrom) }
      if (dateTo) { expenseConditions.push('date <= ?'); expenseParams.push(dateTo) }
      if (storeId) { expenseConditions.push('store_id = ?'); expenseParams.push(storeId) }
      const expenseWhere = expenseConditions.length > 0 ? `WHERE ${expenseConditions.join(' AND ')}` : ''

      const expenses = db
        .prepare(`SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses ${expenseWhere}`)
        .get(...expenseParams) as { total_expenses: number }

      let total_debt_payments = 0
      if (!storeId && !itemId && !deliveryStatus && paymentTypes.length === 0) {
        const paymentConditions: string[] = ["payment_kind = 'payment'"]
        const paymentParams: unknown[] = []
        if (dateFrom) { paymentConditions.push('date >= ?'); paymentParams.push(dateFrom) }
        if (dateTo) { paymentConditions.push('date <= ?'); paymentParams.push(dateTo) }
        const paymentWhere = `WHERE ${paymentConditions.join(' AND ')}`

        const debtPayments = db
          .prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments ${paymentWhere}`)
          .get(...paymentParams) as { total: number }
        total_debt_payments = roundMoney(debtPayments.total)
      }

      const totalProfit = roundMoney(total_revenue - total_cost)
      const total_received_amount = roundMoney(total_paid_revenue + total_debt_payments)

      return {
        total_revenue,
        total_paid_revenue,
        total_credit_revenue,
        total_debt_payments,
        total_received_amount,
        total_cost,
        total_profit: totalProfit,
        sale_count: gross.sale_count,
        total_expenses: expenses.total_expenses,
        net_profit: roundMoney(totalProfit - expenses.total_expenses)
      }
    }
  )
}
