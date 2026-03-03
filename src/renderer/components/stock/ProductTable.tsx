import React from 'react'
import type { Product } from '../../lib/types'
import { formatBaht } from '../../lib/format'

interface ProductTableProps {
  products: Product[]
  loading: boolean
  onEdit: (product: Product) => void
}

export function ProductTable({ products, loading, onEdit }: ProductTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        กำลังโหลด...
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 text-left text-sm text-gray-600">
            <th className="px-4 py-3 font-medium">ชื่อสินค้า</th>
            <th className="px-4 py-3 font-medium">รายละเอียด</th>
            <th className="px-4 py-3 font-medium text-right">ราคาทุน</th>
            <th className="px-4 py-3 font-medium text-right">ราคาขาย</th>
            <th className="px-4 py-3 font-medium text-right">คงเหลือ</th>
            <th className="px-4 py-3 font-medium text-center">ไม่คิดกำไร</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {products.map((product) => (
            <tr key={product.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium">{product.name}</td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {product.description || '-'}
              </td>
              <td className="px-4 py-3 text-right text-sm">
                {formatBaht(product.cost_price)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-medium text-green-700">
                {formatBaht(product.sale_price)}
              </td>
              <td className="px-4 py-3 text-right text-sm">{product.stock_on_hand}</td>
              <td className="px-4 py-3 text-center">
                {product.exclude_from_profit ? (
                  <span className="text-amber-600 text-sm">ใช่</span>
                ) : (
                  <span className="text-gray-300 text-sm">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onEdit(product)}
                  className="text-sm text-green-600 hover:text-green-800 font-medium"
                >
                  แก้ไข
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {products.length === 0 && (
        <div className="text-center py-12 text-gray-400">ไม่มีสินค้า</div>
      )}
    </div>
  )
}
