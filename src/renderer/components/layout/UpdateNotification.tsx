import React, { useEffect, useMemo, useState } from 'react'
import type { AppUpdateStatus, UpdateStage } from '../../lib/types'
import { Button } from '../shared/Button'

const activeUpdateStages: UpdateStage[] = ['available', 'downloading', 'downloaded', 'installing']
const manualOnlyStages: UpdateStage[] = ['checking', 'not-available']

export function UpdateNotification() {
  const [status, setStatus] = useState<AppUpdateStatus | null>(null)
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const [showUpdateErrors, setShowUpdateErrors] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    window.api.getUpdateStatus().then((nextStatus) => {
      if (mounted) setStatus(nextStatus)
    })

    const unsubscribe = window.api.onUpdateStatus((nextStatus) => {
      setStatus(nextStatus)
      if (activeUpdateStages.includes(nextStatus.stage)) {
        setShowUpdateErrors(true)
      }
      if (nextStatus.stage !== 'downloaded') {
        setInstalling(false)
      }
      setInstallError(null)
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  const statusKey = useMemo(() => {
    if (!status) return null
    const errorKey = status.stage === 'error' ? status.message ?? '' : ''
    return `${status.stage}:${status.version ?? ''}:${errorKey}`
  }, [status])

  if (!status || !statusKey || dismissedKey === statusKey) {
    return null
  }

  const shouldShow =
    activeUpdateStages.includes(status.stage) ||
    (manualOnlyStages.includes(status.stage) && status.startedByUser) ||
    (status.stage === 'error' && (status.startedByUser || showUpdateErrors))

  if (!shouldShow) {
    return null
  }

  const percent = clampPercent(status.percent ?? (status.stage === 'downloaded' ? 100 : 0))
  const title = getTitle(status)
  const detail = getDetail(status)

  const handleInstall = async () => {
    setInstalling(true)
    setInstallError(null)

    const result = await window.api.installUpdate()
    if (!result.success) {
      setInstalling(false)
      setInstallError(result.error ?? 'ติดตั้งอัปเดตไม่สำเร็จ')
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]"
    >
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="mt-1 text-sm text-gray-600">{detail}</p>
          </div>
          <button
            type="button"
            onClick={() => setDismissedKey(statusKey)}
            className="shrink-0 text-sm text-gray-400 transition-colors hover:text-gray-700"
          >
            ซ่อน
          </button>
        </div>

        {(status.stage === 'available' ||
          status.stage === 'downloading' ||
          status.stage === 'downloaded') && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-green-600 transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-gray-500">
              <span>{percent}%</span>
              {status.stage === 'downloading' && (
                <span>{formatTransfer(status)}</span>
              )}
            </div>
          </div>
        )}

        {installError && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{installError}</p>
        )}

        {status.stage === 'downloaded' && (
          <div className="mt-4 flex gap-2">
            <Button type="button" size="sm" onClick={handleInstall} disabled={installing}>
              {installing ? 'กำลังติดตั้ง...' : 'ติดตั้งตอนนี้'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setDismissedKey(statusKey)}
            >
              ไว้ภายหลัง
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function getTitle(status: AppUpdateStatus): string {
  switch (status.stage) {
    case 'checking':
      return 'กำลังตรวจสอบอัปเดต'
    case 'available':
      return `พบเวอร์ชันใหม่ ${status.version ?? ''}`.trim()
    case 'downloading':
      return `กำลังดาวน์โหลด ${status.version ?? ''}`.trim()
    case 'downloaded':
      return `พร้อมติดตั้ง ${status.version ?? ''}`.trim()
    case 'installing':
      return 'กำลังติดตั้งอัปเดต'
    case 'not-available':
      return 'ใช้เวอร์ชันล่าสุดแล้ว'
    case 'error':
      return 'อัปเดตไม่สำเร็จ'
    default:
      return 'อัปเดต'
  }
}

function getDetail(status: AppUpdateStatus): string {
  if (status.stage === 'downloaded') {
    return 'ปิดโปรแกรมแล้วเปิดใหม่ หรือกดติดตั้งตอนนี้'
  }

  if (status.stage === 'installing') {
    return 'โปรแกรมจะปิดและเปิดใหม่หลังติดตั้งเสร็จ'
  }

  return status.message ?? ''
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function formatTransfer(status: AppUpdateStatus): string {
  if (!status.total || !status.transferred) return ''

  return `${formatBytes(status.transferred)} / ${formatBytes(status.total)}`
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
