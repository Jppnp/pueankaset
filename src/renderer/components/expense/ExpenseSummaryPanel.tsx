import React from 'react'
import { formatBaht } from '../../lib/format'
import type { ExpenseSummary } from '../../lib/types'

interface Props {
  summary: ExpenseSummary | null
}

export function ExpenseSummaryPanel({ summary }: Props) {
  if (!summary) return null

  const maxTotal = Math.max(...summary.by_category.map((c) => c.total), 1)

  return (
    <div className="p-4 space-y-4">
      <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-4">
        <p className="text-sm text-gray-500 mb-1">ค่าใช้จ่ายรวม</p>
        <p className="text-2xl font-bold text-orange-700">{formatBaht(summary.total_expenses)}</p>
      </div>

      {summary.by_category.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">แยกตามหมวดหมู่</h4>
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
      )}

      {summary.by_category.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีข้อมูล</p>
      )}
    </div>
  )
}
