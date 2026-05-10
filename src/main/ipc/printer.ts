import { BrowserWindow, ipcMain, app } from 'electron'
import { getDb } from '../database'
import { buildReceipt } from '../printer/receipt'
import { printMock } from '../printer/mock'
import { printEscPos } from '../printer/escpos'
import { printSystemReceipt } from '../printer/system'
import {
  getPrinterConfig,
  normalizePrinterConfig,
  savePrinterConfig,
  validatePrinterConfig,
  type PrinterConfig,
  type PrinterMode
} from '../printer/config'
import type { ReceiptLine } from '../printer/receipt'

export function registerPrinterHandlers(): void {
  ipcMain.handle('printer:get-config', () => {
    const db = getDb()
    return getPrinterConfig(db, getDefaultPrinterMode())
  })

  ipcMain.handle('printer:save-config', (_event, input: unknown) => {
    try {
      const db = getDb()
      const config = normalizePrinterConfig(input, getDefaultPrinterMode())
      validatePrinterConfig(config)
      savePrinterConfig(db, config)
      return { success: true, config }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'บันทึกการตั้งค่าเครื่องพิมพ์ไม่สำเร็จ'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('printer:list', async () => {
    const window = BrowserWindow.getAllWindows().find((item) => !item.isDestroyed())
    if (!window) return []

    const printers = await window.webContents.getPrintersAsync()
    return printers.map((printer) => ({
      name: printer.name,
      displayName: printer.displayName || printer.name,
      description: printer.description,
      status: printer.status,
      isDefault: printer.isDefault
    }))
  })

  ipcMain.handle('printer:test', async (_event, input?: unknown) => {
    try {
      const db = getDb()
      const config =
        input === undefined
          ? getPrinterConfig(db, getDefaultPrinterMode())
          : normalizePrinterConfig(input, getDefaultPrinterMode())

      validatePrinterConfig(config)
      await printReceiptLines(buildTestReceipt(), config)

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ทดสอบพิมพ์ไม่สำเร็จ'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('printer:print', async (_event, saleId: number) => {
    try {
      const db = getDb()

      const sale = db
        .prepare(
          `SELECT s.*, c.name as customer_name
           FROM sales s
           LEFT JOIN customers c ON c.id = s.customer_id
           WHERE s.id = ?`
        )
        .get(saleId) as {
        id: number
        date: string
        total_amount: number
        remark: string | null
        seller_role: string | null
        customer_name: string | null
        payment_type: string | null
      } | undefined

      if (!sale) {
        return { success: false, error: 'ไม่พบรายการขาย' }
      }

      const items = db
        .prepare(
          `SELECT si.*, p.name as product_name, p.description as product_description
           FROM sale_items si
           JOIN products p ON p.id = si.product_id
           WHERE si.sale_id = ?`
        )
        .all(saleId) as {
        product_name: string
        product_description: string | null
        quantity: number
        price: number
      }[]

      const receipt = buildReceipt(
        sale,
        items.map((i) => ({
          product_name: i.product_name,
          description: i.product_description,
          quantity: i.quantity,
          price: i.price
        }))
      )
      const config = getPrinterConfig(db, getDefaultPrinterMode())
      validatePrinterConfig(config)

      await printReceiptLines(receipt, config)

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการพิมพ์'
      return { success: false, error: message }
    }
  })
}

async function printReceiptLines(lines: ReceiptLine[], config: PrinterConfig): Promise<void> {
  switch (config.mode) {
    case 'mock':
      printMock(lines)
      return
    case 'system':
      await printSystemReceipt(lines, config)
      return
    case 'network':
    case 'device':
      await printEscPos(lines, config)
      return
  }
}

function getDefaultPrinterMode(): PrinterMode {
  return app.isPackaged ? 'system' : 'mock'
}

function buildTestReceipt(): ReceiptLine[] {
  return buildReceipt(
    {
      id: 0,
      date: new Date().toISOString(),
      total_amount: 35,
      remark: 'ทดสอบเครื่องพิมพ์',
      customer_name: undefined,
      payment_type: 'cash'
    },
    [
      { product_name: 'สินค้าทดสอบ', quantity: 1, price: 25 },
      { product_name: 'ค่าบริการตัวอย่าง', quantity: 1, price: 10 }
    ]
  )
}
