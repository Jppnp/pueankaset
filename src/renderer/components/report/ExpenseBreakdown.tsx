import React from 'react'
import { formatBaht } from '../../lib/format'
import type { ExpenseSummary } from '../../lib/types'

interface Props {
  summary: ExpenseSummary
}

export function ExpenseBreakdown({ summary }: Props) {
  if (summary.by_category.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3">ค่าใช้จ่ายแยกตามหมวด</h3>
        <p className="text-sm text-gray-400 text-center py-4">ไม่มีค่าใช้จ่ายในเดือนนี้</p>
      </div>
    )
  }

  const maxTotal = Math.max(...summary.by_category.map((c) => c.total), 1)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-3">
        ค่าใช้จ่ายแยกตามหมวด
        <span className="ml-2 text-sm font-normal text-orange-600">
          รวม {formatBaht(summary.total_expenses)}
        </span>
      </h3>
      <div className="space-y-3">
        {summary.by_category.map((cat) => {
          const percent = (cat.total / summary.total_expenses) * 100
          const barWidth = (cat.total / maxTotal) * 100
          return (
            <div key={cat.category}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-700">{cat.category}</span>
                <span className="text-gray-900 font-medium">
                  {formatBaht(cat.total)}
                  <span className="text-gray-400 text-xs ml-1">({percent.toFixed(0)}%)</span>
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
