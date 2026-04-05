import React from 'react'
import { formatBaht } from '../../lib/format'
import type { RevenueTrendPoint } from '../../lib/types'

interface Props {
  data: RevenueTrendPoint[]
  days: number
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const day = date.getDate()
  const month = date.getMonth() + 1
  return `${day}/${month}`
}

function fillMissingDays(data: RevenueTrendPoint[], days: number): RevenueTrendPoint[] {
  const map = new Map(data.map((d) => [d.day, d]))
  const result: RevenueTrendPoint[] = []
  const today = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
    result.push(map.get(key) ?? { day: key, revenue: 0, order_count: 0 })
  }

  return result
}

export function RevenueTrendChart({ data, days }: Props) {
  const filled = fillMissingDays(data, days)
  const maxRevenue = Math.max(...filled.map((d) => d.revenue), 1)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        ยอดขาย {days} วันล่าสุด
      </h3>
      <div className="flex items-end gap-2 h-40">
        {filled.map((point) => {
          const height = Math.max((point.revenue / maxRevenue) * 100, point.revenue > 0 ? 4 : 1)
          return (
            <div key={point.day} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center justify-end h-32">
                {point.revenue > 0 && (
                  <span className="text-xs text-gray-500 mb-1">
                    {formatBaht(point.revenue)}
                  </span>
                )}
                <div
                  className={`w-full max-w-10 rounded-t transition-all ${
                    point.revenue > 0 ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                  style={{ height: `${height}%` }}
                  title={`${formatDayLabel(point.day)}: ${formatBaht(point.revenue)} (${point.order_count} ออเดอร์)`}
                />
              </div>
              <span className="text-xs text-gray-400">{formatDayLabel(point.day)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
