import { ipcMain, dialog, BrowserWindow } from 'electron'
import Database from 'better-sqlite3'
import { getDb } from '../database'

export function registerImportHandlers(): void {
  ipcMain.handle('import:from-store', (_event, filePath: string, storeId: number) => {
    const db = getDb()
    const sourceDb = new Database(filePath, { readonly: true })

    const importAll = db.transaction(() => {
      // Import products
      const products = sourceDb
        .prepare('SELECT * FROM products')
        .all() as {
        id: number
        name: string
        description: string | null
        cost_price: number
        sale_price: number
        stock_on_hand: number
        exclude_from_profit: number
      }[]

      const insertProduct = db.prepare(
        `INSERT OR REPLACE INTO products (id, name, description, cost_price, sale_price, stock_on_hand, exclude_from_profit, store_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )

      for (const p of products) {
        insertProduct.run(p.id, p.name, p.description, p.cost_price, p.sale_price, p.stock_on_hand, p.exclude_from_profit ?? 0, storeId)
      }

      return { imported: products.length }
    })

    try {
      const result = importAll()
      sourceDb.close()
      return result
    } catch (err) {
      sourceDb.close()
      throw err
    }
  })

  ipcMain.handle('import:select-file', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      title: 'เลือกไฟล์ store.db',
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('import:db-info', () => {
    const db = getDb()
    const productCount = (
      db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }
    ).count
    const saleCount = (
      db.prepare('SELECT COUNT(*) as count FROM sales').get() as { count: number }
    ).count
    return { productCount, saleCount }
  })
}
