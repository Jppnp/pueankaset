import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { getDb, getDbPath, initializeDatabaseSchema } from '../database'

const BACKUP_DIR_NAME = 'backups'
const MAX_AUTO_BACKUPS = 7
const SETTING_KEY_BACKUP_PATH = 'backup_folder_path'

interface BackupInspection {
  kind: 'current' | 'legacy'
}

interface LegacyProduct {
  id: number
  name: string
  description: string | null
  cost_price: number
  sale_price: number
  stockOnHand: number
}

interface LegacySale {
  id: number
  date: string
  remark: string | null
}

interface LegacySaleItem {
  id: number
  sale_id: number
  product_id: number
  quantity: number
  price: number
  cost_price: number
}

function getDefaultBackupDir(): string {
  return path.join(app.getPath('userData'), BACKUP_DIR_NAME)
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function generateBackupFilename(prefix: string): string {
  const now = new Date()
  const ts = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`
  return `pueankaset_${prefix}_${ts}.db`
}

function getSavedBackupPath(): string | null {
  try {
    const db = getDb()
    const row = db
      .prepare("SELECT value FROM app_settings WHERE key = ?")
      .get(SETTING_KEY_BACKUP_PATH) as { value: string } | undefined
    return row?.value ?? null
  } catch {
    return null
  }
}

function saveBackupPath(folderPath: string): void {
  const db = getDb()
  db.prepare(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?"
  ).run(SETTING_KEY_BACKUP_PATH, folderPath, folderPath)
}

function getTableNames(db: Database.Database): string[] {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as { name: string }[]
  return tables.map((table) => table.name)
}

function getColumnNames(db: Database.Database, tableName: string): string[] {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[]
  return columns.map((column) => column.name)
}

function inspectBackupDatabase(sourcePath: string): BackupInspection {
  const testDb = new Database(sourcePath, { readonly: true })

  try {
    const integrity = testDb.prepare('PRAGMA integrity_check').pluck().get() as string
    if (integrity !== 'ok') {
      throw new Error('ไฟล์ฐานข้อมูลเสียหาย')
    }

    const tableNames = getTableNames(testDb)
    const hasRequiredTables = ['products', 'sales', 'sale_items'].every((tableName) =>
      tableNames.includes(tableName)
    )

    if (!hasRequiredTables) {
      throw new Error('ไฟล์นี้ไม่ใช่ฐานข้อมูลเพื่อนเกษตร')
    }

    const productColumns = getColumnNames(testDb, 'products')
    const saleColumns = getColumnNames(testDb, 'sales')
    const saleItemColumns = getColumnNames(testDb, 'sale_items')

    const isCurrentSchema =
      productColumns.includes('stock_on_hand') &&
      saleColumns.includes('total_amount') &&
      saleItemColumns.includes('cost_price')

    if (isCurrentSchema) {
      return { kind: 'current' }
    }

    const isLegacySchema =
      productColumns.includes('stockOnHand') &&
      !productColumns.includes('stock_on_hand') &&
      !saleColumns.includes('total_amount') &&
      saleItemColumns.includes('cost_price')

    if (isLegacySchema) {
      return { kind: 'legacy' }
    }

    throw new Error('ไฟล์สำรองนี้เป็นโครงสร้างฐานข้อมูลที่ยังไม่รองรับ')
  } finally {
    testDb.close()
  }
}

function toSqliteDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value.replace('T', ' ').replace(/\.\d+Z?$/, '').replace(/Z$/, '')
  }

  const year = parsed.getUTCFullYear()
  const month = (parsed.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = parsed.getUTCDate().toString().padStart(2, '0')
  const hours = parsed.getUTCHours().toString().padStart(2, '0')
  const minutes = parsed.getUTCMinutes().toString().padStart(2, '0')
  const seconds = parsed.getUTCSeconds().toString().padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function convertLegacyBackup(sourcePath: string, targetPath: string): void {
  const sourceDb = new Database(sourcePath, { readonly: true })
  const targetDb = new Database(targetPath)

  try {
    targetDb.pragma('foreign_keys = ON')
    initializeDatabaseSchema(targetDb)

    const products = sourceDb
      .prepare(
        `SELECT id, name, description, cost_price, sale_price, stockOnHand
         FROM products
         ORDER BY id`
      )
      .all() as LegacyProduct[]

    const sales = sourceDb
      .prepare('SELECT id, date, remark FROM sales ORDER BY id')
      .all() as LegacySale[]

    const saleItems = sourceDb
      .prepare(
        `SELECT id, sale_id, product_id, quantity, price, cost_price
         FROM sale_items
         ORDER BY id`
      )
      .all() as LegacySaleItem[]

    const saleTotals = new Map<number, number>()
    for (const item of saleItems) {
      saleTotals.set(item.sale_id, (saleTotals.get(item.sale_id) ?? 0) + item.quantity * item.price)
    }

    const copyLegacyData = targetDb.transaction(() => {
      const insertProduct = targetDb.prepare(
        `INSERT INTO products (
          id, name, description, cost_price, sale_price, stock_on_hand,
          exclude_from_profit, store_id
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 1)`
      )

      for (const product of products) {
        insertProduct.run(
          product.id,
          product.name,
          product.description,
          product.cost_price,
          product.sale_price,
          product.stockOnHand
        )
      }

      const insertSale = targetDb.prepare(
        `INSERT INTO sales (
          id, date, total_amount, remark, seller_role, customer_id, payment_type
        ) VALUES (?, ?, ?, ?, 'owner', NULL, 'cash')`
      )

      for (const sale of sales) {
        insertSale.run(
          sale.id,
          toSqliteDateTime(sale.date),
          saleTotals.get(sale.id) ?? 0,
          sale.remark
        )
      }

      const insertSaleItem = targetDb.prepare(
        `INSERT INTO sale_items (id, sale_id, product_id, quantity, price, cost_price)
         VALUES (?, ?, ?, ?, ?, ?)`
      )

      for (const item of saleItems) {
        insertSaleItem.run(
          item.id,
          item.sale_id,
          item.product_id,
          item.quantity,
          item.price,
          item.cost_price
        )
      }
    })

    copyLegacyData()

    const foreignKeyIssues = targetDb.prepare('PRAGMA foreign_key_check').all()
    if (foreignKeyIssues.length > 0) {
      throw new Error('ข้อมูลเดิมมีความสัมพันธ์สินค้า/รายการขายไม่สมบูรณ์')
    }

    const integrity = targetDb.prepare('PRAGMA integrity_check').pluck().get() as string
    if (integrity !== 'ok') {
      throw new Error('แปลงไฟล์สำรองไม่สำเร็จ')
    }
  } finally {
    sourceDb.close()
    targetDb.close()
  }
}

export function runAutoBackup(): void {
  try {
    const backupDir = getDefaultBackupDir()
    ensureDir(backupDir)

    const filename = generateBackupFilename('auto')
    const destPath = path.join(backupDir, filename)

    const db = getDb()
    db.backup(destPath)

    // Clean up old auto backups, keep only MAX_AUTO_BACKUPS
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('pueankaset_auto_') && f.endsWith('.db'))
      .sort()

    while (files.length > MAX_AUTO_BACKUPS) {
      const oldest = files.shift()!
      fs.unlinkSync(path.join(backupDir, oldest))
    }

    console.log(`Auto backup created: ${destPath}`)
  } catch (err) {
    console.error('Auto backup failed:', err)
  }
}

export function registerBackupHandlers(): void {
  // Manual backup: let user choose save location
  ipcMain.handle('backup:export', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'ไม่พบหน้าต่างหลัก' }

    const defaultDir = getSavedBackupPath() || app.getPath('documents')
    const filename = generateBackupFilename('backup')

    const result = await dialog.showSaveDialog(win, {
      title: 'สำรองข้อมูล',
      defaultPath: path.join(defaultDir, filename),
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'ยกเลิก' }
    }

    try {
      const db = getDb()
      db.backup(result.filePath)

      // Remember the folder for next time
      saveBackupPath(path.dirname(result.filePath))

      return { success: true, path: result.filePath }
    } catch (err) {
      return { success: false, error: `สำรองข้อมูลไม่สำเร็จ: ${(err as Error).message}` }
    }
  })

  // Restore from backup file
  ipcMain.handle('backup:restore', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'ไม่พบหน้าต่างหลัก' }

    const result = await dialog.showOpenDialog(win, {
      title: 'กู้คืนข้อมูลจากไฟล์สำรอง',
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'ยกเลิก' }
    }

    const sourcePath = result.filePaths[0]
    let convertedSourcePath: string | null = null
    let tempDir: string | null = null

    try {
      const inspection = inspectBackupDatabase(sourcePath)

      if (inspection.kind === 'legacy') {
        tempDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'pueankaset-restore-'))
        convertedSourcePath = path.join(tempDir, 'converted.db')
        convertLegacyBackup(sourcePath, convertedSourcePath)
      }

      // Backup current DB before restoring
      const backupDir = getDefaultBackupDir()
      ensureDir(backupDir)
      const preRestoreBackup = path.join(backupDir, generateBackupFilename('pre-restore'))
      fs.copyFileSync(getDbPath(), preRestoreBackup)

      // Copy the backup file over the current DB
      // We need to close the current connection, copy, and restart
      const dbPath = getDbPath()
      const db = getDb()
      db.close()

      fs.copyFileSync(convertedSourcePath ?? sourcePath, dbPath)
      // Also remove WAL/SHM files if they exist
      for (const ext of ['-wal', '-shm']) {
        const f = dbPath + ext
        if (fs.existsSync(f)) fs.unlinkSync(f)
      }

      return { success: true, needsRestart: true, convertedLegacy: inspection.kind === 'legacy' }
    } catch (err) {
      return { success: false, error: `กู้คืนข้อมูลไม่สำเร็จ: ${(err as Error).message}` }
    } finally {
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    }
  })

  // Fix dates that were corrupted by the v1.10.6 legacy-restore bug
  // (UTC ISO timestamps were converted to local-time strings)
  ipcMain.handle('backup:fix-legacy-import-dates', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'ไม่พบหน้าต่างหลัก' }

    const result = await dialog.showOpenDialog(win, {
      title: 'เลือกไฟล์สำรองรุ่นเก่าเพื่อซ่อมเวลา',
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'ยกเลิก' }
    }

    const sourcePath = result.filePaths[0]

    try {
      const inspection = inspectBackupDatabase(sourcePath)
      if (inspection.kind !== 'legacy') {
        return { success: false, error: 'ไฟล์นี้ไม่ใช่ไฟล์สำรองรุ่นเก่า' }
      }

      const backupDir = getDefaultBackupDir()
      ensureDir(backupDir)
      const preFixBackup = path.join(backupDir, generateBackupFilename('pre-fix-dates'))
      const db = getDb()
      db.backup(preFixBackup)

      const legacyDb = new Database(sourcePath, { readonly: true })
      let rows: { id: number; date: string }[]
      try {
        rows = legacyDb.prepare('SELECT id, date FROM sales').all() as {
          id: number
          date: string
        }[]
      } finally {
        legacyDb.close()
      }

      const update = db.prepare('UPDATE sales SET date = ? WHERE id = ? AND date != ?')

      let updated = 0
      const fix = db.transaction(() => {
        for (const row of rows) {
          const correctDate = toSqliteDateTime(row.date)
          const res = update.run(correctDate, row.id, correctDate)
          if (res.changes > 0) updated++
        }
      })
      fix()

      return { success: true, updated, total: rows.length }
    } catch (err) {
      return { success: false, error: `ซ่อมเวลาไม่สำเร็จ: ${(err as Error).message}` }
    }
  })

  // Get list of auto backups
  ipcMain.handle('backup:list', () => {
    const backupDir = getDefaultBackupDir()
    if (!fs.existsSync(backupDir)) return []

    return fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith('.db'))
      .sort()
      .reverse()
      .map((filename) => {
        const filePath = path.join(backupDir, filename)
        const stat = fs.statSync(filePath)
        return {
          filename,
          path: filePath,
          size: stat.size,
          createdAt: stat.mtime.toISOString()
        }
      })
  })

  // Get backup info (last auto backup time, backup folder)
  ipcMain.handle('backup:info', () => {
    const backupDir = getDefaultBackupDir()
    let lastAutoBackup: string | null = null

    if (fs.existsSync(backupDir)) {
      const autoFiles = fs
        .readdirSync(backupDir)
        .filter((f) => f.startsWith('pueankaset_auto_') && f.endsWith('.db'))
        .sort()
        .reverse()

      if (autoFiles.length > 0) {
        const stat = fs.statSync(path.join(backupDir, autoFiles[0]))
        lastAutoBackup = stat.mtime.toISOString()
      }
    }

    const dbStat = fs.statSync(getDbPath())

    return {
      dbSize: dbStat.size,
      backupDir,
      lastAutoBackup,
      savedBackupPath: getSavedBackupPath()
    }
  })
}
