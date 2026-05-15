import React, { useState, useCallback, useEffect, useRef } from 'react'
import { SearchBar } from '../components/sale/SearchBar'
import { SearchResults } from '../components/sale/SearchResults'
import { OrderPanel } from '../components/sale/OrderPanel'
import { ParkedOrderBar } from '../components/sale/ParkedOrderBar'
import { CheckoutDialog } from '../components/sale/CheckoutDialog'
import { CustomerSelector } from '../components/sale/CustomerSelector'
import { LatestSaleOrder } from '../components/sale/LatestSaleOrder'
import { SaleNotification } from '../components/layout/SaleNotification'
import { useProductSearch } from '../hooks/useProducts'
import { useSale } from '../hooks/useSale'
import { useParkedOrders } from '../hooks/useParkedOrders'
import { useRole } from '../contexts/RoleContext'
import type { Product, Customer, PaymentType, SaleWithItems } from '../lib/types'

export function SalePage() {
  const [query, setQuery] = useState('')
  const [showCheckout, setShowCheckout] = useState(false)
  const [notification, setNotification] = useState<number | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [focusedResultIndex, setFocusedResultIndex] = useState<number | null>(null)
  const [latestSale, setLatestSale] = useState<SaleWithItems | null>(null)
  const [latestSaleLoading, setLatestSaleLoading] = useState(true)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { results, loading, search, clear } = useProductSearch()
  const sale = useSale()
  const parked = useParkedOrders()
  const { role, isOwner } = useRole()

  const fetchLatestSale = useCallback(async () => {
    setLatestSaleLoading(true)
    try {
      const result = await window.api.getSales({ page: 1, pageSize: 1 })
      const newestSale = result.data[0]
      if (!newestSale) {
        setLatestSale(null)
        return
      }

      const detail = await window.api.getSaleDetail(newestSale.id)
      setLatestSale(detail)
    } catch (err) {
      console.error('Failed to load latest sale', err)
      setLatestSale(null)
    } finally {
      setLatestSaleLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchLatestSale()
  }, [fetchLatestSale])

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query)
    }, 200)
    return () => clearTimeout(timer)
  }, [query, search])

  useEffect(() => {
    setFocusedResultIndex(null)
  }, [query])

  useEffect(() => {
    if (focusedResultIndex !== null && focusedResultIndex >= results.length) {
      setFocusedResultIndex(results.length > 0 ? results.length - 1 : null)
    }
  }, [focusedResultIndex, results.length])

  const handleSelect = useCallback(
    (product: Product) => {
      sale.addItem(product)
      setQuery('')
      clear()
      setFocusedResultIndex(null)
      requestAnimationFrame(() => searchInputRef.current?.focus())
    },
    [sale, clear]
  )

  const handleClearSearch = useCallback(() => {
    setQuery('')
    clear()
    setFocusedResultIndex(null)
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [clear])

  const handleFocusFirstResult = useCallback(() => {
    if (!query.trim() || loading || results.length === 0) return false
    setFocusedResultIndex(0)
    return true
  }, [loading, query, results.length])

  const handleFocusSearch = useCallback(() => {
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [])

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

  const handlePrint = useCallback(async (saleId: number) => {
    const printResult = await window.api.printReceipt(saleId)
    if (!printResult.success) {
      alert(`พิมพ์ไม่สำเร็จ: ${printResult.error}`)
    }
  }, [])

  const handleCheckout = useCallback(
    async (options: {
      remark?: string
      print: boolean
      cardFee?: number
      paymentType: PaymentType
      customerId?: number
    }) => {
      try {
        const result = await sale.checkout(
          options.remark,
          options.cardFee,
          role ?? 'owner',
          options.customerId,
          options.paymentType
        )
        setShowCheckout(false)
        setNotification(result.total)
        setSelectedCustomer(null)
        window.api
          .getSaleDetail(result.saleId)
          .then((detail) => {
            if (detail) setLatestSale(detail)
          })
          .catch(() => {
            void fetchLatestSale()
          })

        if (options.print) {
          await handlePrint(result.saleId)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
        alert(`เกิดข้อผิดพลาดในการบันทึกการขาย: ${message}`)
      }
    },
    [sale, role, fetchLatestSale, handlePrint]
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ParkedOrderBar
        orders={parked.parkedOrders}
        onLoad={handleLoadParked}
        onDelete={parked.deleteParkedOrder}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left panel - Search */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r">
          <div className="shrink-0 p-4">
            <SearchBar
              ref={searchInputRef}
              value={query}
              onChange={setQuery}
              onClear={handleClearSearch}
              onFocusResults={handleFocusFirstResult}
            />
          </div>
          {!query.trim() && (
            <div className="shrink-0 px-4 pb-3">
              <LatestSaleOrder
                sale={latestSale}
                loading={latestSaleLoading}
                onPrint={handlePrint}
                onRefresh={fetchLatestSale}
              />
            </div>
          )}
          <SearchResults
            results={results}
            loading={loading}
            onSelect={handleSelect}
            query={query}
            focusedIndex={focusedResultIndex}
            onFocusedIndexChange={setFocusedResultIndex}
            onFocusSearch={handleFocusSearch}
          />
        </div>

        {/* Right panel - Order */}
        <div className="flex min-h-0 w-96 shrink-0 flex-col">
          <div className="shrink-0 px-4 pt-3 pb-2 border-b">
            <CustomerSelector
              selectedCustomer={selectedCustomer}
              onSelect={setSelectedCustomer}
              canCreate={isOwner}
            />
          </div>
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
        selectedCustomer={selectedCustomer}
        onConfirm={handleCheckout}
      />

      <SaleNotification total={notification} onDismiss={() => setNotification(null)} />
    </div>
  )
}
