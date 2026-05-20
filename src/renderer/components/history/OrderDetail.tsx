import React, { useEffect, useState } from 'react'
import type { DeliveryStatus, PaymentType, SaleWithItems } from '../../lib/types'
import { calcCardFee, formatBaht, formatDeliveryStatus, formatThaiDate } from '../../lib/format'
import { RefundDialog } from './RefundDialog'
import { ExchangeDialog } from './ExchangeDialog'

interface OrderDetailProps {
  sale: SaleWithItems | null
  loading: boolean
  onPrint: (saleId: number) => void
  onRefundSuccess?: () => void
  onDeliveryStatusChange?: () => void
  onPaymentTypeChange?: () => void
}

const DEFAULT_CARD_FEE_PERCENT = 5
const PAYMENT_OPTIONS: { value: PaymentType; label: string }[] = [
  { value: 'cash', label: 'เงินสด' },
  { value: 'card', label: 'บัตร' },
  { value: 'transfer', label: 'โอนเงิน' },
  { value: 'credit', label: 'เชื่อ' }
]

function paymentClassName(paymentType: PaymentType): string {
  if (paymentType === 'credit') return 'text-orange-600'
  if (paymentType === 'card') return 'text-blue-600'
  if (paymentType === 'transfer') return 'text-cyan-600'
  return 'text-gray-700'
}

export function OrderDetail({
  sale,
  loading,
  onPrint,
  onRefundSuccess,
  onDeliveryStatusChange,
  onPaymentTypeChange
}: OrderDetailProps) {
  const [showRefund, setShowRefund] = useState(false)
  const [showExchange, setShowExchange] = useState(false)
  const [updatingDelivery, setUpdatingDelivery] = useState(false)
  const [updatingPayment, setUpdatingPayment] = useState(false)
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentType>('cash')
  const [cardFeePercent, setCardFeePercent] = useState(DEFAULT_CARD_FEE_PERCENT)

  useEffect(() => {
    if (sale?.payment_type) {
      setSelectedPaymentType(sale.payment_type)
    }
  }, [sale?.id, sale?.payment_type])

  useEffect(() => {
    let active = true
    window.api.getSetting('card_fee_percent').then((value) => {
      if (!active) return
      const percent = value ? Number(value) : DEFAULT_CARD_FEE_PERCENT
      setCardFeePercent(
        Number.isFinite(percent) && percent >= 0 ? percent : DEFAULT_CARD_FEE_PERCENT
      )
    }).catch(() => {
      if (active) setCardFeePercent(DEFAULT_CARD_FEE_PERCENT)
    })

    return () => {
      active = false
    }
  }, [])

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

  const handleDeliveryStatusChange = async (deliveryStatus: DeliveryStatus) => {
    if (!sale || updatingDelivery) return

    setUpdatingDelivery(true)
    try {
      await window.api.updateSaleDeliveryStatus(sale.id, deliveryStatus)
      onDeliveryStatusChange?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      alert(`อัปเดตสถานะจัดส่งไม่สำเร็จ: ${message}`)
    } finally {
      setUpdatingDelivery(false)
    }
  }

  const handlePaymentTypeSave = async () => {
    if (!sale || updatingPayment || selectedPaymentType === sale.payment_type) return

    if (selectedPaymentType === 'credit' && !sale.customer_id) {
      alert('ต้องมีลูกค้าก่อนจึงเปลี่ยนเป็นการเชื่อได้')
      setSelectedPaymentType(sale.payment_type)
      return
    }

    setUpdatingPayment(true)
    try {
      await window.api.updateSalePaymentType(sale.id, selectedPaymentType)
      onPaymentTypeChange?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      alert(`อัปเดตวิธีชำระไม่สำเร็จ: ${message}`)
      setSelectedPaymentType(sale.payment_type)
    } finally {
      setUpdatingPayment(false)
    }
  }

  const deliveryStatus = sale.delivery_status ?? 'none'
  const historyTotal = sale.items_total ?? sale.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cardFee = sale.card_fee_amount ?? Math.max(0, sale.total_amount - historyTotal)
  const paymentChanged = selectedPaymentType !== sale.payment_type
  const selectedCardFee = selectedPaymentType === 'card' ? calcCardFee(historyTotal, cardFeePercent) : 0
  const selectedPaymentTotal = historyTotal + selectedCardFee

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">ใบเสร็จ #{sale.id}</h3>
          <p className="text-sm text-gray-500">{formatThaiDate(sale.date)}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasRefundableItems && (
            <>
              <button
                onClick={() => setShowExchange(true)}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
              >
                เปลี่ยนสินค้า
              </button>
              <button
                onClick={() => setShowRefund(true)}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
              >
                คืนสินค้า
              </button>
            </>
          )}
          <button
            onClick={() => onPrint(sale.id)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
          >
            พิมพ์ใบเสร็จ
          </button>
        </div>
      </div>

      <div className={`rounded-lg border px-4 py-3 ${
        deliveryStatus === 'waiting'
          ? 'border-amber-200 bg-amber-50'
          : deliveryStatus === 'shipped'
            ? 'border-green-200 bg-green-50'
            : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${
              deliveryStatus === 'waiting'
                ? 'text-amber-800'
                : deliveryStatus === 'shipped'
                  ? 'text-green-800'
                  : 'text-gray-700'
            }`}>
              {formatDeliveryStatus(deliveryStatus)}
            </p>
            <p className="text-xs text-gray-500">สถานะการจัดส่งของใบเสร็จนี้</p>
          </div>
          <div className="flex items-center gap-2">
            {deliveryStatus === 'waiting' ? (
              <>
                <button
                  type="button"
                  onClick={() => handleDeliveryStatusChange('none')}
                  disabled={updatingDelivery}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-100 disabled:opacity-50"
                >
                  ยกเลิกรอจัดส่ง
                </button>
                <button
                  type="button"
                  onClick={() => handleDeliveryStatusChange('shipped')}
                  disabled={updatingDelivery}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  จัดส่งแล้ว
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleDeliveryStatusChange('waiting')}
                disabled={updatingDelivery}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                ตั้งเป็นรอจัดส่ง
              </button>
            )}
          </div>
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
                  <td className="px-4 py-2 text-sm">
                    <div>{item.product_name}</div>
                    {item.product_description && (
                      <div className="text-xs text-gray-500 mt-0.5">{item.product_description}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-right align-top">
                    {item.quantity}
                    {refundedQty > 0 && (
                      <span className="text-red-500 text-xs ml-1">(คืน {refundedQty})</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-right align-top">{formatBaht(item.price)}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium align-top">
                    {formatBaht(item.price * item.quantity)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            {cardFee > 0 && (
              <>
                <tr className="border-t-2">
                  <td colSpan={3} className="px-4 pt-3 pb-1 text-right text-sm text-gray-500">
                    ค่าธรรมเนียมบัตร (ไม่รวมยอดประวัติ)
                  </td>
                  <td className="px-4 pt-3 pb-1 text-right text-sm text-gray-500">
                    {formatBaht(cardFee)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-4 py-1 text-right text-sm text-gray-500">
                    ยอดชำระผ่านบัตร
                  </td>
                  <td className="px-4 py-1 text-right text-sm text-gray-500">
                    {formatBaht(sale.total_amount)}
                  </td>
                </tr>
              </>
            )}
            <tr className={cardFee > 0 ? 'border-t' : 'border-t-2'}>
              <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                รวมสินค้า
              </td>
              <td className="px-4 py-3 text-right text-lg font-bold text-green-700">
                {formatBaht(historyTotal)}
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
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">วิธีชำระ:</span>
            <select
              value={selectedPaymentType}
              onChange={(e) => setSelectedPaymentType(e.target.value as PaymentType)}
              disabled={updatingPayment}
              className={`rounded-lg border border-gray-300 px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60 ${paymentClassName(selectedPaymentType)}`}
            >
              {PAYMENT_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.value === 'credit' && !sale.customer_id}
                >
                  {option.value === 'card'
                    ? `${option.label} (+${cardFeePercent}%)`
                    : option.label}
                </option>
              ))}
            </select>
            {paymentChanged && (
              <>
                <button
                  type="button"
                  onClick={handlePaymentTypeSave}
                  disabled={updatingPayment}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  {updatingPayment ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPaymentType(sale.payment_type)}
                  disabled={updatingPayment}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
                >
                  ยกเลิก
                </button>
              </>
            )}
          </div>
          {paymentChanged && selectedPaymentType === 'card' && (
            <p className="mt-1 text-xs text-orange-600">
              ค่าธรรมเนียมบัตร {formatBaht(selectedCardFee)} · ยอดชำระ {formatBaht(selectedPaymentTotal)}
            </p>
          )}
          {paymentChanged && selectedPaymentType !== 'card' && cardFee > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              จะตัดค่าธรรมเนียมบัตร {formatBaht(cardFee)} ออกจากยอดชำระ
            </p>
          )}
          {!sale.customer_id && (
            <p className="mt-1 text-xs text-gray-400">ต้องมีลูกค้าก่อนจึงเปลี่ยนเป็นเชื่อได้</p>
          )}
        </div>
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

      {/* Exchange history */}
      {sale.exchanges && sale.exchanges.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold text-blue-700 mb-2">ประวัติการเปลี่ยนสินค้า</h4>
          <div className="space-y-3">
            {sale.exchanges.map((ex) => (
	              <div key={ex.id} className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
	                <div className="flex items-center justify-between mb-2">
	                  <span className="text-xs text-gray-500">{formatThaiDate(ex.date)}</span>
	                  <div className="flex items-center gap-2">
	                    <span className={`text-sm font-semibold ${
	                      ex.price_difference > 0 ? 'text-red-600' : ex.price_difference < 0 ? 'text-green-600' : 'text-gray-600'
	                    }`}>
	                      {ex.price_difference > 0
	                        ? `ลูกค้าจ่ายเพิ่ม ${formatBaht(ex.price_difference)}`
	                        : ex.price_difference < 0
	                          ? `คืนเงิน ${formatBaht(Math.abs(ex.price_difference))}`
	                          : 'ไม่มีส่วนต่าง'}
	                    </span>
	                    <button
	                      type="button"
	                      onClick={() => onPrint(ex.new_sale_id)}
	                      className="rounded-md bg-white px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-200 transition-colors hover:bg-blue-100"
	                    >
	                      พิมพ์ใบเปลี่ยน
	                    </button>
	                  </div>
	                </div>
                {ex.reason && (
                  <p className="text-xs text-gray-500 mb-2">เหตุผล: {ex.reason}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-orange-600 font-medium mb-1">สินค้าที่คืน:</p>
                    {ex.returnItems.map((ri) => (
                      <p key={ri.id} className="text-xs text-gray-600">
                        {ri.product_name} x{ri.quantity}
                      </p>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs text-green-600 font-medium mb-1">สินค้าใหม่:</p>
                    {ex.newItems.map((ni) => (
                      <p key={ni.id} className="text-xs text-gray-600">
                        {ni.product_name} x{ni.quantity}
                      </p>
                    ))}
                  </div>
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

      {/* Exchange dialog */}
      {showExchange && (
        <ExchangeDialog
          open={showExchange}
          onClose={() => setShowExchange(false)}
          sale={sale}
          onSuccess={handleRefundSuccess}
        />
      )}
    </div>
  )
}
