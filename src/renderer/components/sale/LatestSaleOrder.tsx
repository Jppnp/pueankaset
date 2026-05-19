import React from 'react'
import type { SaleWithItems } from '../../lib/types'
import { formatBaht, formatDeliveryStatus, formatPaymentType, formatThaiDate } from '../../lib/format'

interface LatestSaleOrderProps {
  sale: SaleWithItems | null
  loading: boolean
  onPrint: (saleId: number) => void
  onAddItem: () => void
}

export function LatestSaleOrder({ sale, loading, onPrint, onAddItem }: LatestSaleOrderProps) {
  const visibleItems = sale?.items.slice(0, 2) ?? []
  const remainingItems = sale ? sale.items.length - visibleItems.length : 0
  const itemSummary = visibleItems
    .map((item) => `${item.product_name} x${item.quantity}`)
    .join(' · ')

  return (
    <section className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-left shadow-sm">
      <div className="flex items-center gap-4">
        <div className="w-36 shrink-0">
          <p className="text-xs font-semibold text-gray-500">ออเดอร์ล่าสุด</p>
          {sale ? (
            <p className="truncate text-sm font-semibold text-gray-900">
              ใบเสร็จ #{sale.id}
              {sale.delivery_status && sale.delivery_status !== 'none' && (
                <span className={`ml-1 rounded px-1.5 py-0.5 text-xs ${
                  sale.delivery_status === 'waiting'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {formatDeliveryStatus(sale.delivery_status)}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-gray-500">ยังไม่มีรายการขาย</p>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {loading ? (
            <p className="text-sm text-gray-400">กำลังโหลด...</p>
          ) : sale ? (
            <>
              <p className="truncate text-sm text-gray-700">
                {itemSummary}
                {remainingItems > 0 ? ` · + อีก ${remainingItems} รายการ` : ''}
              </p>
              <p className="truncate text-xs text-gray-500">
                {formatThaiDate(sale.date)} · {formatPaymentType(sale.payment_type)}
                {sale.customer_name ? ` · ${sale.customer_name}` : ''}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">บันทึกการขายแล้วจะแสดงที่นี่</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {sale && !loading && (
            <p className="min-w-24 text-right text-xl font-bold text-green-700">
              {formatBaht(sale.total_amount)}
            </p>
          )}
          {sale && (
            <>
              <button
                type="button"
                onClick={onAddItem}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                เพิ่มสินค้า
              </button>
              <button
                type="button"
                onClick={() => onPrint(sale.id)}
                disabled={loading}
                className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                พิมพ์ซ้ำ
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
