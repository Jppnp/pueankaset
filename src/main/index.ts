import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import { initDatabase, closeDatabase } from './database'
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

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'เพื่อนเกษตร POS',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
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

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
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

  createWindow()

  // Auto-update: check on startup, silent if offline
  if (app.isPackaged) {
    autoUpdater.logger = console
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.checkForUpdatesAndNotify().catch(() => {
      // Silent fail — offline or no release yet
    })
  }

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
