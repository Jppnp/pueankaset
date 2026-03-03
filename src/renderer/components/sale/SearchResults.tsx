import React from 'react'
import type { Product } from '../../lib/types'
import { formatBaht } from '../../lib/format'

interface SearchResultsProps {
  results: Product[]
  loading: boolean
  onSelect: (product: Product) => void
  query: string
}

export function SearchResults({ results, loading, onSelect, query }: SearchResultsProps) {
  if (!query.trim()) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p>พิมพ์ชื่อสินค้าเพื่อค้นหา</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p>กำลังค้นหา...</p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p>ไม่พบสินค้า &ldquo;{query}&rdquo;</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {results.map((product) => (
        <button
          key={product.id}
          onClick={() => onSelect(product)}
          className="w-full text-left px-4 py-3 hover:bg-green-50 border-b border-gray-100 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{product.name}</p>
              {product.description && (
                <p className="text-sm text-gray-500">{product.description}</p>
              )}
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className="font-semibold text-green-700">{formatBaht(product.sale_price)}</p>
              <p className="text-xs text-gray-400">คงเหลือ {product.stock_on_hand}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
