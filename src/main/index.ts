import { app, BrowserWindow, dialog, nativeImage, screen } from 'electron'
import { join } from 'path'
import { initDatabase, closeDatabase, getDb } from './database'
import { registerProductHandlers } from './ipc/products'
import { registerSaleHandlers } from './ipc/sales'
import { registerParkedOrderHandlers } from './ipc/parked-orders'
import { registerPrinterHandlers } from './ipc/printer'
import { registerImportHandlers } from './ipc/import'
import { registerStoreHandlers } from './ipc/stores'
import { registerAuthHandlers } from './ipc/auth'
import { registerDashboardHandlers } from './ipc/dashboard'
import { registerCustomerHandlers } from './ipc/customers'
import { registerRefundHandlers } from './ipc/refunds'
import { registerExchangeHandlers } from './ipc/exchanges'
import { registerStockMovementHandlers } from './ipc/stock-movements'
import { registerExpenseHandlers } from './ipc/expenses'
import { registerBackupHandlers, runAutoBackup } from './ipc/backup'
import { registerSettingsHandlers } from './ipc/settings'
import { registerExportHandlers } from './ipc/export'
import { registerUpdaterHandlers, startAutoUpdater } from './ipc/updater'

let mainWindow: BrowserWindow | null = null

const APP_ID = 'com.pueankaset.pos'
const APP_NAME = 'เพื่อนเกษตร POS'
const UI_ZOOM_MULTIPLIER_SETTING_KEY = 'ui_zoom_multiplier'
const MIN_UI_ZOOM_MULTIPLIER = 0.5
const MAX_UI_ZOOM_MULTIPLIER = 3
const ZOOM_STEP = 1.2

app.setName(APP_NAME)
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID)
}

function createWindow(): void {
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1
  const baseZoomFactor = 1 / scaleFactor
  const initialZoomMultiplier = getSavedUiZoomMultiplier()
  const startupZoomFactor = getZoomFactor(baseZoomFactor, initialZoomMultiplier)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: APP_NAME,
    icon: getAppIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      zoomFactor: startupZoomFactor
    }
  })
  mainWindow.maximize()

  const zoomPersistence = registerZoomPersistence(mainWindow, baseZoomFactor, initialZoomMultiplier)

  // Load the renderer
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Open DevTools in dev mode
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('close', (event) => {
    if (!confirmCloseWithPendingDeliveries(mainWindow)) {
      event.preventDefault()
      return
    }
    zoomPersistence.saveCurrent()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerZoomPersistence(
  window: BrowserWindow,
  baseZoomFactor: number,
  initialZoomMultiplier: number
): { saveCurrent: () => void } {
  let uiZoomMultiplier = clampZoomMultiplier(initialZoomMultiplier)

  const applyZoom = (): void => {
    if (window.isDestroyed()) return
    window.webContents.setZoomFactor(getZoomFactor(baseZoomFactor, uiZoomMultiplier))
  }

  const saveZoom = (): void => {
    saveUiZoomMultiplier(uiZoomMultiplier)
  }

  const setZoomMultiplier = (nextMultiplier: number): void => {
    uiZoomMultiplier = clampZoomMultiplier(nextMultiplier)
    applyZoom()
    saveZoom()
  }

  const zoomIn = (): void => setZoomMultiplier(uiZoomMultiplier * ZOOM_STEP)
  const zoomOut = (): void => setZoomMultiplier(uiZoomMultiplier / ZOOM_STEP)
  const resetZoom = (): void => setZoomMultiplier(1)

  // Re-apply on every load so the UI fits display scaling plus the user's saved zoom.
  window.webContents.on('did-finish-load', applyZoom)

  window.webContents.on('zoom-changed', (event, zoomDirection) => {
    event.preventDefault()
    if (zoomDirection === 'in') {
      zoomIn()
    } else {
      zoomOut()
    }
  })

  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (!(input.control || input.meta) || input.alt) return

    if (input.key === '+' || input.key === '=') {
      event.preventDefault()
      zoomIn()
    } else if (input.key === '-' || input.key === '_') {
      event.preventDefault()
      zoomOut()
    } else if (input.key === '0') {
      event.preventDefault()
      resetZoom()
    }
  })

  return {
    saveCurrent: () => {
      if (window.isDestroyed()) return
      const currentZoomFactor = window.webContents.getZoomFactor()
      if (!Number.isFinite(currentZoomFactor) || currentZoomFactor <= 0) return

      uiZoomMultiplier = clampZoomMultiplier(currentZoomFactor / baseZoomFactor)
      saveZoom()
    }
  }
}

function getZoomFactor(baseZoomFactor: number, uiZoomMultiplier: number): number {
  return baseZoomFactor * clampZoomMultiplier(uiZoomMultiplier)
}

function clampZoomMultiplier(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(Math.max(value, MIN_UI_ZOOM_MULTIPLIER), MAX_UI_ZOOM_MULTIPLIER)
}

function getSavedUiZoomMultiplier(): number {
  try {
    const row = getDb()
      .prepare('SELECT value FROM app_settings WHERE key = ?')
      .get(UI_ZOOM_MULTIPLIER_SETTING_KEY) as { value: string } | undefined
    const parsed = row ? Number(row.value) : 1
    return clampZoomMultiplier(parsed)
  } catch (err) {
    console.error('Failed to load saved UI zoom', err)
    return 1
  }
}

function saveUiZoomMultiplier(multiplier: number): void {
  try {
    const value = clampZoomMultiplier(multiplier).toFixed(4)
    getDb()
      .prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
      .run(UI_ZOOM_MULTIPLIER_SETTING_KEY, value, value)
  } catch (err) {
    console.error('Failed to save UI zoom', err)
  }
}

function confirmCloseWithPendingDeliveries(window: BrowserWindow | null): boolean {
  const pendingCount = getPendingDeliveryCount()
  if (pendingCount === 0) return true

  const options: Electron.MessageBoxSyncOptions = {
    type: 'warning',
    title: 'ยังมีรายการรอจัดส่ง',
    message: `ยังมีรายการรอจัดส่ง ${pendingCount} รายการ`,
    detail: 'ต้องการปิดโปรแกรมตอนนี้หรือกลับไปตรวจสอบรายการก่อน?',
    buttons: ['กลับไปตรวจสอบ', 'ปิดโปรแกรม'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  }

  const choice = window
    ? dialog.showMessageBoxSync(window, options)
    : dialog.showMessageBoxSync(options)

  return choice === 1
}

function getPendingDeliveryCount(): number {
  try {
    const result = getDb()
      .prepare("SELECT COUNT(*) as total FROM sales WHERE delivery_status = 'waiting'")
      .get() as { total: number }
    return result.total
  } catch (err) {
    console.error('Failed to check pending deliveries before close', err)
    return 0
  }
}

function getAppIconPath(): string {
  if (process.platform === 'win32') {
    return app.isPackaged
      ? join(process.resourcesPath, 'icon.ico')
      : join(__dirname, '../../build/icon.ico')
  }

  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../build/icon.png')
}

function setDockIcon(): void {
  if (process.platform !== 'darwin') return

  const icon = nativeImage.createFromPath(getAppIconPath())
  if (!icon.isEmpty()) {
    app.dock.setIcon(icon)
  }
}

app.whenReady().then(() => {
  setDockIcon()

  initDatabase()

  registerProductHandlers()
  registerSaleHandlers()
  registerParkedOrderHandlers()
  registerPrinterHandlers()
  registerImportHandlers()
  registerStoreHandlers()
  registerAuthHandlers()
  registerDashboardHandlers()
  registerCustomerHandlers()
  registerRefundHandlers()
  registerExchangeHandlers()
  registerStockMovementHandlers()
  registerExpenseHandlers()
  registerBackupHandlers()
  registerSettingsHandlers()
  registerExportHandlers()
  registerUpdaterHandlers()

  // Auto-backup database on every app start
  runAutoBackup()

  createWindow()

  // Auto-update: check on startup and stream status to the renderer.
  startAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
