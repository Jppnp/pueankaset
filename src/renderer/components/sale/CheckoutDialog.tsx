import React, { useState } from 'react'
import { Modal } from '../shared/Modal'
import { formatBaht } from '../../lib/format'
import type { OrderItem } from '../../lib/types'

interface CheckoutDialogProps {
  open: boolean
  onClose: () => void
  items: OrderItem[]
  total: number
  onConfirm: (options: { remark?: string; print: boolean }) => void
}

export function CheckoutDialog({ open, onClose, items, total, onConfirm }: CheckoutDialogProps) {
  const [remark, setRemark] = useState('')
  const [print, setPrint] = useState(false)

  const handleConfirm = () => {
    onConfirm({ remark: remark.trim() || undefined, print })
    setRemark('')
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
          <div className="border-t mt-3 pt-3 flex justify-between items-center">
            <span className="text-lg font-semibold">รวม</span>
            <span className="text-2xl font-bold text-green-700">{formatBaht(total)}</span>
          </div>
        </div>

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
            className="flex-[2] px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors text-lg"
          >
            ยืนยันการขาย
          </button>
        </div>
      </div>
    </Modal>
  )
}
