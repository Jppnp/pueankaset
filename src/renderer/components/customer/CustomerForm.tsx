import React, { useState, useEffect, useRef, useCallback } from 'react'
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const dupTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (open) {
      setName(customer?.name ?? '')
      setPhone(customer?.phone ?? '')
      setAddress(customer?.address ?? '')
      setError(null)
      setFieldErrors({})
      setDuplicateWarning(null)
      setSaving(false)
    }
  }, [open, customer])

  const checkDuplicate = useCallback(
    (value: string) => {
      clearTimeout(dupTimerRef.current)
      const trimmed = value.trim()
      if (!trimmed) {
        setDuplicateWarning(null)
        return
      }
      dupTimerRef.current = setTimeout(async () => {
        const dup = await window.api.checkDuplicateCustomer(trimmed, customer?.id)
        setDuplicateWarning(dup ? `มีลูกค้าชื่อ "${dup.name}" อยู่แล้ว` : null)
      }, 300)
    },
    [customer]
  )

  const handleNameChange = (value: string) => {
    setName(value)
    if (!value.trim()) {
      setFieldErrors((e) => ({ ...e, name: 'กรุณาระบุชื่อลูกค้า' }))
    } else {
      setFieldErrors((e) => { const { name: _, ...rest } = e; return rest })
    }
    checkDuplicate(value)
  }

  const handlePhoneChange = (value: string) => {
    setPhone(value)
    if (value.trim() && !/^[0-9\-+() ]*$/.test(value.trim())) {
      setFieldErrors((e) => ({ ...e, phone: 'รูปแบบเบอร์โทรไม่ถูกต้อง' }))
    } else {
      setFieldErrors((e) => { const { phone: _, ...rest } = e; return rest })
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setFieldErrors((e) => ({ ...e, name: 'กรุณาระบุชื่อลูกค้า' }))
      return
    }
    if (Object.keys(fieldErrors).length > 0) return

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
            onChange={(e) => handleNameChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
              fieldErrors.name ? 'border-red-400' : 'border-gray-300'
            }`}
            autoFocus
          />
          {fieldErrors.name && (
            <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>
          )}
          {duplicateWarning && !fieldErrors.name && (
            <p className="text-xs text-amber-600 mt-1">{duplicateWarning}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทร</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
              fieldErrors.phone ? 'border-red-400' : 'border-gray-300'
            }`}
            placeholder="เช่น 081-234-5678"
          />
          {fieldErrors.phone && (
            <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>
          )}
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
            disabled={saving || Object.keys(fieldErrors).length > 0}
            className="flex-[2] px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
