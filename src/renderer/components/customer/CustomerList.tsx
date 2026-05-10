import React from 'react'
import { formatBaht } from '../../lib/format'
import type { CustomerWithDebt } from '../../lib/types'

interface Props {
  customers: CustomerWithDebt[]
  selectedId: number | null
  onSelect: (id: number) => void
  onPrintDebt?: (id: number) => void
}

export function CustomerList({ customers, selectedId, onSelect, onPrintDebt }: Props) {
  if (customers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">ไม่พบลูกค้า</div>
    )
  }

  return (
    <div className="divide-y">
      {customers.map((c) => (
        <div
          key={c.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(c.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelect(c.id)
            }
          }}
          className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
            selectedId === c.id ? 'bg-green-50 border-l-4 border-green-500' : 'hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-sm font-medium text-gray-900">{c.name}</span>
              {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
              {c.outstanding > 0 && onPrintDebt && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onPrintDebt(c.id)
                  }}
                  title="พิมพ์ใบสรุปยอดค้างชำระ"
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
