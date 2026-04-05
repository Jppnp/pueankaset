import React from 'react'
import { formatBaht } from '../../lib/format'

interface Props {
  totalOutstanding: number
  customerCount: number
}

export function DebtSummaryCard({ totalOutstanding, customerCount }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-3">ยอดหนี้ค้างชำระ</h3>
      {totalOutstanding > 0 ? (
        <div className="space-y-2">
          <p className="text-2xl font-bold text-red-600">{formatBaht(totalOutstanding)}</p>
          <p className="text-sm text-gray-500">{customerCount} ลูกค้า</p>
        </div>
      ) : (
        <p className="text-sm text-green-600">ไม่มียอดค้างชำระ</p>
      )}
    </div>
  )
}
