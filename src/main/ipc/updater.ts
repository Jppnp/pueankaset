import { BrowserWindow, app, ipcMain } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateDownloadedEvent, type UpdateInfo } from 'electron-updater'

type UpdateStage =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'not-available'
  | 'error'

interface AppUpdateStatus {
  stage: UpdateStage
  supported: boolean
  currentVersion: string
  version?: string
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
  message?: string
  startedByUser?: boolean
  updatedAt: string
}

const UPDATE_STATUS_CHANNEL = 'app-update:status'

let listenersRegistered = false
let lastCheckStartedByUser = false

let updateStatus: AppUpdateStatus = {
  stage: 'idle',
  supported: app.isPackaged,
  currentVersion: app.getVersion(),
  updatedAt: new Date().toISOString()
}

export function registerUpdaterHandlers(): void {
  registerAutoUpdaterListeners()

  ipcMain.handle('app-update:get-status', () => updateStatus)

  ipcMain.handle('app-update:check', async () => {
    await checkForUpdates(true)
    return updateStatus
  })

  ipcMain.handle('app-update:install', () => {
    if (updateStatus.stage !== 'downloaded') {
      return { success: false, error: 'ยังดาวน์โหลดอัปเดตไม่เสร็จ' }
    }

    setUpdateStatus({
      stage: 'installing',
      message: 'กำลังปิดโปรแกรมเพื่อติดตั้งอัปเดต'
    })

    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true)
    }, 250)

    return { success: true }
  })
}

export function startAutoUpdater(): void {
  registerAutoUpdaterListeners()

  if (!app.isPackaged) {
    setUpdateStatus({
      stage: 'idle',
      supported: false,
      message: 'ระบบอัปเดตอัตโนมัติทำงานเฉพาะแอปที่ติดตั้งแล้ว'
    })
    return
  }

  autoUpdater.logger = console
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  void checkForUpdates(false)
}

async function checkForUpdates(startedByUser: boolean): Promise<void> {
  lastCheckStartedByUser = startedByUser

  if (!app.isPackaged) {
    setUpdateStatus({
      stage: 'error',
      supported: false,
      startedByUser,
      message: 'ระบบอัปเดตอัตโนมัติใช้งานได้หลังติดตั้งโปรแกรมแล้วเท่านั้น'
    })
    return
  }

  if (updateStatus.stage === 'downloading' || updateStatus.stage === 'downloaded') {
    if (startedByUser) {
      setUpdateStatus({ startedByUser: true })
    }
    return
  }

  setUpdateStatus({
    stage: 'checking',
    supported: true,
    startedByUser,
    version: undefined,
    percent: undefined,
    transferred: undefined,
    total: undefined,
    bytesPerSecond: undefined,
    message: 'กำลังตรวจสอบอัปเดต'
  })

  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ตรวจสอบอัปเดตไม่สำเร็จ'
    setUpdateStatus({
      stage: 'error',
      supported: true,
      startedByUser,
      message
    })
  }
}

function registerAutoUpdaterListeners(): void {
  if (listenersRegistered) return
  listenersRegistered = true

  autoUpdater.on('checking-for-update', () => {
    setUpdateStatus({
      stage: 'checking',
      supported: app.isPackaged,
      startedByUser: lastCheckStartedByUser,
      message: 'กำลังตรวจสอบอัปเดต'
    })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    setUpdateStatus({
      stage: 'available',
      supported: true,
      startedByUser: lastCheckStartedByUser,
      version: info.version,
      percent: 0,
      transferred: 0,
      total: undefined,
      bytesPerSecond: undefined,
      message: `พบเวอร์ชันใหม่ ${info.version}`
    })
  })

  autoUpdater.on('download-progress', (info: ProgressInfo) => {
    setUpdateStatus({
      stage: 'downloading',
      supported: true,
      startedByUser: lastCheckStartedByUser,
      percent: info.percent,
      transferred: info.transferred,
      total: info.total,
      bytesPerSecond: info.bytesPerSecond,
      message: 'กำลังดาวน์โหลดอัปเดต'
    })
  })

  autoUpdater.on('update-downloaded', (event: UpdateDownloadedEvent) => {
    setUpdateStatus({
      stage: 'downloaded',
      supported: true,
      startedByUser: lastCheckStartedByUser,
      version: event.version,
      percent: 100,
      transferred: event.files?.[0]?.size,
      total: event.files?.[0]?.size,
      bytesPerSecond: undefined,
      message: 'ดาวน์โหลดอัปเดตเสร็จแล้ว'
    })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    setUpdateStatus({
      stage: 'not-available',
      supported: true,
      startedByUser: lastCheckStartedByUser,
      version: info.version,
      percent: undefined,
      transferred: undefined,
      total: undefined,
      bytesPerSecond: undefined,
      message: 'ใช้เวอร์ชันล่าสุดแล้ว'
    })
  })

  autoUpdater.on('error', (err: Error) => {
    setUpdateStatus({
      stage: 'error',
      supported: app.isPackaged,
      startedByUser: lastCheckStartedByUser,
      message: err.message || 'ตรวจสอบหรือดาวน์โหลดอัปเดตไม่สำเร็จ'
    })
  })
}

function setUpdateStatus(next: Partial<AppUpdateStatus>): AppUpdateStatus {
  updateStatus = {
    ...updateStatus,
    currentVersion: app.getVersion(),
    supported: app.isPackaged,
    ...next,
    updatedAt: new Date().toISOString()
  }

  broadcastUpdateStatus(updateStatus)
  return updateStatus
}

function broadcastUpdateStatus(status: AppUpdateStatus): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(UPDATE_STATUS_CHANNEL, status)
    }
  }
}
