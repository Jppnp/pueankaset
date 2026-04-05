import React, { useState, useEffect } from 'react'
import { Modal } from '../shared/Modal'
import { formatThaiDate } from '../../lib/format'
import type { BackupFile, BackupInfo } from '../../lib/types'

interface BackupDialogProps {
  open: boolean
  onClose: () => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BackupDialog({ open, onClose }: BackupDialogProps) {
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [info, setInfo] = useState<BackupInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (open) {
      loadData()
      setMessage(null)
    }
  }, [open])

  const loadData = async () => {
    try {
      const [backupList, backupInfo] = await Promise.all([
        window.api.backupList(),
        window.api.backupInfo()
      ])
      setBackups(backupList)
      setInfo(backupInfo)
    } catch {
      // ignore
    }
  }

  const handleExport = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const result = await window.api.backupExport()
      if (result.success) {
        setMessage({ type: 'success', text: `สำรองข้อมูลสำเร็จ` })
        loadData()
      } else if (result.error !== 'ยกเลิก') {
        setMessage({ type: 'error', text: result.error || 'เกิดข้อผิดพลาด' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการสำรองข้อมูล' })
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async () => {
    const confirmed = window.confirm(
      'คำเตือน: การกู้คืนข้อมูลจะแทนที่ข้อมูลปัจจุบันทั้งหมด\n\n' +
        'ระบบจะสำรองข้อมูลปัจจุบันไว้ก่อนกู้คืน\n' +
        'แอปจะรีสตาร์ทหลังกู้คืนเสร็จ\n\n' +
        'ต้องการดำเนินการต่อหรือไม่?'
    )
    if (!confirmed) return

    setLoading(true)
    setMessage(null)
    try {
      const result = await window.api.backupRestore()
      if (result.success && result.needsRestart) {
        setMessage({
          type: 'success',
          text: 'กู้คืนข้อมูลสำเร็จ กรุณาปิดและเปิดแอปใหม่'
        })
      } else if (result.error !== 'ยกเลิก') {
        setMessage({ type: 'error', text: result.error || 'เกิดข้อผิดพลาด' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการกู้คืนข้อมูล' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="สำรองและกู้คืนข้อมูล" width="max-w-xl">
      <div className="space-y-5">
        {/* Status message */}
        {message && (
          <div
            className={`px-4 py-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* DB info */}
        {info && (
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600 space-y-1">
            <div>
              ขนาดฐานข้อมูล: <span className="font-medium text-gray-800">{formatFileSize(info.dbSize)}</span>
            </div>
            <div>
              สำรองอัตโนมัติล่าสุด:{' '}
              <span className="font-medium text-gray-800">
                {info.lastAutoBackup ? formatThaiDate(info.lastAutoBackup) : 'ยังไม่มี'}
              </span>
            </div>
            <div className="text-xs text-gray-400">
              ระบบสำรองข้อมูลอัตโนมัติทุกครั้งที่เปิดแอป (เก็บล่าสุด 7 ไฟล์)
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={loading}
            className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
          >
            {loading ? 'กำลังดำเนินการ...' : 'สำรองข้อมูล'}
          </button>
          <button
            onClick={handleRestore}
            disabled={loading}
            className="flex-1 bg-orange-500 text-white px-4 py-3 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors font-medium"
          >
            {loading ? 'กำลังดำเนินการ...' : 'กู้คืนข้อมูล'}
          </button>
        </div>

        {/* Auto backup history */}
        {backups.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              ประวัติสำรองอัตโนมัติ
            </h3>
            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
              {backups.map((backup) => (
                <div
                  key={backup.filename}
                  className="px-3 py-2 flex items-center justify-between text-sm"
                >
                  <div>
                    <div className="text-gray-800">{formatThaiDate(backup.createdAt)}</div>
                    <div className="text-xs text-gray-400">{backup.filename}</div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatFileSize(backup.size)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
