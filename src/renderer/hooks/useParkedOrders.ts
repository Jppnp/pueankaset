import { useState, useEffect, useCallback } from 'react'
import type { ParkedOrder, OrderItem } from '../lib/types'

export function useParkedOrders() {
  const [parkedOrders, setParkedOrders] = useState<ParkedOrder[]>([])

  const fetchParkedOrders = useCallback(async () => {
    const result = await window.api.getParkedOrders()
    setParkedOrders(result)
  }, [])

  useEffect(() => {
    fetchParkedOrders()
  }, [fetchParkedOrders])

  const parkOrder = useCallback(
    async (label: string | null, items: OrderItem[]) => {
      if (items.length === 0) return
      await window.api.parkOrder(label, items)
      await fetchParkedOrders()
    },
    [fetchParkedOrders]
  )

  const loadParkedOrder = useCallback(
    async (id: number): Promise<OrderItem[]> => {
      const orders = await window.api.getParkedOrders()
      const order = orders.find((o: ParkedOrder) => o.id === id)
      if (!order) return []
      const items = JSON.parse(order.items_json) as OrderItem[]
      await window.api.deleteParkedOrder(id)
      await fetchParkedOrders()
      return items
    },
    [fetchParkedOrders]
  )

  const deleteParkedOrder = useCallback(
    async (id: number) => {
      await window.api.deleteParkedOrder(id)
      await fetchParkedOrders()
    },
    [fetchParkedOrders]
  )

  return {
    parkedOrders,
    parkOrder,
    loadParkedOrder,
    deleteParkedOrder,
    refetch: fetchParkedOrders
  }
}
