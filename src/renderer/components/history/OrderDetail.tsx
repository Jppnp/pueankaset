import React, { useState } from 'react'
import type { SaleWithItems } from '../../lib/types'
import { formatBaht, formatThaiDate } from '../../lib/format'
import { useRole } from '../../contexts/RoleContext'
import { RefundDialog } from './RefundDialog'

interface OrderDetailProps {
  sale: SaleWithItems | null
  loading: boolean
  onPrint: (saleId: number) => void
  onRefundSuccess?: () => void
}

export function OrderDetail({ sale, loading, onPrint, onRefundSuccess }: OrderDetailProps) {
  const { isOwner } = useRole()
  const [showRefund, setShowRefund] = useState(false)

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

  const hasRefundableItems = sale.items.some(
    (item) => item.quantity - (item.refunded_qty || 0) > 0
  )

  const handleRefundSuccess = () => {
    onRefundSuccess?.()
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">ใบเสร็จ #{sale.id}</h3>
          <p className="text-sm text-gray-500">{formatThaiDate(sale.date)}</p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && hasRefundableItems && (
            <button
              onClick={() => setShowRefund(true)}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
            >
              คืนสินค้า
            </button>
          )}
          <button
            onClick={() => onPrint(sale.id)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
          >
            พิมพ์ใบเสร็จ
          </button>
        </div>
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
            {sale.items.map((item) => {
              const refundedQty = item.refunded_qty || 0
              return (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-sm">{item.product_name}</td>
                  <td className="px-4 py-2 text-sm text-right">
                    {item.quantity}
                    {refundedQty > 0 && (
                      <span className="text-red-500 text-xs ml-1">(คืน {refundedQty})</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-right">{formatBaht(item.price)}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium">
                    {formatBaht(item.price * item.quantity)}
                  </td>
                </tr>
              )
            })}
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
      <div className="space-y-1">
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

      {/* Refund history */}
      {sale.refunds && sale.refunds.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold text-red-700 mb-2">ประวัติการคืนสินค้า</h4>
          <div className="space-y-3">
            {sale.refunds.map((refund) => (
              <div key={refund.id} className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">{formatThaiDate(refund.date)}</span>
                  <span className="text-sm font-semibold text-red-700">
                    -{formatBaht(refund.total_amount)}
                  </span>
                </div>
                {refund.reason && (
                  <p className="text-xs text-gray-500 mb-1">เหตุผล: {refund.reason}</p>
                )}
                <div className="space-y-0.5">
                  {refund.items.map((ri) => (
                    <p key={ri.id} className="text-xs text-red-600">
                      {ri.product_name} x{ri.quantity} ({formatBaht(ri.price * ri.quantity)})
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refund dialog */}
      {showRefund && (
        <RefundDialog
          open={showRefund}
          onClose={() => setShowRefund(false)}
          sale={sale}
          onSuccess={handleRefundSuccess}
        />
      )}
    </div>
  )
}
