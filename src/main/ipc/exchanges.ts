import { ipcMain } from 'electron'
import { getDb } from '../database'
import { insertStockMovement } from './stock-movements'

export function registerExchangeHandlers(): void {
  ipcMain.handle(
    'exchanges:create',
    (
      _event,
      input: {
        originalSaleId: number
        returnItems: { saleItemId: number; quantity: number }[]
        newItems: { product_id: number; quantity: number; price: number; cost_price: number }[]
        reason?: string
        sellerRole: 'owner' | 'employee'
      }
    ) => {
      const db = getDb()

      const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(input.originalSaleId) as
        | { id: number; customer_id: number | null; payment_type: string; seller_role: string }
        | undefined
      if (!sale) throw new Error('ไม่พบรายการขาย')

      if (!input.returnItems?.length) throw new Error('กรุณาเลือกสินค้าที่ต้องการคืน')
      if (!input.newItems?.length) throw new Error('กรุณาเลือกสินค้าใหม่')

      const doExchange = db.transaction(() => {
        // === REFUND SIDE: validate and process returned items ===
        let returnTotal = 0
        const validatedReturns: {
          saleItemId: number
          productId: number
          quantity: number
          price: number
        }[] = []

        for (const item of input.returnItems) {
          if (item.quantity <= 0) continue

          const saleItem = db
            .prepare('SELECT * FROM sale_items WHERE id = ? AND sale_id = ?')
            .get(item.saleItemId, input.originalSaleId) as
            | { id: number; product_id: number; quantity: number; price: number }
            | undefined
          if (!saleItem) throw new Error(`ไม่พบรายการสินค้า (id: ${item.saleItemId})`)

          const refunded = db
            .prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM refund_items WHERE sale_item_id = ?')
            .get(item.saleItemId) as { total: number }

          const available = saleItem.quantity - refunded.total
          if (item.quantity > available) {
            throw new Error(`จำนวนที่คืนเกินกว่าจำนวนที่เหลือ (เหลือ ${available} ชิ้น)`)
          }

          validatedReturns.push({
            saleItemId: item.saleItemId,
            productId: saleItem.product_id,
            quantity: item.quantity,
            price: saleItem.price
          })
          returnTotal += item.quantity * saleItem.price
        }

        if (validatedReturns.length === 0) throw new Error('กรุณาเลือกสินค้าที่ต้องการคืน')

        // Create refund record
        const refundResult = db
          .prepare('INSERT INTO refunds (sale_id, total_amount, reason) VALUES (?, ?, ?)')
          .run(input.originalSaleId, returnTotal, `เปลี่ยนสินค้า${input.reason ? ': ' + input.reason.trim() : ''}`)

        const refundId = refundResult.lastInsertRowid as number

        const insertRefundItem = db.prepare(
          'INSERT INTO refund_items (refund_id, sale_item_id, quantity, price) VALUES (?, ?, ?, ?)'
        )
        const restoreStock = db.prepare(
          "UPDATE products SET stock_on_hand = stock_on_hand + ?, updated_at = datetime('now') WHERE id = ?"
        )

        for (const item of validatedReturns) {
          const currentProduct = db.prepare('SELECT stock_on_hand FROM products WHERE id = ?').get(item.productId) as { stock_on_hand: number }
          insertRefundItem.run(refundId, item.saleItemId, item.quantity, item.price)
          restoreStock.run(item.quantity, item.productId)
          insertStockMovement(db, {
            productId: item.productId,
            type: 'in',
            quantity: item.quantity,
            stockBefore: currentProduct.stock_on_hand,
            stockAfter: currentProduct.stock_on_hand + item.quantity,
            reason: `เปลี่ยนสินค้า - คืน (ใบเสร็จ #${input.originalSaleId})`,
            referenceType: 'exchange',
            createdBy: input.sellerRole
          })
        }

        // If credit sale, refund side reduces debt
        if (sale.payment_type === 'credit' && sale.customer_id) {
          db.prepare('INSERT INTO customer_payments (customer_id, amount, note) VALUES (?, ?, ?)').run(
            sale.customer_id,
            returnTotal,
            `เปลี่ยนสินค้า - คืน (ใบเสร็จ #${input.originalSaleId})`
          )
        }

        // === NEW SALE SIDE: validate stock and create new sale ===
        const newItemsTotal = input.newItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

        const newSaleResult = db
          .prepare(
            "INSERT INTO sales (date, total_amount, remark, seller_role, customer_id, payment_type) VALUES (datetime('now'), ?, ?, ?, ?, ?)"
          )
          .run(
            newItemsTotal,
            `เปลี่ยนสินค้า (จากใบเสร็จ #${input.originalSaleId})`,
            input.sellerRole,
            sale.customer_id,
            sale.payment_type
          )

        const newSaleId = newSaleResult.lastInsertRowid as number

        const insertSaleItem = db.prepare(
          'INSERT INTO sale_items (sale_id, product_id, quantity, price, cost_price) VALUES (?, ?, ?, ?, ?)'
        )
        const decrementStock = db.prepare(
          "UPDATE products SET stock_on_hand = stock_on_hand - ?, updated_at = datetime('now') WHERE id = ?"
        )
        const checkStock = db.prepare('SELECT stock_on_hand, name FROM products WHERE id = ?')

        for (const item of input.newItems) {
          const product = checkStock.get(item.product_id) as
            | { stock_on_hand: number; name: string }
            | undefined
          if (!product) throw new Error(`ไม่พบสินค้า (id: ${item.product_id})`)
          if (product.stock_on_hand < item.quantity) {
            throw new Error(
              `สินค้า "${product.name}" มีสต็อกไม่เพียงพอ (คงเหลือ ${product.stock_on_hand} ต้องการ ${item.quantity})`
            )
          }
          insertSaleItem.run(newSaleId, item.product_id, item.quantity, item.price, item.cost_price)
          decrementStock.run(item.quantity, item.product_id)
          insertStockMovement(db, {
            productId: item.product_id,
            type: 'out',
            quantity: item.quantity,
            stockBefore: product.stock_on_hand,
            stockAfter: product.stock_on_hand - item.quantity,
            reason: `เปลี่ยนสินค้า - รับใหม่ (ใบเสร็จ #${input.originalSaleId})`,
            referenceType: 'exchange',
            createdBy: input.sellerRole
          })
        }

        // === EXCHANGE RECORD ===
        const priceDifference = newItemsTotal - returnTotal

        const exchangeResult = db
          .prepare(
            'INSERT INTO exchanges (original_sale_id, refund_id, new_sale_id, price_difference, reason) VALUES (?, ?, ?, ?, ?)'
          )
          .run(input.originalSaleId, refundId, newSaleId, priceDifference, input.reason?.trim() || null)

        const exchangeId = exchangeResult.lastInsertRowid as number

        return {
          exchangeId,
          refundId,
          newSaleId,
          returnTotal,
          newTotal: newItemsTotal,
          priceDifference
        }
      })

      return doExchange()
    }
  )

  ipcMain.handle('exchanges:list-by-sale', (_event, saleId: number) => {
    const db = getDb()

    const exchanges = db
      .prepare(
        `SELECT e.*
         FROM exchanges e
         WHERE e.original_sale_id = ?
         ORDER BY e.date DESC`
      )
      .all(saleId) as {
      id: number
      original_sale_id: number
      refund_id: number
      new_sale_id: number
      price_difference: number
      date: string
      reason: string | null
    }[]

    const getRefundItems = db.prepare(
      `SELECT ri.*, p.name as product_name
       FROM refund_items ri
       JOIN sale_items si ON si.id = ri.sale_item_id
       JOIN products p ON p.id = si.product_id
       WHERE ri.refund_id = ?`
    )

    const getNewSaleItems = db.prepare(
      `SELECT si.*, p.name as product_name
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = ?`
    )

    return exchanges.map((e) => ({
      ...e,
      returnItems: getRefundItems.all(e.refund_id),
      newItems: getNewSaleItems.all(e.new_sale_id)
    }))
  })
}
