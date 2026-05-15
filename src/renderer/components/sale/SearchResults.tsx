import React, { useEffect, useRef } from 'react'
import type { Product } from '../../lib/types'
import { formatBaht } from '../../lib/format'

interface SearchResultsProps {
  results: Product[]
  loading: boolean
  onSelect: (product: Product) => void
  query: string
  focusedIndex: number | null
  onFocusedIndexChange: (index: number | null) => void
  onFocusSearch: () => void
}

export function SearchResults({
  results,
  loading,
  onSelect,
  query,
  focusedIndex,
  onFocusedIndexChange,
  onFocusSearch
}: SearchResultsProps) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (focusedIndex === null) return
    itemRefs.current[focusedIndex]?.focus()
  }, [focusedIndex, results])

  if (!query.trim()) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-gray-400">
        <p>พิมพ์ชื่อสินค้าเพื่อค้นหา</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-gray-400">
        <p>กำลังค้นหา...</p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-gray-400">
        <p>ไม่พบสินค้า &ldquo;{query}&rdquo;</p>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" role="listbox" aria-label="ผลการค้นหาสินค้า">
      {results.map((product, index) => {
        const selected = focusedIndex === index

        return (
          <button
            ref={(node) => {
              itemRefs.current[index] = node
            }}
            role="option"
            aria-selected={selected}
            key={product.id}
            onFocus={() => onFocusedIndexChange(index)}
            onClick={() => onSelect(product)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                onFocusedIndexChange(Math.min(index + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                if (index === 0) {
                  onFocusedIndexChange(null)
                  onFocusSearch()
                } else {
                  onFocusedIndexChange(index - 1)
                }
              } else if (e.key === 'Enter') {
                e.preventDefault()
                onSelect(product)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onFocusedIndexChange(null)
                onFocusSearch()
              }
            }}
            className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500 ${
              selected ? 'bg-green-50' : 'hover:bg-green-50'
            }`}
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
        )
      })}
    </div>
  )
}
