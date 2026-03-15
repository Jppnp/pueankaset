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
        stockOnHand: number
      }[]

      const insertProduct = db.prepare(
        `INSERT OR REPLACE INTO products (id, name, description, cost_price, sale_price, stock_on_hand, store_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )

      for (const p of products) {
        insertProduct.run(p.id, p.name, p.description, p.cost_price, p.sale_price, p.stockOnHand, storeId)
      }

      // Import sales
      const sales = sourceDb.prepare('SELECT * FROM sales').all() as {
        id: number
        date: string
        remark: string | null
      }[]

      const insertSale = db.prepare(
        `INSERT OR REPLACE INTO sales (id, date, total_amount, remark) VALUES (?, ?, ?, ?)`
      )

      // Import sale_items
      const saleItems = sourceDb.prepare('SELECT * FROM sale_items').all() as {
        id: number
        sale_id: number
        product_id: number
        quantity: number
        price: number
        cost_price: number
      }[]

      // Calculate total_amount per sale
      const saleTotals = new Map<number, number>()
      for (const item of saleItems) {
        const current = saleTotals.get(item.sale_id) ?? 0
        saleTotals.set(item.sale_id, current + item.price * item.quantity)
      }

      for (const s of sales) {
        const total = saleTotals.get(s.id) ?? 0
        insertSale.run(s.id, s.date, total, s.remark)
      }

      const insertSaleItem = db.prepare(
        `INSERT OR REPLACE INTO sale_items (id, sale_id, product_id, quantity, price, cost_price)
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
