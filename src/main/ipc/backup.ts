import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { getDb, getDbPath } from '../database'

const BACKUP_DIR_NAME = 'backups'
const MAX_AUTO_BACKUPS = 7
const SETTING_KEY_BACKUP_PATH = 'backup_folder_path'

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

    try {
      // Validate it's a valid SQLite database with our schema
      const Database = (await import('better-sqlite3')).default
      const testDb = new Database(sourcePath, { readonly: true })
      const tables = testDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as { name: string }[]
      const tableNames = tables.map((t) => t.name)

      if (!tableNames.includes('products') || !tableNames.includes('sales')) {
        testDb.close()
        return { success: false, error: 'ไฟล์นี้ไม่ใช่ฐานข้อมูลเพื่อนเกษตร' }
      }
      testDb.close()

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

      fs.copyFileSync(sourcePath, dbPath)
      // Also remove WAL/SHM files if they exist
      for (const ext of ['-wal', '-shm']) {
        const f = dbPath + ext
        if (fs.existsSync(f)) fs.unlinkSync(f)
      }

      return { success: true, needsRestart: true }
    } catch (err) {
      return { success: false, error: `กู้คืนข้อมูลไม่สำเร็จ: ${(err as Error).message}` }
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
