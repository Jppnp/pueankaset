import { describe, it, expect, beforeEach } from 'vitest'
import { invoke } from './mocks/electron'
import { freshDb, createProduct, createCustomer, getStock, countRows } from './helpers'
import { registerSaleHandlers } from '../src/main/ipc/sales'
import { registerRefundHandlers } from '../src/main/ipc/refunds'
import type { getDb } from '../src/main/database'

registerSaleHandlers()
registerRefundHandlers()

let db: ReturnType<typeof getDb>

beforeEach(() => {
  db = freshDb()
})

function makeSale(
  productId: number,
  quantity: number,
  extra: Record<string, unknown> = {}
): { saleId: number; saleItemId: number } {
  const { saleId } = invoke<{ saleId: number }>('sales:create', {
    items: [{ product_id: productId, quantity, price: 100, cost_price: 80 }],
    sellerRole: 'owner',
    ...extra
  })
  const item = db.prepare('SELECT id FROM sale_items WHERE sale_id = ?').get(saleId) as {
    id: number
  }
  return { saleId, saleItemId: item.id }
}

describe('refunds:create', () => {
  it('restores stock and records the refund', () => {
    const productId = createProduct(db, { stock_on_hand: 50 })
    const { saleId, saleItemId } = makeSale(productId, 5)
    expect(getStock(db, productId)).toBe(45)

    const result = invoke<{ refundId: number; totalAmount: number }>('refunds:create', {
      saleId,
      items: [{ saleItemId, quantity: 2 }]
    })

    expect(result.totalAmount).toBe(200)
    expect(getStock(db, productId)).toBe(47)
    expect(countRows(db, 'refunds')).toBe(1)
    expect(countRows(db, 'refund_items')).toBe(1)
  })

  it('never refunds more than what remains after earlier refunds', () => {
    const productId = createProduct(db, { stock_on_hand: 50 })
    const { saleId, saleItemId } = makeSale(productId, 5)

    invoke('refunds:create', { saleId, items: [{ saleItemId, quantity: 3 }] })

    expect(() =>
      invoke('refunds:create', { saleId, items: [{ saleItemId, quantity: 3 }] })
    ).toThrow(/เหลือ 2 ชิ้น/)

    // failed attempt must not touch stock or add rows
    expect(getStock(db, productId)).toBe(48)
    expect(countRows(db, 'refunds')).toBe(1)
  })

  it('reduces customer debt when refunding a credit sale', () => {
    const productId = createProduct(db)
    const customerId = createCustomer(db)
    const { saleId, saleItemId } = makeSale(productId, 5, {
      paymentType: 'credit',
      customerId
    })

    invoke('refunds:create', { saleId, items: [{ saleItemId, quantity: 2 }] })

    const adjustment = db
      .prepare(
        "SELECT amount, payment_kind FROM customer_payments WHERE customer_id = ? AND payment_kind = 'adjustment'"
      )
      .get(customerId) as { amount: number; payment_kind: string }
    expect(adjustment.amount).toBe(200)
  })

  it('does not create debt adjustments for cash sales', () => {
    const productId = createProduct(db)
    const { saleId, saleItemId } = makeSale(productId, 5)

    invoke('refunds:create', { saleId, items: [{ saleItemId, quantity: 1 }] })

    expect(countRows(db, 'customer_payments')).toBe(0)
  })

  it('rejects unknown sales, empty item lists, and bad quantities', () => {
    const productId = createProduct(db)
    const { saleId, saleItemId } = makeSale(productId, 5)

    expect(() => invoke('refunds:create', { saleId: 9999, items: [{ saleItemId, quantity: 1 }] }))
      .toThrow(/ไม่พบรายการขาย/)
    expect(() => invoke('refunds:create', { saleId, items: [] })).toThrow(/กรุณาเลือกสินค้า/)
    expect(() =>
      invoke('refunds:create', { saleId, items: [{ saleItemId, quantity: 0 }] })
    ).toThrow(/มากกว่า 0/)
    expect(() =>
      invoke('refunds:create', { saleId, items: [{ saleItemId: 12345, quantity: 1 }] })
    ).toThrow(/ไม่พบรายการสินค้า/)
  })
})
