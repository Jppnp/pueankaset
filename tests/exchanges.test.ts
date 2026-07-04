import { describe, it, expect, beforeEach } from 'vitest'
import { invoke } from './mocks/electron'
import { freshDb, createProduct, createCustomer, getStock, countRows } from './helpers'
import { registerSaleHandlers } from '../src/main/ipc/sales'
import { registerExchangeHandlers } from '../src/main/ipc/exchanges'
import type { getDb } from '../src/main/database'

registerSaleHandlers()
registerExchangeHandlers()

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

describe('exchanges:create', () => {
  it('composes a refund and a new sale, moving stock both ways', () => {
    const oldProduct = createProduct(db, { name: 'ปุ๋ยเก่า', stock_on_hand: 50 })
    const newProduct = createProduct(db, { name: 'ปุ๋ยใหม่', sale_price: 150, stock_on_hand: 20 })
    const { saleId, saleItemId } = makeSale(oldProduct, 5)
    expect(getStock(db, oldProduct)).toBe(45)

    const result = invoke<{
      exchangeId: number
      refundId: number
      newSaleId: number
      returnTotal: number
      newTotal: number
      priceDifference: number
    }>('exchanges:create', {
      originalSaleId: saleId,
      returnItems: [{ saleItemId, quantity: 2 }],
      newItems: [{ product_id: newProduct, quantity: 1, price: 150, cost_price: 100 }],
      sellerRole: 'owner'
    })

    expect(result.returnTotal).toBe(200)
    expect(result.newTotal).toBe(150)
    expect(result.priceDifference).toBe(-50) // customer gets 50 back

    expect(getStock(db, oldProduct)).toBe(47) // 2 returned
    expect(getStock(db, newProduct)).toBe(19) // 1 sold as replacement
    expect(countRows(db, 'refunds')).toBe(1)
    expect(countRows(db, 'sales')).toBe(2) // original + replacement sale
    expect(countRows(db, 'exchanges')).toBe(1)

    const newSale = db
      .prepare('SELECT total_amount FROM sales WHERE id = ?')
      .get(result.newSaleId) as { total_amount: number }
    expect(newSale.total_amount).toBe(150)
  })

  it('rolls back the refund side too when the replacement item is unavailable', () => {
    const oldProduct = createProduct(db, { stock_on_hand: 50 })
    const deletedProduct = createProduct(db, { name: 'เลิกขาย', is_deleted: 1 })
    const { saleId, saleItemId } = makeSale(oldProduct, 5)

    expect(() =>
      invoke('exchanges:create', {
        originalSaleId: saleId,
        returnItems: [{ saleItemId, quantity: 2 }],
        newItems: [{ product_id: deletedProduct, quantity: 1, price: 100, cost_price: 80 }],
        sellerRole: 'owner'
      })
    ).toThrow(/ไม่พร้อมขาย/)

    // the already-processed return must be undone with the failed sale
    expect(getStock(db, oldProduct)).toBe(45)
    expect(countRows(db, 'refunds')).toBe(0)
    expect(countRows(db, 'refund_items')).toBe(0)
    expect(countRows(db, 'sales')).toBe(1) // only the original
    expect(countRows(db, 'exchanges')).toBe(0)
  })

  it('carries customer and payment type over to the replacement sale for credit sales', () => {
    const oldProduct = createProduct(db)
    const newProduct = createProduct(db, { name: 'ปุ๋ยใหม่' })
    const customerId = createCustomer(db)
    const { saleId, saleItemId } = makeSale(oldProduct, 5, {
      paymentType: 'credit',
      customerId
    })

    const result = invoke<{ newSaleId: number; returnTotal: number }>('exchanges:create', {
      originalSaleId: saleId,
      returnItems: [{ saleItemId, quantity: 1 }],
      newItems: [{ product_id: newProduct, quantity: 1, price: 100, cost_price: 80 }],
      sellerRole: 'employee'
    })

    const newSale = db
      .prepare('SELECT customer_id, payment_type FROM sales WHERE id = ?')
      .get(result.newSaleId) as { customer_id: number; payment_type: string }
    expect(newSale).toEqual({ customer_id: customerId, payment_type: 'credit' })

    // returned goods reduce the customer's debt
    const adjustment = db
      .prepare("SELECT amount FROM customer_payments WHERE payment_kind = 'adjustment'")
      .get() as { amount: number }
    expect(adjustment.amount).toBe(100)
  })

  it('requires both return items and new items', () => {
    const productId = createProduct(db)
    const { saleId, saleItemId } = makeSale(productId, 2)

    expect(() =>
      invoke('exchanges:create', {
        originalSaleId: saleId,
        returnItems: [],
        newItems: [{ product_id: productId, quantity: 1, price: 100, cost_price: 80 }],
        sellerRole: 'owner'
      })
    ).toThrow(/กรุณาเลือกสินค้าที่ต้องการคืน/)

    expect(() =>
      invoke('exchanges:create', {
        originalSaleId: saleId,
        returnItems: [{ saleItemId, quantity: 1 }],
        newItems: [],
        sellerRole: 'owner'
      })
    ).toThrow(/กรุณาเลือกสินค้าใหม่/)
  })
})
