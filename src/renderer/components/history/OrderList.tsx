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
    <div className="divide-y" role="list" aria-label="รายการขาย">
      {sales.map((sale) => (
        <button
          role="listitem"
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
                {sale.has_refund ? (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 ml-1">
                    คืนสินค้า
                  </span>
                ) : null}
              </span>
              <p className="text-xs text-gray-500">{formatThaiDate(sale.date)}</p>
            </div>
            <div className="text-right">
              <span className="font-semibold text-green-700">{formatBaht(sale.total_amount)}</span>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span className="text-xs text-gray-400">
                  {sale.seller_role === 'owner' ? 'เจ้าของร้าน' : 'พนักงาน'}
                </span>
                {sale.payment_type && sale.payment_type !== 'cash' && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    sale.payment_type === 'credit'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {sale.payment_type === 'credit' ? 'เชื่อ' : 'บัตร'}
                  </span>
                )}
              </div>
            </div>
          </div>
          {sale.customer_name && (
            <p className="text-xs text-blue-500 mt-1">{sale.customer_name}</p>
          )}
          {sale.remark && (
            <p className="text-xs text-gray-400 mt-0.5">{sale.remark}</p>
          )}
        </button>
      ))}
    </div>
  )
}
