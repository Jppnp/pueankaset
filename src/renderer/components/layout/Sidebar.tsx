import React from 'react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/', label: 'ขายสินค้า', icon: '🛒' },
  { path: '/stock', label: 'คลังสินค้า', icon: '📦' },
  { path: '/history', label: 'ประวัติการขาย', icon: '📋' }
]

export function Sidebar() {
  return (
    <aside className="w-56 bg-green-800 text-white flex flex-col h-screen shrink-0">
      <div className="px-4 py-5 border-b border-green-700">
        <h1 className="text-xl font-bold">เพื่อนเกษตร</h1>
        <p className="text-green-300 text-sm">ระบบขายหน้าร้าน</p>
      </div>
      <nav className="flex-1 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-green-700 text-white border-r-4 border-green-400'
                  : 'text-green-200 hover:bg-green-700/50 hover:text-white'
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-green-700 text-xs text-green-400">
        เวอร์ชัน 1.0.0
      </div>
    </aside>
  )
}
