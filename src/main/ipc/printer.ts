import { ipcMain, app } from 'electron'
import { getDb } from '../database'
import { buildReceipt } from '../printer/receipt'
import { printMock } from '../printer/mock'

export function registerPrinterHandlers(): void {
  ipcMain.handle('printer:print', async (_event, saleId: number) => {
    try {
      const db = getDb()

      const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as {
        id: number
        date: string
        total_amount: number
        remark: string | null
        seller_role: string | null
      } | undefined

      if (!sale) {
        return { success: false, error: 'ไม่พบรายการขาย' }
      }

      const items = db
        .prepare(
          `SELECT si.*, p.name as product_name
           FROM sale_items si
           JOIN products p ON p.id = si.product_id
           WHERE si.sale_id = ?`
        )
        .all(saleId) as {
        product_name: string
        quantity: number
        price: number
      }[]

      const receipt = buildReceipt(sale, items)

      if (app.isPackaged) {
        // TODO: Phase 6 - real ESC/POS printer
        printMock(receipt)
      } else {
        printMock(receipt)
      }

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการพิมพ์'
      return { success: false, error: message }
    }
  })
}
