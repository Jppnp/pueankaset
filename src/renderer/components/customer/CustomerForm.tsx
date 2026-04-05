import React, { useState, useEffect } from 'react'
import { Modal } from '../shared/Modal'
import type { Customer } from '../../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  customer: Customer | null // null = create mode
  onSave: () => void
}

export function CustomerForm({ open, onClose, customer, onSave }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(customer?.name ?? '')
      setPhone(customer?.phone ?? '')
      setAddress(customer?.address ?? '')
      setError(null)
      setSaving(false)
    }
  }, [open, customer])

  const handleSave = async () => {
    if (!name.trim()) {
      setError('กรุณาระบุชื่อลูกค้า')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (customer) {
        await window.api.updateCustomer(customer.id, {
          name: name.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined
        })
      } else {
        await window.api.createCustomer({
          name: name.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined
        })
      }
      onSave()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={customer ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้าใหม่'}>
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทร</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
