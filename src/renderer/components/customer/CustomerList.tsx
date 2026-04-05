import React from 'react'
import { formatBaht } from '../../lib/format'
import type { CustomerWithDebt } from '../../lib/types'

interface Props {
  customers: CustomerWithDebt[]
  selectedId: number | null
  onSelect: (id: number) => void
}

export function CustomerList({ customers, selectedId, onSelect }: Props) {
  if (customers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">ไม่พบลูกค้า</div>
    )
  }

  return (
    <div className="divide-y">
      {customers.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`w-full text-left px-4 py-3 transition-colors ${
            selectedId === c.id ? 'bg-green-50 border-l-4 border-green-500' : 'hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-900">{c.name}</span>
              {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
            </div>
            {c.outstanding > 0 && (
              <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                ค้าง {formatBaht(c.outstanding)}
              </span>
            )}
            {c.outstanding <= 0 && c.total_credit > 0 && (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                ชำระครบ
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
