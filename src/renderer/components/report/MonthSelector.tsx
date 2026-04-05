import React from 'react'
import { THAI_MONTHS } from '../../lib/format'

interface Props {
  year: number
  month: number
  onChange: (year: number, month: number) => void
}

export function MonthSelector({ year, month, onChange }: Props) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="flex items-center gap-2">
      <select
        value={month}
        onChange={(e) => onChange(year, Number(e.target.value))}
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        {THAI_MONTHS.map((name, i) => (
          <option key={i} value={i}>{name}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => onChange(Number(e.target.value), month)}
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y + 543}</option>
        ))}
      </select>
    </div>
  )
}
