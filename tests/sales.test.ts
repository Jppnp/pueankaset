import { describe, it, expect, beforeEach } from 'vitest'
import { invoke } from './mocks/electron'
import { freshDb, createProduct, createCustomer, getStock, countRows } from './helpers'
import { registerSaleHandlers } from '../src/main/ipc/sales'
import type { getDb } from '../src/main/database'

registerSaleHandlers()

let db: ReturnType<typeof getDb>

beforeEach(() => {
  db = freshDb()
})

function saleInput(overrides: Record<string, unknown> = {}) {
  return {
    items: [] as { product_id: number; quantity: number; price: number; cost_price: number }[],
    sellerRole: 'owner' as const,
    ...overrides
  }
}

describe('sales:create', () => {
  it('inserts the sale and items and decrements stock atomically', () => {
    const productId = createProduct(db, { sale_price: 100, stock_on_hand: 50 })

    const result = invoke<{ saleId: number; total: number }>(
      'sales:create',
      saleInput({ items: [{ product_id: productId, quantity: 3, price: 100, cost_price: 80 }] })
    )

    expect(result.total).toBe(300)
    expect(getStock(db, productId)).toBe(47)
    expect(countRows(db, 'sales')).toBe(1)
    expect(countRows(db, 'sale_items')).toBe(1)
  })

  it('adds extraAmount (card fee) on top of the item total', () => {
    const productId = createProduct(db)

    const result = invoke<{ total: number }>(
      'sales:create',
      saleInput({
        items: [{ product_id: productId, quantity: 10, price: 100, cost_price: 80 }],
        extraAmount: 50
      })
    )

    expect(result.total).toBe(1050)
  })

  it('rolls back the whole sale when any product is soft-deleted', () => {
    const okId = createProduct(db, { stock_on_hand: 50 })
    const deletedId = createProduct(db, { name: 'ยกเลิกขายแล้ว', is_deleted: 1 })

    expect(() =>
      invoke(
        'sales:create',
        saleInput({
          items: [
            { product_id: okId, quantity: 5, price: 100, cost_price: 80 },
            { product_id: deletedId, quantity: 1, price: 100, cost_price: 80 }
          ]
        })
      )
    ).toThrow(/ไม่พร้อมขาย/)

    // first item's stock decrement and the sale row must both be rolled back
    expect(getStock(db, okId)).toBe(50)
    expect(countRows(db, 'sales')).toBe(0)
    expect(countRows(db, 'sale_items')).toBe(0)
  })

  it('rolls back when a product id does not exist', () => {
    const okId = createProduct(db, { stock_on_hand: 50 })

    expect(() =>
      invoke(
        'sales:create',
        saleInput({
          items: [
            { product_id: okId, quantity: 5, price: 100, cost_price: 80 },
            { product_id: 99999, quantity: 1, price: 100, cost_price: 80 }
          ]
        })
      )
    ).toThrow(/ไม่พบสินค้า/)

    expect(getStock(db, okId)).toBe(50)
    expect(countRows(db, 'sales')).toBe(0)
  })

  it('rejects empty carts, bad quantities, and bad roles', () => {
    const productId = createProduct(db)
    const item = { product_id: productId, quantity: 1, price: 100, cost_price: 80 }

    expect(() => invoke('sales:create', saleInput())).toThrow(/ไม่มีรายการสินค้า/)
    expect(() =>
      invoke('sales:create', saleInput({ items: [{ ...item, quantity: 0 }] }))
    ).toThrow(/มากกว่า 0/)
    expect(() =>
      invoke('sales:create', saleInput({ items: [{ ...item, quantity: -2 }] }))
    ).toThrow(/มากกว่า 0/)
    expect(() =>
      invoke('sales:create', saleInput({ items: [{ ...item, quantity: 1.5 }] }))
    ).toThrow(/จำนวนเต็ม/)
    expect(() =>
      invoke('sales:create', saleInput({ items: [item], sellerRole: 'admin' }))
    ).toThrow(/Invalid seller role/)
  })

  it('requires a customer for credit sales and validates the customer exists', () => {
    const productId = createProduct(db)
    const item = { product_id: productId, quantity: 1, price: 100, cost_price: 80 }

    expect(() =>
      invoke('sales:create', saleInput({ items: [item], paymentType: 'credit' }))
    ).toThrow(/ต้องเลือกลูกค้า/)

    expect(() =>
      invoke('sales:create', saleInput({ items: [item], paymentType: 'credit', customerId: 4242 }))
    ).toThrow(/ไม่พบลูกค้า/)

    const customerId = createCustomer(db)
    const result = invoke<{ saleId: number }>(
      'sales:create',
      saleInput({ items: [item], paymentType: 'credit', customerId })
    )
    const sale = db.prepare('SELECT payment_type, customer_id FROM sales WHERE id = ?').get(result.saleId) as {
      payment_type: string
      customer_id: number
    }
    expect(sale).toEqual({ payment_type: 'credit', customer_id: customerId })
  })
})

describe('sales:add-item', () => {
  it('merges quantity into an existing matching line and updates totals and stock', () => {
    const productId = createProduct(db, { sale_price: 100, cost_price: 80, stock_on_hand: 50 })
    const { saleId } = invoke<{ saleId: number }>(
      'sales:create',
      saleInput({ items: [{ product_id: productId, quantity: 2, price: 100, cost_price: 80 }] })
    )

    const result = invoke<{ total: number; quantity: number }>('sales:add-item', {
      saleId,
      productId,
      quantity: 3,
      sellerRole: 'owner'
    })

    expect(result.total).toBe(500)
    expect(countRows(db, 'sale_items')).toBe(1) // merged, not a second line
    const line = db.prepare('SELECT quantity FROM sale_items WHERE sale_id = ?').get(saleId) as {
      quantity: number
    }
    expect(line.quantity).toBe(5)
    expect(getStock(db, productId)).toBe(45)
  })

  it('rejects deleted products and unknown sales', () => {
    const deletedId = createProduct(db, { is_deleted: 1 })
    const okId = createProduct(db)
    const { saleId } = invoke<{ saleId: number }>(
      'sales:create',
      saleInput({ items: [{ product_id: okId, quantity: 1, price: 100, cost_price: 80 }] })
    )

    expect(() =>
      invoke('sales:add-item', { saleId, productId: deletedId, quantity: 1, sellerRole: 'owner' })
    ).toThrow(/ไม่พร้อมขาย/)
    expect(() =>
      invoke('sales:add-item', { saleId: 9999, productId: okId, quantity: 1, sellerRole: 'owner' })
    ).toThrow(/ไม่พบรายการขาย/)
  })
})

describe('sales:update-payment-type', () => {
  it('recomputes the total with the card fee when switching to card', () => {
    const productId = createProduct(db, { sale_price: 100 })
    const { saleId } = invoke<{ saleId: number }>(
      'sales:create',
      saleInput({ items: [{ product_id: productId, quantity: 10, price: 100, cost_price: 80 }] })
    )

    // default fee 5% of 1000 = 50, rounded up to nearest 10
    const result = invoke<{ totalAmount: number; cardFeeAmount: number }>(
      'sales:update-payment-type',
      saleId,
      'card'
    )
    expect(result.cardFeeAmount).toBe(50)
    expect(result.totalAmount).toBe(1050)

    // switching back to cash drops the fee
    const back = invoke<{ totalAmount: number; cardFeeAmount: number }>(
      'sales:update-payment-type',
      saleId,
      'cash'
    )
    expect(back.cardFeeAmount).toBe(0)
    expect(back.totalAmount).toBe(1000)
  })

  it('refuses credit for a sale without a customer', () => {
    const productId = createProduct(db)
    const { saleId } = invoke<{ saleId: number }>(
      'sales:create',
      saleInput({ items: [{ product_id: productId, quantity: 1, price: 100, cost_price: 80 }] })
    )

    expect(() => invoke('sales:update-payment-type', saleId, 'credit')).toThrow(/ต้องเลือกลูกค้า/)
    expect(() => invoke('sales:update-payment-type', saleId, 'bitcoin')).toThrow(/Invalid payment type/)
  })
})

describe('sales:delete', () => {
  it('restores stock and removes the sale, its items, and its refunds', () => {
    const productId = createProduct(db, { stock_on_hand: 50 })
    const { saleId } = invoke<{ saleId: number }>(
      'sales:create',
      saleInput({ items: [{ product_id: productId, quantity: 5, price: 100, cost_price: 80 }] })
    )
    expect(getStock(db, productId)).toBe(45)

    const result = invoke<{ success: boolean }>('sales:delete', saleId)

    expect(result.success).toBe(true)
    expect(getStock(db, productId)).toBe(50)
    expect(countRows(db, 'sales')).toBe(0)
    expect(countRows(db, 'sale_items')).toBe(0)
  })

  it('returns an error for an unknown sale', () => {
    const result = invoke<{ success: boolean; error?: string }>('sales:delete', 777)
    expect(result.success).toBe(false)
  })
})
