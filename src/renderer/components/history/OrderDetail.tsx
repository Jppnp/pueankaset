import React from 'react'
import type { SaleWithItems } from '../../lib/types'
import { formatBaht, formatThaiDate } from '../../lib/format'

interface OrderDetailProps {
  sale: SaleWithItems | null
  loading: boolean
  onPrint: (saleId: number) => void
}

export function OrderDetail({ sale, loading, onPrint }: OrderDetailProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        กำลังโหลด...
      </div>
    )
  }

  if (!sale) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        เลือกรายการเพื่อดูรายละเอียด
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">ใบเสร็จ #{sale.id}</h3>
          <p className="text-sm text-gray-500">{formatThaiDate(sale.date)}</p>
        </div>
        <button
          onClick={() => onPrint(sale.id)}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
        >
          พิมพ์ใบเสร็จ
        </button>
      </div>

      <div className="bg-gray-50 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-sm text-gray-600 border-b">
              <th className="px-4 py-2 text-left font-medium">สินค้า</th>
              <th className="px-4 py-2 text-right font-medium">จำนวน</th>
              <th className="px-4 py-2 text-right font-medium">ราคา</th>
              <th className="px-4 py-2 text-right font-medium">รวม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sale.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2 text-sm">{item.product_name}</td>
                <td className="px-4 py-2 text-sm text-right">{item.quantity}</td>
                <td className="px-4 py-2 text-sm text-right">{formatBaht(item.price)}</td>
                <td className="px-4 py-2 text-sm text-right font-medium">
                  {formatBaht(item.price * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2">
              <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                รวมทั้งสิ้น
              </td>
              <td className="px-4 py-3 text-right text-lg font-bold text-green-700">
                {formatBaht(sale.total_amount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Customer & payment info */}
      <div className="mt-3 space-y-1">
        {sale.customer_name && (
          <p className="text-sm text-blue-600">
            ลูกค้า: {sale.customer_name}
            {sale.customer_phone && <span className="text-blue-400 ml-2">{sale.customer_phone}</span>}
          </p>
        )}
        {sale.payment_type && (
          <p className="text-sm text-gray-500">
            วิธีชำระ:{' '}
            <span className={
              sale.payment_type === 'credit'
                ? 'text-orange-600 font-medium'
                : sale.payment_type === 'card'
                  ? 'text-blue-600'
                  : 'text-gray-700'
            }>
              {sale.payment_type === 'credit' ? 'เชื่อ' : sale.payment_type === 'card' ? 'บัตร' : 'เงินสด'}
            </span>
          </p>
        )}
        {sale.remark && (
          <p className="text-sm text-gray-500">
            หมายเหตุ: {sale.remark}
          </p>
        )}
      </div>
    </div>
  )
}
