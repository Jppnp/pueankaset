import React from 'react'
import type { OrderItem } from '../../lib/types'
import { formatBaht } from '../../lib/format'

interface OrderPanelProps {
  items: OrderItem[]
  total: number
  onUpdateQuantity: (productId: number, quantity: number) => void
  onUpdatePrice: (productId: number, price: number) => void
  onRemove: (productId: number) => void
  onCheckout: () => void
  onPark: () => void
}

export function OrderPanel({
  items,
  total,
  onUpdateQuantity,
  onUpdatePrice,
  onRemove,
  onCheckout,
  onPark
}: OrderPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h2 className="font-semibold text-gray-700">รายการสั่งซื้อ ({items.length} รายการ)</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>ยังไม่มีสินค้าในรายการ</p>
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.product_id} className="px-4 py-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 mr-2">
                    <p className="font-medium text-sm">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-gray-500">{item.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemove(item.product_id)}
                    className="text-red-400 hover:text-red-600 text-sm shrink-0"
                  >
                    ลบ
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
                      className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-sm font-bold"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        onUpdateQuantity(item.product_id, parseInt(e.target.value) || 0)
                      }
                      className="w-12 text-center border rounded py-0.5 text-sm"
                      min={1}
                    />
                    <button
                      onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
                      className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-sm font-bold"
                    >
                      +
                    </button>
                    <span className="text-gray-400 text-xs mx-1">x</span>
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) =>
                        onUpdatePrice(item.product_id, parseFloat(e.target.value) || 0)
                      }
                      className="w-20 text-right border rounded py-0.5 text-sm"
                      step={0.01}
                    />
                  </div>
                  <span className="font-semibold text-sm">
                    {formatBaht(item.price * item.quantity)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-semibold text-gray-700">รวมทั้งสิ้น</span>
          <span className="text-2xl font-bold text-green-700">{formatBaht(total)}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onPark}
            disabled={items.length === 0}
            className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            พักออเดอร์
          </button>
          <button
            onClick={onCheckout}
            disabled={items.length === 0}
            className="flex-[2] px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-lg"
          >
            ชำระเงิน
          </button>
        </div>
      </div>
    </div>
  )
}
