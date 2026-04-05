import React from 'react'
import { formatBaht } from '../../lib/format'
import type { ProfitSummary } from '../../lib/types'

interface Props {
  current: ProfitSummary
  previous: ProfitSummary
  averageOrderValue: number
  previousAverageOrderValue: number
}

interface CardConfig {
  label: string
  value: string
  prevValue: number
  currentValue: number
  bg: string
  text: string
  border: string
  invertColor?: boolean // true = increase is bad (cost/expenses)
}

function DeltaIndicator({ current, previous, invert }: { current: number; previous: number; invert?: boolean }) {
  if (previous === 0 && current === 0) return null
  const diff = current - previous
  if (diff === 0) return null

  const isPositive = diff > 0
  const isGood = invert ? !isPositive : isPositive
  const color = isGood ? 'text-green-600' : 'text-red-500'
  const arrow = isPositive ? '↑' : '↓'
  const percent = previous !== 0 ? Math.abs((diff / previous) * 100).toFixed(0) : '-'

  return (
    <span className={`text-xs ${color} ml-1`}>
      {arrow} {percent}%
    </span>
  )
}

export function MonthlySummaryCards({ current, previous, averageOrderValue, previousAverageOrderValue }: Props) {
  const cards: CardConfig[] = [
    {
      label: 'ยอดขาย',
      value: formatBaht(current.total_revenue),
      currentValue: current.total_revenue,
      prevValue: previous.total_revenue,
      bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200'
    },
    {
      label: 'จำนวนออเดอร์',
      value: `${current.sale_count} รายการ`,
      currentValue: current.sale_count,
      prevValue: previous.sale_count,
      bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200'
    },
    {
      label: 'ต้นทุน',
      value: formatBaht(current.total_cost),
      currentValue: current.total_cost,
      prevValue: previous.total_cost,
      bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200',
      invertColor: true
    },
    {
      label: 'กำไรขั้นต้น',
      value: formatBaht(current.total_profit),
      currentValue: current.total_profit,
      prevValue: previous.total_profit,
      bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200'
    },
    {
      label: 'ค่าใช้จ่าย',
      value: formatBaht(current.total_expenses ?? 0),
      currentValue: current.total_expenses ?? 0,
      prevValue: previous.total_expenses ?? 0,
      bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200',
      invertColor: true
    },
    {
      label: 'กำไรสุทธิ',
      value: formatBaht(current.net_profit ?? current.total_profit),
      currentValue: current.net_profit ?? current.total_profit,
      prevValue: previous.net_profit ?? previous.total_profit,
      bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200'
    },
    {
      label: 'เฉลี่ยต่อออเดอร์',
      value: formatBaht(averageOrderValue),
      currentValue: averageOrderValue,
      prevValue: previousAverageOrderValue,
      bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200'
    }
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`${card.bg} ${card.border} border rounded-xl px-5 py-4`}
        >
          <p className="text-sm text-gray-500 mb-1">
            {card.label}
            <DeltaIndicator current={card.currentValue} previous={card.prevValue} invert={card.invertColor} />
          </p>
          <p className={`text-xl font-bold ${card.text}`}>{card.value}</p>
        </div>
      ))}
    </div>
  )
}
