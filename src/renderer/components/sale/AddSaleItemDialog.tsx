import React, { useEffect, useMemo, useState } from 'react'
import { Modal } from '../shared/Modal'
import { formatBaht } from '../../lib/format'
import { useRole } from '../../contexts/RoleContext'
import type { AddSaleItemResult, Product, SaleWithItems } from '../../lib/types'

interface AddSaleItemDialogProps {
  open: boolean
  sale: SaleWithItems | null
  onClose: () => void
  onSuccess: (result: AddSaleItemResult) => void
}

export function AddSaleItemDialog({ open, sale, onClose, onSuccess }: AddSaleItemDialogProps) {
  const { role } = useRole()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantityInput, setQuantityInput] = useState('1')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults([])
    setSelectedProduct(null)
    setQuantityInput('1')
    setLoading(false)
    setSubmitting(false)
    setError(null)
  }, [open, sale?.id])

  useEffect(() => {
    const trimmed = query.trim()
    if (!open || !trimmed) {
      setResults([])
      setLoading(false)
      return
    }

    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const products = await window.api.searchProducts(trimmed)
        if (active) setResults(products)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'ค้นหาสินค้าไม่สำเร็จ')
      } finally {
        if (active) setLoading(false)
      }
    }, 200)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [open, query])

  const quantity = useMemo(() => {
    const parsed = Number.parseInt(quantityInput, 10)
    return Number.isInteger(parsed) ? parsed : 0
  }, [quantityInput])

  const quantityError = selectedProduct && quantity > selectedProduct.stock_on_hand
    ? `คงเหลือ ${selectedProduct.stock_on_hand} ชิ้น`
    : null
  const lineTotal = selectedProduct && quantity > 0 ? selectedProduct.sale_price * quantity : 0
  const updatedTotal = sale ? sale.total_amount + lineTotal : lineTotal
  const canSubmit = Boolean(
    sale &&
    selectedProduct &&
    quantity > 0 &&
    quantity <= selectedProduct.stock_on_hand &&
    !submitting
  )

  const handleSelectProduct = (product: Product) => {
    if (product.stock_on_hand <= 0) return
    setSelectedProduct(product)
    setQuantityInput('1')
    setQuery('')
    setResults([])
    setError(null)
  }

  const handleSubmit = async () => {
    if (!sale || !selectedProduct || !canSubmit) return

    setSubmitting(true)
    setError(null)
    try {
      const result = await window.api.addSaleItem({
        saleId: sale.id,
        productId: selectedProduct.id,
        quantity,
        sellerRole: role ?? 'owner'
      })
      onSuccess(result)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เพิ่มสินค้าไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  if (!sale) return null

  return (
    <Modal open={open} onClose={onClose} title={`เพิ่มสินค้าในใบเสร็จ #${sale.id}`} width="max-w-xl">
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">ออเดอร์ล่าสุด</p>
              <p className="text-xs text-gray-500">
                {sale.customer_name ? `ลูกค้า: ${sale.customer_name}` : 'ไม่มีชื่อลูกค้า'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">ยอดเดิม</p>
              <p className="text-lg font-bold text-green-700">{formatBaht(sale.total_amount)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700" htmlFor="add-sale-item-search">
            ค้นหาสินค้า
          </label>
          <input
            id="add-sale-item-search"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setError(null)
            }}
            placeholder="พิมพ์ชื่อสินค้า..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            autoFocus
          />
          {loading && (
            <p className="text-xs text-gray-400">กำลังค้นหา...</p>
          )}
          {query.trim() && !loading && results.length === 0 && (
            <p className="text-xs text-gray-400">ไม่พบสินค้า</p>
          )}
          {results.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              {results.map((product) => {
                const outOfStock = product.stock_on_hand <= 0
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelectProduct(product)}
                    disabled={outOfStock}
                    className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-green-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-900">{product.name}</span>
                      {product.description && (
                        <span className="block truncate text-xs text-gray-500">{product.description}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold text-green-700">{formatBaht(product.sale_price)}</span>
                      <span className={outOfStock ? 'text-xs text-red-500' : 'text-xs text-gray-400'}>
                        คงเหลือ {product.stock_on_hand}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {selectedProduct && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{selectedProduct.name}</p>
                <p className="text-xs text-gray-500">
                  {formatBaht(selectedProduct.sale_price)} / ชิ้น · คงเหลือ {selectedProduct.stock_on_hand}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="shrink-0 text-xs font-medium text-gray-500 hover:text-red-600"
              >
                ลบ
              </button>
            </div>

            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <label className="space-y-1 text-sm text-gray-700">
                <span className="font-medium">จำนวน</span>
                <input
                  type="number"
                  min={1}
                  max={selectedProduct.stock_on_hand}
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </label>
              <div className="text-right">
                <p className="text-xs text-gray-500">เพิ่ม</p>
                <p className="text-lg font-bold text-green-700">{formatBaht(lineTotal)}</p>
              </div>
            </div>
            {quantityError && (
              <p className="mt-2 text-xs text-red-600">{quantityError}</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
          <span className="text-sm font-medium text-gray-700">ยอดหลังเพิ่มสินค้า</span>
          <span className="text-xl font-bold text-green-700">{formatBaht(updatedTotal)}</span>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-lg bg-gray-200 px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-300 disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-[2] rounded-lg bg-green-600 px-4 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'กำลังเพิ่ม...' : 'เพิ่มสินค้า'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
