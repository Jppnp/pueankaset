import React from 'react'
import type { LowStockProduct } from '../../lib/types'

interface Props {
  products: LowStockProduct[]
}

export function LowStockAlerts({ products }: Props) {
  if (products.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3">สินค้าใกล้หมด</h3>
        <p className="text-sm text-green-600 text-center py-4">สต็อกสินค้าอยู่ในระดับปกติ</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-3">
        สินค้าใกล้หมด
        <span className="ml-2 text-xs font-normal text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
          {products.length} รายการ
        </span>
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {products.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between px-3 py-2 rounded-lg ${
              p.stock_on_hand === 0 ? 'bg-red-50' : 'bg-orange-50'
            }`}
          >
            <span className="text-sm text-gray-900">{p.name}</span>
            <span
              className={`text-sm font-semibold ${
                p.stock_on_hand === 0 ? 'text-red-600' : 'text-orange-600'
              }`}
            >
              {p.stock_on_hand === 0 ? 'หมด' : `เหลือ ${p.stock_on_hand}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
