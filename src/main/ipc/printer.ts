import { BrowserWindow, ipcMain, app } from 'electron'
import { getDb } from '../database'
import { buildReceipt, buildDebtReceipt } from '../printer/receipt'
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

  ipcMain.handle('printer:print-debt', async (_event, customerId: number) => {
    try {
      const db = getDb()

      const customer = db
        .prepare('SELECT id, name, phone FROM customers WHERE id = ?')
        .get(customerId) as { id: number; name: string; phone: string | null } | undefined

      if (!customer) {
        return { success: false, error: 'ไม่พบลูกค้า' }
      }

      const creditSales = db
        .prepare(
          `SELECT id, date, total_amount FROM sales
           WHERE customer_id = ? AND payment_type = 'credit'
           ORDER BY date ASC, id ASC`
        )
        .all(customerId) as { id: number; date: string; total_amount: number }[]

      const payments = db
        .prepare(
          'SELECT date, amount, note FROM customer_payments WHERE customer_id = ? ORDER BY date ASC, id ASC'
        )
        .all(customerId) as { date: string; amount: number; note: string | null }[]

      const getItems = db.prepare(
        `SELECT si.quantity, si.price, p.name as product_name, p.description as product_description
         FROM sale_items si
         JOIN products p ON p.id = si.product_id
         WHERE si.sale_id = ?`
      )

      // FIFO: each payment fills the oldest unpaid sale first; overflow rolls forward.
      const allocated = creditSales.map((sale) => ({
        ...sale,
        remaining: sale.total_amount,
        appliedPayments: [] as { date: string; amount: number; note: string | null }[]
      }))

      let saleIdx = 0
      for (const payment of payments) {
        let amountLeft = payment.amount
        while (amountLeft > 0 && saleIdx < allocated.length) {
          const sale = allocated[saleIdx]
          if (sale.remaining <= 0) {
            saleIdx++
            continue
          }
          const apply = Math.min(amountLeft, sale.remaining)
          sale.appliedPayments.push({ date: payment.date, amount: apply, note: payment.note })
          sale.remaining -= apply
          amountLeft -= apply
          if (sale.remaining <= 0) {
            saleIdx++
          }
        }
        // Any leftover payment (overpayment) is silently absorbed; it still
        // counts toward the global outstanding via the totals below.
      }

      const remainingSales = allocated
        .filter((s) => s.remaining > 0.0001)
        .map((s) => ({
          id: s.id,
          date: s.date,
          total_amount: s.total_amount,
          remaining: s.remaining,
          appliedPayments: s.appliedPayments,
          items: (
            getItems.all(s.id) as {
              product_name: string
              product_description: string | null
              quantity: number
              price: number
            }[]
          ).map((it) => ({
            product_name: it.product_name,
            description: it.product_description,
            quantity: it.quantity,
            price: it.price
          }))
        }))

      const totalCredit = creditSales.reduce((sum, s) => sum + s.total_amount, 0)
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
      const outstanding = Math.max(0, totalCredit - totalPaid)

      const receipt = buildDebtReceipt(customer, remainingSales, outstanding)
      const config = getPrinterConfig(db, getDefaultPrinterMode())
      validatePrinterConfig(config)

      await printReceiptLines(receipt, config)

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการพิมพ์'
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
