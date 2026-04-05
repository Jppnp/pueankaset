import React, { useState, useEffect, useCallback } from 'react'
import { Modal } from '../shared/Modal'
import { formatBaht } from '../../lib/format'
import type { SaleWithItems, Product } from '../../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  sale: SaleWithItems
  onSuccess: () => void
}

interface NewItem {
  product: Product
  quantity: number
}

export function ExchangeDialog({ open, onClose, sale, onSuccess }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({})
  const [newItems, setNewItems] = useState<NewItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setStep(1)
      setReturnQuantities({})
      setNewItems([])
      setSearchQuery('')
      setSearchResults([])
      setReason('')
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  // Product search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      const results = await window.api.searchProducts(searchQuery)
      setSearchResults(results)
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const returnTotal = sale.items.reduce((sum, item) => {
    const qty = returnQuantities[item.id] || 0
    return sum + qty * item.price
  }, 0)

  const newTotal = newItems.reduce((sum, ni) => sum + ni.product.sale_price * ni.quantity, 0)
  const priceDifference = newTotal - returnTotal

  const hasReturnSelection = Object.values(returnQuantities).some((q) => q > 0)
  const hasNewItems = newItems.length > 0 && newItems.every((ni) => ni.quantity > 0)

  const handleAddNewItem = useCallback((product: Product) => {
    setNewItems((prev) => {
      const existing = prev.find((ni) => ni.product.id === product.id)
      if (existing) {
        return prev.map((ni) =>
          ni.product.id === product.id ? { ...ni, quantity: ni.quantity + 1 } : ni
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
    setSearchQuery('')
    setSearchResults([])
  }, [])

  const handleUpdateNewItemQty = useCallback((productId: number, qty: number) => {
    if (qty <= 0) {
      setNewItems((prev) => prev.filter((ni) => ni.product.id !== productId))
    } else {
      setNewItems((prev) =>
        prev.map((ni) => (ni.product.id === productId ? { ...ni, quantity: qty } : ni))
      )
    }
  }, [])

  const handleRemoveNewItem = useCallback((productId: number) => {
    setNewItems((prev) => prev.filter((ni) => ni.product.id !== productId))
  }, [])

  const handleSubmit = async () => {
    if (submitting || !hasReturnSelection || !hasNewItems) return
    setSubmitting(true)
    setError(null)
    try {
      await window.api.createExchange({
        originalSaleId: sale.id,
        returnItems: sale.items
          .filter((item) => (returnQuantities[item.id] || 0) > 0)
          .map((item) => ({ saleItemId: item.id, quantity: returnQuantities[item.id] })),
        newItems: newItems.map((ni) => ({
          product_id: ni.product.id,
          quantity: ni.quantity,
          price: ni.product.sale_price,
          cost_price: ni.product.cost_price
        })),
        reason: reason.trim() || undefined,
        sellerRole: 'owner'
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`เปลี่ยนสินค้า — ใบเสร็จ #${sale.id}`} width="max-w-3xl">
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        {step === 1 && (
          <>
            <p className="text-sm text-gray-600 font-medium">ขั้นตอนที่ 1: เลือกสินค้าที่ต้องการคืน</p>
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-600 border-b">
                    <th className="px-3 py-2 text-left font-medium">สินค้า</th>
                    <th className="px-3 py-2 text-right font-medium">ซื้อ</th>
                    <th className="px-3 py-2 text-right font-medium">คืนแล้ว</th>
                    <th className="px-3 py-2 text-right font-medium">คืน</th>
                    <th className="px-3 py-2 text-right font-medium">มูลค่า</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sale.items.map((item) => {
                    const refundedQty = item.refunded_qty || 0
                    const available = item.quantity - refundedQty
                    const qty = returnQuantities[item.id] || 0
                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <p className="text-gray-900">{item.product_name}</p>
                          <p className="text-xs text-gray-400">@ {formatBaht(item.price)}</p>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">{item.quantity}</td>
                        <td className="px-3 py-2 text-right text-red-500">
                          {refundedQty > 0 ? refundedQty : '-'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {available > 0 ? (
                            <input
                              type="number"
                              min={0}
                              max={available}
                              value={qty}
                              onChange={(e) => {
                                const val = Math.min(Math.max(0, parseInt(e.target.value) || 0), available)
                                setReturnQuantities((prev) => ({ ...prev, [item.id]: val }))
                              }}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          ) : (
                            <span className="text-gray-400 text-xs">คืนครบแล้ว</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-orange-600">
                          {qty > 0 ? formatBaht(qty * item.price) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {hasReturnSelection && (
              <div className="flex justify-between items-center bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-orange-800">มูลค่าสินค้าคืน</span>
                <span className="text-lg font-bold text-orange-700">{formatBaht(returnTotal)}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!hasReturnSelection}
                className="flex-[2] px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                ถัดไป — เลือกสินค้าใหม่
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                &larr; กลับ
              </button>
              <p className="text-sm text-gray-600 font-medium">ขั้นตอนที่ 2: เลือกสินค้าใหม่</p>
            </div>

            {/* Product search */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาสินค้าใหม่..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleAddNewItem(p)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 transition-colors flex justify-between"
                    >
                      <span className="text-gray-900">{p.name}</span>
                      <span className="text-gray-500">
                        {formatBaht(p.sale_price)}
                        <span className="text-xs text-gray-400 ml-1">(คงเหลือ {p.stock_on_hand})</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected new items */}
            {newItems.length > 0 && (
              <div className="bg-green-50 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-600 border-b">
                      <th className="px-3 py-2 text-left font-medium">สินค้าใหม่</th>
                      <th className="px-3 py-2 text-right font-medium">ราคา</th>
                      <th className="px-3 py-2 text-right font-medium">จำนวน</th>
                      <th className="px-3 py-2 text-right font-medium">รวม</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-100">
                    {newItems.map((ni) => (
                      <tr key={ni.product.id}>
                        <td className="px-3 py-2 text-gray-900">{ni.product.name}</td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {formatBaht(ni.product.sale_price)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={1}
                            max={ni.product.stock_on_hand}
                            value={ni.quantity}
                            onChange={(e) => {
                              const val = Math.min(
                                Math.max(1, parseInt(e.target.value) || 1),
                                ni.product.stock_on_hand
                              )
                              handleUpdateNewItemQty(ni.product.id, val)
                            }}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-green-700">
                          {formatBaht(ni.product.sale_price * ni.quantity)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleRemoveNewItem(ni.product.id)}
                            className="text-red-400 hover:text-red-600 text-sm"
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-orange-700">มูลค่าสินค้าคืน</span>
                <span className="font-medium text-orange-700">{formatBaht(returnTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-700">มูลค่าสินค้าใหม่</span>
                <span className="font-medium text-green-700">{formatBaht(newTotal)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="font-semibold">ส่วนต่าง</span>
                <span
                  className={`text-lg font-bold ${
                    priceDifference > 0
                      ? 'text-red-600'
                      : priceDifference < 0
                        ? 'text-green-600'
                        : 'text-gray-600'
                  }`}
                >
                  {priceDifference > 0
                    ? `ลูกค้าจ่ายเพิ่ม ${formatBaht(priceDifference)}`
                    : priceDifference < 0
                      ? `คืนเงินลูกค้า ${formatBaht(Math.abs(priceDifference))}`
                      : 'ไม่มีส่วนต่าง'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เหตุผลการเปลี่ยน (ไม่บังคับ)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="เช่น เอาผิดชนิด, ต้องการขนาดอื่น"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !hasNewItems}
                className="flex-[2] px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'กำลังบันทึก...' : 'ยืนยันเปลี่ยนสินค้า'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
