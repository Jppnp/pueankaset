import React, { useState, useEffect } from 'react'
import { Modal } from '../shared/Modal'
import { formatBaht } from '../../lib/format'
import type { Product, Role } from '../../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  product: Product
  role: Role
  onSuccess: () => void
}

const PRESET_REASONS = ['รับสินค้าเข้า', 'ตรวจนับสต็อก', 'โอนสินค้าเข้า']

export function AddStockDialog({ open, onClose, product, role, onSuccess }: Props) {
  const [quantity, setQuantity] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [updatePrices, setUpdatePrices] = useState(false)
  const [reason, setReason] = useState(PRESET_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setQuantity('')
      setCostPrice(product.cost_price.toString())
      setSalePrice(product.sale_price.toString())
      setUpdatePrices(false)
      setReason(PRESET_REASONS[0])
      setCustomReason('')
      setUseCustom(false)
      setError(null)
      setSaving(false)
    }
  }, [open, product])

  const handleSave = async () => {
    const qty = parseInt(quantity)
    if (!qty || qty <= 0) {
      setError('กรุณาระบุจำนวนที่มากกว่า 0')
      return
    }
    const finalReason = useCustom ? customReason.trim() : reason
    if (!finalReason) {
      setError('กรุณาระบุเหตุผล')
      return
    }
    if (updatePrices) {
      const cp = parseFloat(costPrice)
      const sp = parseFloat(salePrice)
      if (isNaN(cp) || cp < 0) { setError('ราคาทุนต้องไม่ติดลบ'); return }
      if (isNaN(sp) || sp < 0) { setError('ราคาขายต้องไม่ติดลบ'); return }
    }
    setSaving(true)
    setError(null)
    try {
      await window.api.addStock({
        productId: product.id,
        quantity: qty,
        reason: finalReason,
        createdBy: role
      })
      // Update prices if changed
      if (updatePrices) {
        const cp = parseFloat(costPrice)
        const sp = parseFloat(salePrice)
        if (cp !== product.cost_price || sp !== product.sale_price) {
          await window.api.updateProduct(product.id, {
            cost_price: cp,
            sale_price: sp
          })
        }
      }
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="เพิ่มสต็อก">
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
        )}
        <div className="bg-gray-50 rounded-lg px-4 py-3">
          <p className="text-sm font-medium text-gray-900">{product.name}</p>
          <p className="text-sm text-gray-500">
            คงเหลือปัจจุบัน: {product.stock_on_hand} | ราคาขาย: {formatBaht(product.sale_price)}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนที่เพิ่ม *</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min={1}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            autoFocus
          />
        </div>

        {/* Price update toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={updatePrices}
            onChange={(e) => setUpdatePrices(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700">อัปเดตราคาด้วย</span>
        </label>

        {updatePrices && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ราคาทุน</label>
              <input
                type="number"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                min={0}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ราคาขาย</label>
              <input
                type="number"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                min={0}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">เหตุผล *</label>
          {!useCustom ? (
            <div className="space-y-2">
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {PRESET_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button
                onClick={() => setUseCustom(true)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                ระบุเอง...
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="ระบุเหตุผล"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={() => setUseCustom(false)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                เลือกจากรายการ
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300">
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : 'เพิ่มสต็อก'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
