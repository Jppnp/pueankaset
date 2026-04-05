import React, { useState, useEffect } from 'react'
import { Modal } from '../shared/Modal'
import { formatBaht } from '../../lib/format'

interface Props {
  open: boolean
  onClose: () => void
  customerName: string
  outstanding: number
  onSave: () => void
  customerId: number
}

export function PaymentDialog({ open, onClose, customerName, outstanding, onSave, customerId }: Props) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmount('')
      setNote('')
      setError(null)
      setSaving(false)
    }
  }, [open])

  const handleSave = async () => {
    const num = parseFloat(amount)
    if (!num || num <= 0) {
      setError('กรุณาระบุจำนวนเงินที่มากกว่า 0')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await window.api.createCustomerPayment({
        customerId,
        amount: num,
        note: note.trim() || undefined
      })
      onSave()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  const handlePayAll = () => {
    if (outstanding > 0) {
      setAmount(outstanding.toString())
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="รับชำระหนี้">
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
        )}
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
          <p className="text-sm text-gray-700">
            ลูกค้า: <span className="font-medium">{customerName}</span>
          </p>
          <p className="text-sm text-orange-700 mt-1">
            ยอดค้างชำระ: <span className="font-bold">{formatBaht(outstanding)}</span>
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงินที่รับ *</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="0.00"
              min="0"
              step="0.01"
              autoFocus
            />
            {outstanding > 0 && (
              <button
                onClick={handlePayAll}
                className="px-3 py-2 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors whitespace-nowrap"
              >
                ชำระทั้งหมด
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="เช่น รับเงินสด, โอนเงิน"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกการรับเงิน'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
