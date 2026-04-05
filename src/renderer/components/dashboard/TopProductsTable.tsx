import React from 'react'
import { formatBaht } from '../../lib/format'
import type { TopProduct } from '../../lib/types'

interface Props {
  products: TopProduct[]
}

export function TopProductsTable({ products }: Props) {
  if (products.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3">สินค้าขายดี</h3>
        <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีข้อมูลการขาย</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-3">สินค้าขายดี</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="pb-2 w-8">#</th>
            <th className="pb-2">สินค้า</th>
            <th className="pb-2 text-right">จำนวน</th>
            <th className="pb-2 text-right">ยอดขาย</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => (
            <tr key={p.id} className="border-b border-gray-50 last:border-0">
              <td className="py-2 text-gray-400">{i + 1}</td>
              <td className="py-2 text-gray-900">{p.name}</td>
              <td className="py-2 text-right text-gray-700">{p.total_quantity}</td>
              <td className="py-2 text-right text-gray-700">{formatBaht(p.total_revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
