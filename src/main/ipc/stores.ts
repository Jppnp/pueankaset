import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerStoreHandlers(): void {
  ipcMain.handle('stores:list', () => {
    return getDb().prepare('SELECT * FROM stores ORDER BY name').all()
  })

  ipcMain.handle('stores:create', (_event, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) {
      return { error: 'ชื่อร้านค้าห้ามว่าง' }
    }
    const db = getDb()
    try {
      const result = db.prepare('INSERT INTO stores (name) VALUES (?)').run(trimmed)
      return db.prepare('SELECT * FROM stores WHERE id = ?').get(result.lastInsertRowid)
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
        return { error: `ชื่อร้านค้า "${trimmed}" มีอยู่แล้ว` }
      }
      throw err
    }
  })
}
