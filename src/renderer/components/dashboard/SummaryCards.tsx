import React from 'react'
import { formatBaht } from '../../lib/format'
import type { ProfitSummary } from '../../lib/types'

interface Props {
  summary: ProfitSummary
}

export function SummaryCards({ summary }: Props) {
  const cards = [
    {
      label: 'ยอดขายวันนี้',
      value: formatBaht(summary.total_revenue),
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200'
    },
    {
      label: 'จำนวนออเดอร์',
      value: `${summary.sale_count} รายการ`,
      bg: 'bg-gray-50',
      text: 'text-gray-700',
      border: 'border-gray-200'
    },
    {
      label: 'ต้นทุน',
      value: formatBaht(summary.total_cost),
      bg: 'bg-red-50',
      text: 'text-red-600',
      border: 'border-red-200'
    },
    {
      label: 'กำไรสุทธิ',
      value: formatBaht(summary.total_profit),
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200'
    }
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`${card.bg} ${card.border} border rounded-xl px-5 py-4`}
        >
          <p className="text-sm text-gray-500 mb-1">{card.label}</p>
          <p className={`text-xl font-bold ${card.text}`}>{card.value}</p>
        </div>
      ))}
    </div>
  )
}
