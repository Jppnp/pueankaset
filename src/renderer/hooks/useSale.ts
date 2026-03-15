import { useState, useCallback } from 'react'
import type { OrderItem, CreateSaleResult } from '../lib/types'

export function useSale() {
  const [items, setItems] = useState<OrderItem[]>([])

  const addItem = useCallback((product: {
    id: number
    name: string
    description: string | null
    sale_price: number
    cost_price: number
    stock_on_hand: number
  }) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          description: product.description,
          price: product.sale_price,
          cost_price: product.cost_price,
          quantity: 1,
          stock_on_hand: product.stock_on_hand
        }
      ]
    })
  }, [])

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.product_id !== productId))
    } else {
      setItems((prev) =>
        prev.map((i) =>
          i.product_id === productId ? { ...i, quantity } : i
        )
      )
    }
  }, [])

  const updatePrice = useCallback((productId: number, price: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.product_id === productId ? { ...i, price } : i
      )
    )
  }, [])

  const removeItem = useCallback((productId: number) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId))
  }, [])

  const clearItems = useCallback(() => setItems([]), [])

  const loadItems = useCallback((newItems: OrderItem[]) => {
    setItems(newItems)
  }, [])

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  const checkout = useCallback(
    async (remark?: string, extraAmount?: number): Promise<CreateSaleResult> => {
      const result = await window.api.createSale({
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          price: i.price,
          cost_price: i.cost_price
        })),
        remark,
        extraAmount
      })
      setItems([])
      return result
    },
    [items]
  )

  return {
    items,
    total,
    addItem,
    updateQuantity,
    updatePrice,
    removeItem,
    clearItems,
    loadItems,
    checkout
  }
}
