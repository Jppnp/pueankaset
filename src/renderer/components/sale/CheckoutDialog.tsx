import React, { useState, useEffect } from 'react'
import { Modal } from '../shared/Modal'
import { formatBaht, calcCardFee } from '../../lib/format'
import { useRole } from '../../contexts/RoleContext'
import type { OrderItem, Customer, PaymentType } from '../../lib/types'

interface CheckoutDialogProps {
  open: boolean
  onClose: () => void
  items: OrderItem[]
  total: number
  selectedCustomer: Customer | null
  onConfirm: (options: {
    remark?: string
    print: boolean
    cardFee?: number
    paymentType: PaymentType
    customerId?: number
  }) => void
}

const DEFAULT_CARD_FEE_PERCENT = 5

export function CheckoutDialog({
  open,
  onClose,
  items,
  total,
  selectedCustomer,
  onConfirm
}: CheckoutDialogProps) {
  const [remark, setRemark] = useState('')
  const [print, setPrint] = useState(false)
  const [paymentType, setPaymentType] = useState<PaymentType>('cash')
  const [submitting, setSubmitting] = useState(false)
  const [cardFeePercent, setCardFeePercent] = useState(DEFAULT_CARD_FEE_PERCENT)
  const [editingFee, setEditingFee] = useState(false)
  const [feeInput, setFeeInput] = useState('')
  const { isOwner } = useRole()

  useEffect(() => {
    if (open) {
      setRemark('')
      setPrint(false)
      setPaymentType('cash')
      setSubmitting(false)
      setEditingFee(false)
      // Load saved card fee percentage
      window.api.getSetting('card_fee_percent').then((val) => {
        const num = val ? parseFloat(val) : DEFAULT_CARD_FEE_PERCENT
        setCardFeePercent(isNaN(num) || num < 0 ? DEFAULT_CARD_FEE_PERCENT : num)
      })
    }
  }, [open])

  // Reset credit if customer is deselected
  useEffect(() => {
    if (!selectedCustomer && paymentType === 'credit') {
      setPaymentType('cash')
    }
  }, [selectedCustomer, paymentType])

  const cardFee = calcCardFee(total, cardFeePercent)
  const isCard = paymentType === 'card'
  const grandTotal = isCard ? total + cardFee : total

  const paymentOptions: { value: PaymentType; label: string; requiresCustomer: boolean }[] = [
    { value: 'cash', label: 'เงินสด', requiresCustomer: false },
    { value: 'card', label: `บัตร (+${cardFeePercent}%)`, requiresCustomer: false },
    { value: 'credit', label: 'เชื่อ', requiresCustomer: true }
  ]

  const handleSaveFeePercent = async () => {
    const num = parseFloat(feeInput)
    if (isNaN(num) || num < 0 || num > 100) return
    await window.api.setSetting('card_fee_percent', num.toString())
    setCardFeePercent(num)
    setEditingFee(false)
  }

  const handleConfirm = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const remarkParts = [remark.trim()]
      if (isCard) remarkParts.push('ชำระบัตร')
      if (paymentType === 'credit' && selectedCustomer) remarkParts.push(`เชื่อ - ${selectedCustomer.name}`)

      await onConfirm({
        remark: remarkParts.filter(Boolean).join(' | ') || undefined,
        print,
        cardFee: isCard ? cardFee : undefined,
        paymentType,
        customerId: selectedCustomer?.id
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="ชำระเงิน">
      <div className="space-y-4">
        {/* Customer info */}
        {selectedCustomer && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <p className="text-sm text-blue-800">
              <span className="font-medium">{selectedCustomer.name}</span>
              {selectedCustomer.phone && (
                <span className="text-blue-500 ml-2">{selectedCustomer.phone}</span>
              )}
            </p>
          </div>
        )}

        {/* Items summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {items.map((item) => (
              <div key={item.product_id} className="flex justify-between text-sm">
                <span>
                  {item.name} x{item.quantity}
                </span>
                <span>{formatBaht(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-3 pt-3 space-y-1">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>ยอดสินค้า</span>
              <span>{formatBaht(total)}</span>
            </div>
            {isCard && (
              <div className="flex justify-between items-center text-sm text-orange-600">
                <span>ค่าธรรมเนียมบัตร ({cardFeePercent}%)</span>
                <span>+{formatBaht(cardFee)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t">
              <span className="text-lg font-semibold">รวมทั้งหมด</span>
              <span className="text-2xl font-bold text-green-700">{formatBaht(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Payment type selector */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">วิธีชำระเงิน</p>
          <div className="flex gap-2">
            {paymentOptions.map((opt) => {
              const disabled = opt.requiresCustomer && !selectedCustomer
              const selected = paymentType === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => !disabled && setPaymentType(opt.value)}
                  disabled={disabled}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                    selected
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : disabled
                        ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          {!selectedCustomer && (
            <p className="text-xs text-gray-400 mt-1">* เลือกลูกค้าก่อนเพื่อใช้การเชื่อ</p>
          )}

          {/* Card fee configuration (owner only) */}
          {isOwner && isCard && (
            <div className="mt-2">
              {editingFee ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={feeInput}
                    onChange={(e) => setFeeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveFeePercent()}
                    min="0"
                    max="100"
                    step="0.5"
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                    autoFocus
                  />
                  <span className="text-xs text-gray-500">%</span>
                  <button
                    onClick={handleSaveFeePercent}
                    className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                  >
                    บันทึก
                  </button>
                  <button
                    onClick={() => setEditingFee(false)}
                    className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs hover:bg-gray-300"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setFeeInput(cardFeePercent.toString())
                    setEditingFee(true)
                  }}
                  className="text-xs text-blue-500 hover:text-blue-700 underline"
                >
                  ปรับเปอร์เซ็นต์ค่าธรรมเนียม
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            หมายเหตุ (ถ้ามี)
          </label>
          <input
            type="text"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="เช่น เงื่อนไขพิเศษ"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={print}
            onChange={(e) => setPrint(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700">พิมพ์ใบเสร็จ</span>
        </label>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className={`flex-[2] px-4 py-3 text-white rounded-xl font-medium text-lg disabled:opacity-50 transition-colors ${
              paymentType === 'credit'
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {submitting
              ? 'กำลังบันทึก...'
              : paymentType === 'credit'
                ? 'ยืนยันการเชื่อ'
                : 'ยืนยันการขาย'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
