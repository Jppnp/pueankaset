import React, { useMemo } from 'react'
import type { Product, Store } from '../../lib/types'
import { formatBaht } from '../../lib/format'

interface ProductTableProps {
  products: Product[]
  stores: Store[]
  loading: boolean
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  onRestore: (product: Product) => void
}

export function ProductTable({
  products,
  stores,
  loading,
  onEdit,
  onDelete,
  onRestore
}: ProductTableProps) {
  const storeMap = useMemo(() => Object.fromEntries(stores.map((s) => [s.id, s.name])), [stores])
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
            <th scope="col" className="px-4 py-3 font-medium">ชื่อสินค้า</th>
            <th scope="col" className="px-4 py-3 font-medium">รายละเอียด</th>
            <th scope="col" className="px-4 py-3 font-medium">ร้านค้า</th>
            <th scope="col" className="px-4 py-3 font-medium text-right">ราคาทุน</th>
            <th scope="col" className="px-4 py-3 font-medium text-right">ราคาขาย</th>
            <th scope="col" className="px-4 py-3 font-medium text-right">คงเหลือ</th>
            <th scope="col" className="px-4 py-3 font-medium text-center">สถานะ</th>
            <th scope="col" className="px-4 py-3 font-medium text-center">ไม่คิดกำไร</th>
            <th scope="col" className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {products.map((product) => {
            const isDeleted = product.is_deleted === 1

            return (
              <tr
                key={product.id}
                className={`transition-colors ${
                  isDeleted ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-4 py-3 font-medium">{product.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {product.description || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {storeMap[product.store_id] ?? '-'}
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  {formatBaht(product.cost_price)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium text-green-700">
                  {formatBaht(product.sale_price)}
                </td>
                <td className="px-4 py-3 text-right text-sm">{product.stock_on_hand}</td>
                <td className="px-4 py-3 text-center">
                  {isDeleted ? (
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                      ลบแล้ว
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                      ใช้งาน
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {product.exclude_from_profit ? (
                    <span className="text-amber-600 text-sm">ใช่</span>
                  ) : (
                    <span className="text-gray-300 text-sm">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                    {isDeleted ? (
                      <button
                        onClick={() => onRestore(product)}
                        className="text-sm font-medium text-green-600 hover:text-green-800"
                      >
                        กู้คืน
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => onEdit(product)}
                          className="text-sm font-medium text-green-600 hover:text-green-800"
                        >
                          แก้ไข
                        </button>
                        <button
                          onClick={() => onDelete(product)}
                          className="text-sm font-medium text-red-500 hover:text-red-700"
                        >
                          ลบ
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {products.length === 0 && (
        <div className="text-center py-12 text-gray-400">ไม่มีสินค้า</div>
      )}
    </div>
  )
}
