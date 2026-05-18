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

app.setName(APP_NAME)
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID)
}

function createWindow(): void {
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1
  const zoomFactor = 1 / scaleFactor

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
      zoomFactor
    }
  })
  mainWindow.maximize()

  // Re-apply on every load so the UI fits regardless of OS display scaling.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.setZoomFactor(zoomFactor)
  })

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
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
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
