import React from 'react'
import type { Sale } from '../../lib/types'
import { formatBaht, formatThaiDate } from '../../lib/format'

interface OrderListProps {
  sales: Sale[]
  selectedId: number | null
  onSelect: (id: number) => void
}

export function OrderList({ sales, selectedId, onSelect }: OrderListProps) {
  if (sales.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">ไม่มีรายการขายในช่วงเวลานี้</div>
    )
  }

  return (
    <div className="divide-y">
      {sales.map((sale) => (
        <button
          key={sale.id}
          onClick={() => onSelect(sale.id)}
          className={`w-full text-left px-4 py-3 transition-colors ${
            selectedId === sale.id ? 'bg-green-50 border-l-4 border-green-500' : 'hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-900">
                ใบเสร็จ #{sale.id}
              </span>
              <p className="text-xs text-gray-500">{formatThaiDate(sale.date)}</p>
            </div>
            <div className="text-right">
              <span className="font-semibold text-green-700">{formatBaht(sale.total_amount)}</span>
              <p className="text-xs text-gray-400">
                {sale.seller_role === 'owner' ? 'เจ้าของร้าน' : 'พนักงาน'}
              </p>
            </div>
          </div>
          {sale.remark && (
            <p className="text-xs text-gray-400 mt-1">{sale.remark}</p>
          )}
        </button>
      ))}
    </div>
  )
}
