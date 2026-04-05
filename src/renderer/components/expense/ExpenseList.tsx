import React from 'react'
import { formatBaht, formatThaiDate } from '../../lib/format'
import type { Expense } from '../../lib/types'

interface Props {
  expenses: Expense[]
  selectedId: number | null
  onSelect: (expense: Expense) => void
  onDelete: (id: number) => void
}

export function ExpenseList({ expenses, selectedId, onSelect, onDelete }: Props) {
  if (expenses.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">ไม่มีค่าใช้จ่ายในช่วงเวลานี้</div>
    )
  }

  return (
    <div className="divide-y">
      {expenses.map((exp) => (
        <div
          key={exp.id}
          className={`px-4 py-3 transition-colors cursor-pointer ${
            selectedId === exp.id ? 'bg-green-50 border-l-4 border-green-500' : 'hover:bg-gray-50'
          }`}
          onClick={() => onSelect(exp)}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-900">{exp.category}</span>
              <p className="text-xs text-gray-500">{formatThaiDate(exp.date)}</p>
              {exp.description && (
                <p className="text-xs text-gray-400 mt-0.5">{exp.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-red-600">{formatBaht(exp.amount)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('ต้องการลบรายการนี้?')) onDelete(exp.id)
                }}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
