import React, { useState, useEffect, useCallback } from 'react'
import { formatBaht, formatPaymentType, formatThaiDate } from '../../lib/format'
import { PaymentDialog } from './PaymentDialog'
import { CustomerForm } from './CustomerForm'
import type { Customer, DebtSummary, Sale, CustomerPayment, PaginatedResult } from '../../lib/types'

interface Props {
  customerId: number | null
  onRefreshList: () => void
}

function formatCustomerPaymentKind(kind: CustomerPayment['payment_kind']): string {
  if (kind === 'deposit') return 'มัดจำ'
  if (kind === 'adjustment') return 'ปรับปรุงยอด'
  return 'ชำระหนี้'
}

function customerPaymentClassName(kind: CustomerPayment['payment_kind']): string {
  if (kind === 'deposit') return 'bg-blue-50 text-blue-700'
  if (kind === 'adjustment') return 'bg-amber-50 text-amber-700'
  return 'bg-green-50 text-green-700'
}

export function CustomerDetail({ customerId, onRefreshList }: Props) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [debt, setDebt] = useState<DebtSummary | null>(null)
  const [sales, setSales] = useState<PaginatedResult<Sale> | null>(null)
  const [payments, setPayments] = useState<CustomerPayment[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'history' | 'payments'>('history')
  const [showPayment, setShowPayment] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [salesPage, setSalesPage] = useState(1)

  const fetchDetail = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    try {
      const [cust, debtData, salesData, paymentsData] = await Promise.all([
        window.api.getCustomer(customerId),
        window.api.getCustomerDebtSummary(customerId),
        window.api.getCustomerPurchaseHistory({ customerId, page: salesPage, pageSize: 20 }),
        window.api.getCustomerPayments(customerId)
      ])
      setCustomer(cust)
      setDebt(debtData)
      setSales(salesData)
      setPayments(paymentsData)
    } finally {
      setLoading(false)
    }
  }, [customerId, salesPage])

  useEffect(() => {
    if (customerId) {
      setSalesPage(1)
      setTab('history')
    }
    setCustomer(null)
    setDebt(null)
    setSales(null)
    setPayments([])
  }, [customerId])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const handlePaymentSaved = () => {
    fetchDetail()
    onRefreshList()
  }

  const handleCustomerSaved = () => {
    fetchDetail()
    onRefreshList()
  }

  if (!customerId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        เลือกลูกค้าเพื่อดูรายละเอียด
      </div>
    )
  }

  if (loading && !customer) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">กำลังโหลด...</div>
    )
  }

  if (!customer) return null
  const depositBalance = debt?.deposit_balance ?? Math.max(0, -(debt?.outstanding ?? 0))

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Customer info */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{customer.name}</h3>
          {customer.phone && <p className="text-sm text-gray-500">{customer.phone}</p>}
          {customer.address && <p className="text-sm text-gray-500">{customer.address}</p>}
        </div>
        <button
          onClick={() => setShowEdit(true)}
          className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          แก้ไข
        </button>
      </div>

      {/* Debt summary */}
      {debt && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-500">ยอดเชื่อทั้งหมด</p>
            <p className="text-lg font-bold text-orange-600">{formatBaht(debt.total_credit)}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <p className="text-xs text-gray-500">ชำระ/มัดจำแล้ว</p>
            <p className="text-lg font-bold text-green-600">{formatBaht(debt.total_paid)}</p>
          </div>
          <div className={`${debt.outstanding > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'} border rounded-lg px-4 py-3`}>
            <p className="text-xs text-gray-500">ค้างชำระ</p>
            <p className={`text-lg font-bold ${debt.outstanding > 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {formatBaht(Math.max(0, debt.outstanding))}
            </p>
          </div>
          <div className={`${depositBalance > 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'} border rounded-lg px-4 py-3`}>
            <p className="text-xs text-gray-500">มัดจำคงเหลือ</p>
            <p className={`text-lg font-bold ${depositBalance > 0 ? 'text-blue-600' : 'text-gray-600'}`}>
              {formatBaht(depositBalance)}
            </p>
          </div>
        </div>
      )}

      {/* Record money buttons */}
      {debt && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowPayment(true)}
            disabled={debt.outstanding <= 0}
            className="px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            รับชำระหนี้
          </button>
          <button
            onClick={() => setShowDeposit(true)}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            รับเงินมัดจำ
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'history'
              ? 'border-green-500 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          ประวัติการซื้อ {sales ? `(${sales.total})` : ''}
        </button>
        <button
          onClick={() => setTab('payments')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'payments'
              ? 'border-green-500 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          ประวัติการชำระ/มัดจำ ({payments.length})
        </button>
      </div>

      {/* Tab content */}
      {tab === 'history' && sales && (
        <div className="space-y-2">
          {sales.data.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีประวัติการซื้อ</p>
          ) : (
            sales.data.map((sale) => (
              <div key={sale.id} className="bg-gray-50 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900">#{sale.id}</span>
                    <span className="text-xs text-gray-500 ml-2">{formatThaiDate(sale.date)}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">{formatBaht(sale.total_amount)}</span>
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                      sale.payment_type === 'credit'
                        ? 'bg-orange-100 text-orange-700'
                        : sale.payment_type === 'card'
                          ? 'bg-blue-100 text-blue-700'
                          : sale.payment_type === 'transfer'
                            ? 'bg-cyan-100 text-cyan-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                      {formatPaymentType(sale.payment_type)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="space-y-2">
          {payments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีประวัติการชำระ</p>
          ) : (
            payments.map((p) => (
              <div key={p.id} className={`${customerPaymentClassName(p.payment_kind)} rounded-lg px-4 py-3`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{formatThaiDate(p.date)}</span>
                      <span className="text-xs font-medium">{formatCustomerPaymentKind(p.payment_kind)}</span>
                    </div>
                    {p.note && <p className="text-xs text-gray-500 mt-0.5">{p.note}</p>}
                  </div>
                  <span className="font-semibold">+{formatBaht(p.amount)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Dialogs */}
      {debt && (
        <PaymentDialog
          open={showPayment}
          onClose={() => setShowPayment(false)}
          customerName={customer.name}
          outstanding={debt.outstanding}
          depositBalance={depositBalance}
          customerId={customer.id}
          mode="payment"
          onSave={handlePaymentSaved}
        />
      )}

      {debt && (
        <PaymentDialog
          open={showDeposit}
          onClose={() => setShowDeposit(false)}
          customerName={customer.name}
          outstanding={debt.outstanding}
          depositBalance={depositBalance}
          customerId={customer.id}
          mode="deposit"
          onSave={handlePaymentSaved}
        />
      )}

      <CustomerForm
        open={showEdit}
        onClose={() => setShowEdit(false)}
        customer={customer}
        onSave={handleCustomerSaved}
      />
    </div>
  )
}
