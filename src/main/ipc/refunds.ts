import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerRefundHandlers(): void {
  ipcMain.handle(
    'refunds:create',
    (
      _event,
      input: {
        saleId: number
        items: { saleItemId: number; quantity: number }[]
        reason?: string
      }
    ) => {
      const db = getDb()

      const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(input.saleId) as
        | { id: number; customer_id: number | null; payment_type: string }
        | undefined
      if (!sale) throw new Error('ไม่พบรายการขาย')

      if (!input.items || input.items.length === 0) {
        throw new Error('กรุณาเลือกสินค้าที่ต้องการคืน')
      }

      const doRefund = db.transaction(() => {
        let totalAmount = 0

        // Validate all items first
        const validatedItems: {
          saleItemId: number
          productId: number
          quantity: number
          price: number
        }[] = []

        for (const item of input.items) {
          if (item.quantity <= 0) continue

          const saleItem = db
            .prepare('SELECT * FROM sale_items WHERE id = ? AND sale_id = ?')
            .get(item.saleItemId, input.saleId) as
            | { id: number; product_id: number; quantity: number; price: number }
            | undefined

          if (!saleItem) {
            throw new Error(`ไม่พบรายการสินค้า (id: ${item.saleItemId})`)
          }

          const refunded = db
            .prepare(
              'SELECT COALESCE(SUM(quantity), 0) as total FROM refund_items WHERE sale_item_id = ?'
            )
            .get(item.saleItemId) as { total: number }

          const available = saleItem.quantity - refunded.total
          if (item.quantity > available) {
            throw new Error(
              `จำนวนที่คืนเกินกว่าจำนวนที่เหลือ (เหลือ ${available} ชิ้น)`
            )
          }

          validatedItems.push({
            saleItemId: item.saleItemId,
            productId: saleItem.product_id,
            quantity: item.quantity,
            price: saleItem.price
          })

          totalAmount += item.quantity * saleItem.price
        }

        if (validatedItems.length === 0) {
          throw new Error('กรุณาเลือกสินค้าที่ต้องการคืน')
        }

        // Insert refund record
        const refundResult = db
          .prepare(
            'INSERT INTO refunds (sale_id, total_amount, reason) VALUES (?, ?, ?)'
          )
          .run(input.saleId, totalAmount, input.reason?.trim() || null)

        const refundId = refundResult.lastInsertRowid as number

        // Insert refund items and restore stock
        const insertRefundItem = db.prepare(
          'INSERT INTO refund_items (refund_id, sale_item_id, quantity, price) VALUES (?, ?, ?, ?)'
        )
        const restoreStock = db.prepare(
          "UPDATE products SET stock_on_hand = stock_on_hand + ?, updated_at = datetime('now') WHERE id = ?"
        )

        for (const item of validatedItems) {
          insertRefundItem.run(refundId, item.saleItemId, item.quantity, item.price)
          restoreStock.run(item.quantity, item.productId)
        }

        // If credit sale, create customer_payment to reduce debt
        if (sale.payment_type === 'credit' && sale.customer_id) {
          db.prepare(
            'INSERT INTO customer_payments (customer_id, amount, note) VALUES (?, ?, ?)'
          ).run(
            sale.customer_id,
            totalAmount,
            `คืนสินค้า (ใบเสร็จ #${input.saleId}, คืนสินค้า #${refundId})`
          )
        }

        return { refundId, totalAmount }
      })

      return doRefund()
    }
  )

  ipcMain.handle('refunds:list-by-sale', (_event, saleId: number) => {
    const db = getDb()

    const refunds = db
      .prepare('SELECT * FROM refunds WHERE sale_id = ? ORDER BY date DESC')
      .all(saleId) as { id: number; sale_id: number; date: string; total_amount: number; reason: string | null; created_at: string }[]

    const getItems = db.prepare(
      `SELECT ri.*, p.name as product_name
       FROM refund_items ri
       JOIN sale_items si ON si.id = ri.sale_item_id
       JOIN products p ON p.id = si.product_id
       WHERE ri.refund_id = ?`
    )

    return refunds.map((r) => ({
      ...r,
      items: getItems.all(r.id)
    }))
  })
}
