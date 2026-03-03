import React from 'react'

type FilterPreset = 'today' | 'month' | 'custom'

interface DateRangeFilterProps {
  preset: FilterPreset
  customFrom: string
  customTo: string
  onPresetChange: (preset: FilterPreset) => void
  onCustomFromChange: (date: string) => void
  onCustomToChange: (date: string) => void
}

export function DateRangeFilter({
  preset,
  customFrom,
  customTo,
  onPresetChange,
  onCustomFromChange,
  onCustomToChange
}: DateRangeFilterProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex bg-gray-100 rounded-lg p-1">
        {[
          { key: 'today' as FilterPreset, label: 'วันนี้' },
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
    </div>
  )
}
