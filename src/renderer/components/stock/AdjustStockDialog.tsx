import React, { useState, useEffect } from 'react'
import { Modal } from '../shared/Modal'
import type { Product, Role } from '../../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  product: Product
  role: Role
  onSuccess: () => void
}

export function AdjustStockDialog({ open, onClose, product, role, onSuccess }: Props) {
  const [newQuantity, setNewQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setNewQuantity(product.stock_on_hand.toString())
      setReason('')
      setError(null)
      setSaving(false)
    }
  }, [open, product])

  const qty = parseInt(newQuantity) || 0
  const diff = qty - product.stock_on_hand

  const handleSave = async () => {
    if (qty < 0) {
      setError('จำนวนต้องไม่ติดลบ')
      return
    }
    if (!reason.trim()) {
      setError('กรุณาระบุเหตุผล')
      return
    }
    if (diff === 0) {
      onClose()
      return
    }
    setSaving(true)
    setError(null)
    try {
      await window.api.adjustStock({
        productId: product.id,
        newQuantity: qty,
        reason: reason.trim(),
        createdBy: role
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="ปรับสต็อก">
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
        )}
        <div className="bg-gray-50 rounded-lg px-4 py-3">
          <p className="text-sm font-medium text-gray-900">{product.name}</p>
          <p className="text-sm text-gray-500">คงเหลือปัจจุบัน: {product.stock_on_hand}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนใหม่ *</label>
          <input
            type="number"
            value={newQuantity}
            onChange={(e) => setNewQuantity(e.target.value)}
            min={0}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            autoFocus
          />
          {diff !== 0 && (
            <p className={`text-sm mt-1 ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {diff > 0 ? `+${diff}` : diff} (จาก {product.stock_on_hand} เป็น {qty})
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">เหตุผล *</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เช่น ตรวจนับสต็อก, สินค้าเสียหาย"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300">
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] px-4 py-2.5 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : 'ปรับสต็อก'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
