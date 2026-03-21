import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerParkedOrderHandlers(): void {
  ipcMain.handle(
    'parked-orders:save',
    (_event, label: string | null, itemsJson: string) => {
      try {
        JSON.parse(itemsJson)
      } catch {
        throw new Error('ข้อมูลรายการสินค้าไม่ถูกต้อง')
      }
      const db = getDb()
      const result = db
        .prepare(`INSERT INTO parked_orders (label, items_json) VALUES (?, ?)`)
        .run(label, itemsJson)
      return db
        .prepare('SELECT * FROM parked_orders WHERE id = ?')
        .get(result.lastInsertRowid)
    }
  )

  ipcMain.handle('parked-orders:list', () => {
    const db = getDb()
    return db.prepare('SELECT * FROM parked_orders ORDER BY created_at DESC').all()
  })

  ipcMain.handle('parked-orders:delete', (_event, id: number) => {
    const db = getDb()
    db.prepare('DELETE FROM parked_orders WHERE id = ?').run(id)
  })
}
