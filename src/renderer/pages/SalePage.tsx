import React, { useState, useCallback, useEffect } from 'react'
import { SearchBar } from '../components/sale/SearchBar'
import { SearchResults } from '../components/sale/SearchResults'
import { OrderPanel } from '../components/sale/OrderPanel'
import { ParkedOrderBar } from '../components/sale/ParkedOrderBar'
import { CheckoutDialog } from '../components/sale/CheckoutDialog'
import { SaleNotification } from '../components/layout/SaleNotification'
import { useProductSearch } from '../hooks/useProducts'
import { useSale } from '../hooks/useSale'
import { useParkedOrders } from '../hooks/useParkedOrders'
import type { Product } from '../lib/types'

export function SalePage() {
  const [query, setQuery] = useState('')
  const [showCheckout, setShowCheckout] = useState(false)
  const [notification, setNotification] = useState<number | null>(null)

  const { results, loading, search, clear } = useProductSearch()
  const sale = useSale()
  const parked = useParkedOrders()

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query)
    }, 200)
    return () => clearTimeout(timer)
  }, [query, search])

  const handleSelect = useCallback(
    (product: Product) => {
      sale.addItem(product)
    },
    [sale]
  )

  const handleClearSearch = useCallback(() => {
    setQuery('')
    clear()
  }, [clear])

  const handlePark = useCallback(async () => {
    if (sale.items.length === 0) return
    await parked.parkOrder(null, sale.items)
    sale.clearItems()
  }, [sale, parked])

  const handleLoadParked = useCallback(
    async (id: number) => {
      // If current order has items, park them first
      if (sale.items.length > 0) {
        await parked.parkOrder(null, sale.items)
      }
      const items = await parked.loadParkedOrder(id)
      sale.loadItems(items)
    },
    [sale, parked]
  )

  const handleCheckout = useCallback(
    async (options: { remark?: string; print: boolean; cardFee?: number }) => {
      const result = await sale.checkout(options.remark, options.cardFee)
      setShowCheckout(false)
      setNotification(result.total)

      if (options.print) {
        await window.api.printReceipt(result.saleId)
      }
    },
    [sale]
  )

  return (
    <div className="flex flex-col h-full">
      <ParkedOrderBar
        orders={parked.parkedOrders}
        onLoad={handleLoadParked}
        onDelete={parked.deleteParkedOrder}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Search */}
        <div className="flex-1 flex flex-col border-r">
          <div className="p-4">
            <SearchBar value={query} onChange={setQuery} onClear={handleClearSearch} />
          </div>
          <SearchResults
            results={results}
            loading={loading}
            onSelect={handleSelect}
            query={query}
          />
        </div>

        {/* Right panel - Order */}
        <div className="w-96 flex flex-col shrink-0">
          <OrderPanel
            items={sale.items}
            total={sale.total}
            onUpdateQuantity={sale.updateQuantity}
            onUpdatePrice={sale.updatePrice}
            onRemove={sale.removeItem}
            onCheckout={() => setShowCheckout(true)}
            onPark={handlePark}
          />
        </div>
      </div>

      <CheckoutDialog
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        items={sale.items}
        total={sale.total}
        onConfirm={handleCheckout}
      />

      <SaleNotification total={notification} onDismiss={() => setNotification(null)} />
    </div>
  )
}
