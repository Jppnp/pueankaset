import React, { useEffect, useState } from 'react'
import { formatBaht } from '../../lib/format'

interface SaleNotificationProps {
  total: number | null
  onDismiss: () => void
}

export function SaleNotification({ total, onDismiss }: SaleNotificationProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (total !== null) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(onDismiss, 300)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [total, onDismiss])

  if (total === null) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="bg-green-600 text-white px-6 py-4 rounded-xl shadow-lg">
        <p className="text-sm font-medium">ขายสำเร็จ</p>
        <p className="text-2xl font-bold">{formatBaht(total)}</p>
      </div>
    </div>
  )
}
