import React from 'react'
import type { Sale } from '../../lib/types'
import { formatBaht, formatDeliveryStatus, formatPaymentType, formatThaiDate } from '../../lib/format'

interface OrderListProps {
  sales: Sale[]
  selectedId: number | null
  onSelect: (id: number) => void
  showItemNames?: boolean
  emptyMessage?: string
}

export function OrderList({ sales, selectedId, onSelect, showItemNames = false, emptyMessage }: OrderListProps) {
  if (sales.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">{emptyMessage ?? 'ไม่มีรายการขายในช่วงเวลานี้'}</div>
    )
  }

  return (
    <div className="divide-y" role="list" aria-label="รายการขาย">
      {sales.map((sale) => {
        const historyTotal = sale.items_total ?? sale.total_amount
        const cardFee = sale.card_fee_amount ?? Math.max(0, sale.total_amount - historyTotal)

        return (
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
                {sale.has_exchange ? (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 ml-1">
                    เปลี่ยนสินค้า
                  </span>
                ) : null}
                {sale.delivery_status && sale.delivery_status !== 'none' ? (
                  <span className={`text-xs px-1.5 py-0.5 rounded ml-1 ${
                    sale.delivery_status === 'waiting'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {formatDeliveryStatus(sale.delivery_status)}
                  </span>
                ) : null}
              </span>
              <p className="text-xs text-gray-500">{formatThaiDate(sale.date)}</p>
            </div>
            <div className="text-right">
              <span className="font-semibold text-green-700">{formatBaht(historyTotal)}</span>
              {cardFee > 0 && (
                <p className="text-xs text-gray-400">ไม่รวมค่าบัตร {formatBaht(cardFee)}</p>
              )}
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span className="text-xs text-gray-400">
                  {sale.seller_role === 'owner' ? 'เจ้าของร้าน' : 'พนักงาน'}
                </span>
                {sale.payment_type && sale.payment_type !== 'cash' && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    sale.payment_type === 'credit'
                      ? 'bg-orange-100 text-orange-700'
                      : sale.payment_type === 'transfer'
                        ? 'bg-cyan-100 text-cyan-700'
                        : 'bg-blue-100 text-blue-700'
                  }`}>
                    {formatPaymentType(sale.payment_type)}
                  </span>
                )}
              </div>
            </div>
          </div>
          {sale.customer_name && (
            <p className="text-xs text-blue-500 mt-1">{sale.customer_name}</p>
          )}
          {showItemNames && sale.item_names && (
            <p className="text-xs text-gray-500 mt-1 truncate">สินค้า: {sale.item_names}</p>
          )}
          {sale.remark && (
            <p className="text-xs text-gray-400 mt-0.5">{sale.remark}</p>
          )}
        </button>
        )
      })}
    </div>
  )
}
