import React from 'react'
import { formatBaht } from '../../lib/format'
import type { Product } from '../../lib/types'

type FilterPreset = 'today' | 'yesterday' | 'month' | 'custom'

interface DateRangeFilterProps {
  preset: FilterPreset
  customFrom: string
  customTo: string
  itemSearch: string
  itemResults: Product[]
  itemSearchLoading: boolean
  selectedItem: Product | null
  onPresetChange: (preset: FilterPreset) => void
  onCustomFromChange: (date: string) => void
  onCustomToChange: (date: string) => void
  onItemSearchChange: (query: string) => void
  onItemSelect: (product: Product) => void
  onClearItem: () => void
}

export function DateRangeFilter({
  preset,
  customFrom,
  customTo,
  itemSearch,
  itemResults,
  itemSearchLoading,
  selectedItem,
  onPresetChange,
  onCustomFromChange,
  onCustomToChange,
  onItemSearchChange,
  onItemSelect,
  onClearItem
}: DateRangeFilterProps) {
  const showItemResults = itemSearch.trim().length > 0

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex bg-gray-100 rounded-lg p-1">
        {[
          { key: 'today' as FilterPreset, label: 'วันนี้' },
          { key: 'yesterday' as FilterPreset, label: 'เมื่อวาน' },
          { key: 'month' as FilterPreset, label: 'เดือนนี้' },
          { key: 'custom' as FilterPreset, label: 'กำหนดเอง' }
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => onPresetChange(item.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              preset === item.key
                ? 'bg-white text-green-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <span className="text-gray-400">ถึง</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      )}

      <div className="relative flex min-w-[300px] max-w-2xl flex-1 items-center gap-2">
        <span className="text-sm text-gray-500 shrink-0">สินค้า:</span>
        <div className="min-w-0 flex-1">
          <input
            type="search"
            value={itemSearch}
            onChange={(e) => onItemSearchChange(e.target.value)}
            placeholder={selectedItem ? 'ค้นหาสินค้าอื่น...' : 'ค้นหาสินค้าเพื่อกรอง...'}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {showItemResults && (
            <div className="absolute left-14 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {itemSearchLoading ? (
                <div className="px-4 py-3 text-sm text-gray-400">กำลังค้นหา...</div>
              ) : itemResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400">ไม่พบสินค้า &ldquo;{itemSearch}&rdquo;</div>
              ) : (
                itemResults.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => onItemSelect(product)}
                    className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-2 text-left transition-colors last:border-b-0 hover:bg-green-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">{product.name}</span>
                      {product.description && (
                        <span className="block truncate text-xs text-gray-500">{product.description}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-xs font-semibold text-green-700">{formatBaht(product.sale_price)}</span>
                      <span className="block text-xs text-gray-400">คงเหลือ {product.stock_on_hand}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {selectedItem && (
          <div className="flex max-w-[220px] items-center gap-2 rounded-lg bg-green-50 px-3 py-1.5 text-sm text-green-800">
            <span className="truncate">{selectedItem.name}</span>
            <button
              type="button"
              onClick={onClearItem}
              className="shrink-0 text-green-600 hover:text-green-900"
              aria-label="ล้างตัวกรองสินค้า"
            >
              &times;
            </button>
          </div>
        )}
        {itemSearch && (
          <button
            type="button"
            onClick={() => onItemSearchChange('')}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ล้างคำค้น
          </button>
        )}
      </div>
    </div>
  )
}
