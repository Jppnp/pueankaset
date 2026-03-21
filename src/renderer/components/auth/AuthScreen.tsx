import React, { useState } from 'react'
import { useRole } from '../../contexts/RoleContext'

export function AuthScreen() {
  const { setRole } = useRole()
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleOwnerClick = () => {
    setShowPassword(true)
    setPassword('')
    setError('')
  }

  const handleEmployeeClick = () => {
    setRole('employee')
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await window.api.verifyOwnerPassword(password)
      if (result?.success) {
        setRole('owner')
      } else {
        setError(result?.error ?? 'รหัสผ่านไม่ถูกต้อง')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setShowPassword(false)
    setPassword('')
    setError('')
  }

  return (
    <div className="flex items-center justify-center h-screen bg-green-50">
      <div className="w-full max-w-md px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-800">เพื่อนเกษตร</h1>
          <p className="text-gray-500 mt-1">ระบบขายหน้าร้าน</p>
        </div>

        {!showPassword ? (
          <div className="space-y-4">
            <p className="text-center text-gray-600 mb-6">เลือกบทบาทเพื่อเข้าใช้งาน</p>
            <button
              onClick={handleOwnerClick}
              className="w-full py-4 bg-green-600 text-white rounded-xl font-semibold text-lg hover:bg-green-700 transition-colors"
            >
              เจ้าของร้าน
            </button>
            <button
              onClick={handleEmployeeClick}
              className="w-full py-4 bg-white text-green-700 border-2 border-green-600 rounded-xl font-semibold text-lg hover:bg-green-50 transition-colors"
            >
              พนักงาน
            </button>
          </div>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <p className="text-center text-gray-600 mb-2">กรอกรหัสผ่านเจ้าของร้าน</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="รหัสผ่าน"
              autoFocus
              aria-label="รหัสผ่านเจ้าของร้าน"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {error && <p role="alert" className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
            >
              กลับ
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
