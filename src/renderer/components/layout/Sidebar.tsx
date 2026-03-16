import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useRole } from '../../contexts/RoleContext'
import { ChangePasswordDialog } from '../auth/ChangePasswordDialog'

const allNavItems = [
  { path: '/', label: 'ขายสินค้า', icon: '🛒', ownerOnly: false },
  { path: '/stock', label: 'คลังสินค้า', icon: '📦', ownerOnly: true },
  { path: '/history', label: 'ประวัติการขาย', icon: '📋', ownerOnly: false }
]

export function Sidebar() {
  const { role, isOwner, logout } = useRole()
  const navigate = useNavigate()
  const [showChangePassword, setShowChangePassword] = useState(false)

  const navItems = allNavItems.filter((item) => !item.ownerOnly || isOwner)

  const handleSwitchRole = () => {
    logout()
    navigate('/')
  }

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
      <div className="px-4 py-3 border-t border-green-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-green-200">
            {role === 'owner' ? 'เจ้าของร้าน' : 'พนักงาน'}
          </span>
          <button
            onClick={handleSwitchRole}
            className="text-xs text-green-400 hover:text-white transition-colors"
          >
            เปลี่ยนบทบาท
          </button>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowChangePassword(true)}
            className="text-xs text-green-400 hover:text-white transition-colors mb-2"
          >
            เปลี่ยนรหัสผ่าน
          </button>
        )}
        <div className="text-xs text-green-400">เวอร์ชัน 1.0.0</div>
      </div>
      <ChangePasswordDialog
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </aside>
  )
}
