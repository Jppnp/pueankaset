import React from 'react'
import type { ParkedOrder } from '../../lib/types'

interface ParkedOrderBarProps {
  orders: ParkedOrder[]
  onLoad: (id: number) => void
  onDelete: (id: number) => void
}

export function ParkedOrderBar({ orders, onLoad, onDelete }: ParkedOrderBarProps) {
  if (orders.length === 0) return null

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 overflow-x-auto">
      <span className="text-sm text-amber-700 font-medium shrink-0">พักไว้:</span>
      {orders.map((order) => {
        const items = JSON.parse(order.items_json) as { name: string }[]
        const preview = items.map((i) => i.name).join(', ')
        return (
          <div
            key={order.id}
            className="flex items-center gap-1 bg-white border border-amber-300 rounded-lg px-3 py-1.5 shrink-0"
          >
            <button
              onClick={() => onLoad(order.id)}
              className="text-sm text-amber-800 hover:text-amber-900 max-w-[200px] truncate"
              title={preview}
            >
              {order.label || preview || `ออเดอร์ #${order.id}`}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(order.id)
              }}
              className="text-amber-400 hover:text-red-500 text-xs ml-1"
            >
              &times;
            </button>
          </div>
        )
      })}
    </div>
  )
}
