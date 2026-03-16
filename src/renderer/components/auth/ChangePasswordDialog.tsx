import React, { useState } from 'react'
import { Modal } from '../shared/Modal'

interface ChangePasswordDialogProps {
  open: boolean
  onClose: () => void
}

export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    setSuccess(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่ไม่ตรงกัน')
      return
    }

    if (!newPassword) {
      setError('กรุณากรอกรหัสผ่านใหม่')
      return
    }

    setLoading(true)
    const result = await window.api.changeOwnerPassword(currentPassword, newPassword)
    setLoading(false)

    if (result.success) {
      setSuccess(true)
    } else {
      setError(result.error ?? 'เกิดข้อผิดพลาด')
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="เปลี่ยนรหัสผ่านเจ้าของร้าน">
      {success ? (
        <div className="space-y-4">
          <p className="text-green-600 font-medium text-center py-4">
            เปลี่ยนรหัสผ่านสำเร็จ
          </p>
          <button
            onClick={handleClose}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
          >
            ตกลง
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              รหัสผ่านปัจจุบัน
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              รหัสผ่านใหม่
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ยืนยันรหัสผ่านใหม่
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
