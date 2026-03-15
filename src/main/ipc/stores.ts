import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerStoreHandlers(): void {
  ipcMain.handle('stores:list', () => {
    return getDb().prepare('SELECT * FROM stores ORDER BY name').all()
  })

  ipcMain.handle('stores:create', (_event, name: string) => {
    const db = getDb()
    const result = db.prepare('INSERT INTO stores (name) VALUES (?)').run(name.trim())
    return db.prepare('SELECT * FROM stores WHERE id = ?').get(result.lastInsertRowid)
  })
}
