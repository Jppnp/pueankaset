import React, { useState, useEffect } from 'react'
import { Modal } from '../shared/Modal'
import { formatBaht, calcCardFee } from '../../lib/format'
import type { OrderItem } from '../../lib/types'

interface CheckoutDialogProps {
  open: boolean
  onClose: () => void
  items: OrderItem[]
  total: number
  onConfirm: (options: { remark?: string; print: boolean; cardFee?: number }) => void
}

export function CheckoutDialog({ open, onClose, items, total, onConfirm }: CheckoutDialogProps) {
  const [remark, setRemark] = useState('')
  const [print, setPrint] = useState(false)
  const [payByCard, setPayByCard] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setRemark('')
      setPrint(false)
      setPayByCard(false)
      setSubmitting(false)
    }
  }, [open])

  const cardFee = calcCardFee(total)
  const grandTotal = payByCard ? total + cardFee : total

  const handleConfirm = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const remarkParts = [remark.trim(), payByCard ? 'ชำระบัตร' : ''].filter(Boolean)
      await onConfirm({
        remark: remarkParts.join(' | ') || undefined,
        print,
        cardFee: payByCard ? cardFee : undefined
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="ชำระเงิน">
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {items.map((item) => (
              <div key={item.product_id} className="flex justify-between text-sm">
                <span>
                  {item.name} x{item.quantity}
                </span>
                <span>{formatBaht(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-3 pt-3 space-y-1">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>ยอดสินค้า</span>
              <span>{formatBaht(total)}</span>
            </div>
            {payByCard && (
              <div className="flex justify-between items-center text-sm text-orange-600">
                <span>ค่าธรรมเนียมบัตร (5%)</span>
                <span>+{formatBaht(cardFee)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t">
              <span className="text-lg font-semibold">รวมทั้งหมด</span>
              <span className="text-2xl font-bold text-green-700">{formatBaht(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Card payment toggle */}
        <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
          <input
            type="checkbox"
            checked={payByCard}
            onChange={(e) => setPayByCard(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700">ชำระด้วยบัตร (บวกค่าธรรมเนียม 5%)</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            หมายเหตุ (ถ้ามี)
          </label>
          <input
            type="text"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="เช่น ชื่อลูกค้า, เงื่อนไขพิเศษ"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={print}
            onChange={(e) => setPrint(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700">พิมพ์ใบเสร็จ</span>
        </label>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-[2] px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors text-lg disabled:opacity-50"
          >
            {submitting ? 'กำลังบันทึก...' : 'ยืนยันการขาย'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
