import React, { useState, useEffect } from 'react'
import { Modal } from '../shared/Modal'
import { formatBaht } from '../../lib/format'
import type { SaleWithItems } from '../../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  sale: SaleWithItems
  onSuccess: () => void
}

export function RefundDialog({ open, onClose, sale, onSuccess }: Props) {
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setQuantities({})
      setReason('')
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  const refundTotal = sale.items.reduce((sum, item) => {
    const qty = quantities[item.id] || 0
    return sum + qty * item.price
  }, 0)

  const hasSelection = Object.values(quantities).some((q) => q > 0)

  const handleSubmit = async () => {
    if (submitting || !hasSelection) return
    setSubmitting(true)
    setError(null)
    try {
      const items = sale.items
        .filter((item) => (quantities[item.id] || 0) > 0)
        .map((item) => ({
          saleItemId: item.id,
          quantity: quantities[item.id]
        }))

      await window.api.createRefund({
        saleId: sale.id,
        items,
        reason: reason.trim() || undefined
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
    <Modal open={open} onClose={onClose} title={`คืนสินค้า — ใบเสร็จ #${sale.id}`}>
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="bg-gray-50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-600 border-b">
                <th className="px-3 py-2 text-left font-medium">สินค้า</th>
                <th className="px-3 py-2 text-right font-medium">ซื้อ</th>
                <th className="px-3 py-2 text-right font-medium">คืนแล้ว</th>
                <th className="px-3 py-2 text-right font-medium">คืนเพิ่ม</th>
                <th className="px-3 py-2 text-right font-medium">คืนเงิน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sale.items.map((item) => {
                const refundedQty = item.refunded_qty || 0
                const available = item.quantity - refundedQty
                const qty = quantities[item.id] || 0
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
                            setQuantities((prev) => ({ ...prev, [item.id]: val }))
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

        {hasSelection && (
          <div className="flex justify-between items-center bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
            <span className="text-sm font-medium text-orange-800">ยอดคืนเงินทั้งหมด</span>
            <span className="text-lg font-bold text-orange-700">{formatBaht(refundTotal)}</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            เหตุผลการคืน (ไม่บังคับ)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="เช่น สินค้าเสียหาย, ผิดรายการ"
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
            disabled={submitting || !hasSelection}
            className="flex-[2] px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'กำลังบันทึก...' : 'ยืนยันการคืนสินค้า'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
