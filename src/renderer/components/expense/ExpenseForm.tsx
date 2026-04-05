import React, { useState, useEffect } from 'react'
import { Modal } from '../shared/Modal'
import { EXPENSE_CATEGORIES } from '../../lib/expenseCategories'
import { toISODate } from '../../lib/format'
import type { Expense } from '../../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  expense: Expense | null // null = create mode
  onSave: () => void
  createdBy: string
}

export function ExpenseForm({ open, onClose, expense, onSave, createdBy }: Props) {
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(toISODate(new Date()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCustom = category === '__custom__'

  useEffect(() => {
    if (open) {
      if (expense) {
        const preset = EXPENSE_CATEGORIES.find((c) => c.value === expense.category)
        if (preset) {
          setCategory(expense.category)
          setCustomCategory('')
        } else {
          setCategory('__custom__')
          setCustomCategory(expense.category)
        }
        setAmount(expense.amount.toString())
        setDescription(expense.description ?? '')
        setDate(expense.date ? expense.date.split(' ')[0] : toISODate(new Date()))
      } else {
        setCategory(EXPENSE_CATEGORIES[0].value)
        setCustomCategory('')
        setAmount('')
        setDescription('')
        setDate(toISODate(new Date()))
      }
      setError(null)
      setSaving(false)
    }
  }, [open, expense])

  const handleSave = async () => {
    const finalCategory = isCustom ? customCategory.trim() : category
    if (!finalCategory) { setError('กรุณาระบุหมวดหมู่'); return }
    const num = parseFloat(amount)
    if (!num || num <= 0) { setError('จำนวนเงินต้องมากกว่า 0'); return }

    setSaving(true)
    setError(null)
    try {
      if (expense) {
        await window.api.updateExpense(expense.id, {
          category: finalCategory,
          amount: num,
          description: description.trim() || undefined,
          date: `${date} 00:00:00`
        })
      } else {
        await window.api.createExpense({
          category: finalCategory,
          amount: num,
          description: description.trim() || undefined,
          date: `${date} 00:00:00`,
          createdBy
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
    <Modal open={open} onClose={onClose} title={expense ? 'แก้ไขค่าใช้จ่าย' : 'เพิ่มค่าใช้จ่าย'}>
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่ *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
            <option value="__custom__">กำหนดเอง...</option>
          </select>
          {isCustom && (
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="ระบุหมวดหมู่"
              className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงิน (บาท) *</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={0}
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="เช่น ค่าเช่าเดือน มี.ค."
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
            className="flex-[2] px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
