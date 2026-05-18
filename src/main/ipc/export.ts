import { ipcMain, dialog } from 'electron'
import { getDb } from '../database'
import { writeFileSync } from 'fs'

// UTF-8 BOM for proper Thai character display in Excel
const BOM = '\uFEFF'
const paymentLabels: Record<string, string> = {
  cash: 'เงินสด',
  card: 'บัตร',
  transfer: 'โอนเงิน',
  credit: 'เชื่อ'
}

type ProductListStatus = 'notDeleted' | 'deleted' | 'all'

function normalizeProductStatus(status?: ProductListStatus): ProductListStatus {
  return ['notDeleted', 'deleted', 'all'].includes(status ?? '')
    ? status!
    : 'notDeleted'
}

function toPositiveInteger(value: unknown): number | undefined {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : undefined

  return Number.isInteger(numeric) && numeric > 0 ? numeric : undefined
}

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsvRow(values: unknown[]): string {
  return values.map(escapeCsv).join(',')
}

async function saveCsvFile(
  csvContent: string,
  defaultName: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [
      { name: 'CSV (Excel)', extensions: ['csv'] }
    ]
  })

  if (result.canceled || !result.filePath) {
    return { success: false, error: 'ยกเลิก' }
  }

  writeFileSync(result.filePath, BOM + csvContent, 'utf-8')
  return { success: true, path: result.filePath }
}

export function registerExportHandlers(): void {
  // Export sales history
  ipcMain.handle(
    'export:sales',
    async (_event, params: { dateFrom?: string; dateTo?: string; storeId?: number; itemId?: number | string }) => {
      const db = getDb()
      const conditions: string[] = []
      const whereParams: unknown[] = []
      const itemId = toPositiveInteger(params.itemId)

      if (params.dateFrom) {
        conditions.push('s.date >= ?')
        whereParams.push(params.dateFrom)
      }
      if (params.dateTo) {
        conditions.push('s.date <= ?')
        whereParams.push(params.dateTo)
      }
      const itemConditions: string[] = []
      const itemParams: unknown[] = []
      if (params.storeId) {
        itemConditions.push('p2.store_id = ?')
        itemParams.push(params.storeId)
      }
      if (itemId) {
        itemConditions.push('p2.id = ?')
        itemParams.push(itemId)
      }
      if (itemConditions.length > 0) {
        conditions.push(
          `EXISTS (
            SELECT 1
            FROM sale_items si2
            JOIN products p2 ON p2.id = si2.product_id
            WHERE si2.sale_id = s.id AND ${itemConditions.join(' AND ')}
          )`
        )
        whereParams.push(...itemParams)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const sales = db
        .prepare(
          `SELECT s.id, s.date, s.total_amount, s.payment_type, s.seller_role, s.delivery_status, s.remark,
                  COALESCE((
                    SELECT SUM(si.price * si.quantity)
                    FROM sale_items si
                    WHERE si.sale_id = s.id
                  ), 0) as items_total,
                  c.name as customer_name
           FROM sales s
           LEFT JOIN customers c ON c.id = s.customer_id
           ${where}
           ORDER BY s.date DESC`
        )
        .all(...whereParams) as {
        id: number
        date: string
        total_amount: number
        items_total: number
        payment_type: string
        seller_role: string
        delivery_status: string
        remark: string | null
        customer_name: string | null
      }[]

      const header = toCsvRow([
        'เลขที่',
        'วันที่',
        'ยอดสินค้า',
        'ค่าธรรมเนียมบัตร',
        'ยอดชำระจริง',
        'วิธีชำระ',
        'ผู้ขาย',
        'จัดส่ง',
        'ลูกค้า',
        'หมายเหตุ'
      ])

      const roleLabels: Record<string, string> = {
        owner: 'เจ้าของ',
        employee: 'พนักงาน'
      }
      const deliveryLabels: Record<string, string> = {
        none: 'รับหน้าร้าน',
        waiting: 'รอจัดส่ง',
        shipped: 'จัดส่งแล้ว'
      }

      const rows = sales.map((s) => {
        const cardFee = Math.max(0, Math.round((s.total_amount - s.items_total) * 100) / 100)
        return toCsvRow([
          s.id,
          s.date,
          s.items_total,
          cardFee,
          s.total_amount,
          paymentLabels[s.payment_type] ?? s.payment_type,
          roleLabels[s.seller_role] ?? s.seller_role,
          deliveryLabels[s.delivery_status] ?? s.delivery_status,
          s.customer_name,
          s.remark
        ])
      })

      const csv = [header, ...rows].join('\n')
      return saveCsvFile(csv, `ประวัติการขาย.csv`)
    }
  )

  // Export sales with item details
  ipcMain.handle(
    'export:sales-detail',
    async (_event, params: { dateFrom?: string; dateTo?: string; storeId?: number; itemId?: number | string }) => {
      const db = getDb()
      const conditions: string[] = []
      const whereParams: unknown[] = []
      const itemId = toPositiveInteger(params.itemId)

      if (params.dateFrom) {
        conditions.push('s.date >= ?')
        whereParams.push(params.dateFrom)
      }
      if (params.dateTo) {
        conditions.push('s.date <= ?')
        whereParams.push(params.dateTo)
      }
      if (params.storeId) {
        conditions.push('p.store_id = ?')
        whereParams.push(params.storeId)
      }
      if (itemId) {
        conditions.push('p.id = ?')
        whereParams.push(itemId)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const items = db
        .prepare(
          `SELECT s.id as sale_id, s.date, s.payment_type, s.seller_role, s.delivery_status,
                  p.name as product_name, si.quantity, si.price, si.cost_price,
                  c.name as customer_name
           FROM sale_items si
           JOIN sales s ON s.id = si.sale_id
           JOIN products p ON p.id = si.product_id
           LEFT JOIN customers c ON c.id = s.customer_id
           ${where}
           ORDER BY s.date DESC, s.id`
        )
        .all(...whereParams) as {
        sale_id: number
        date: string
        payment_type: string
        seller_role: string
        delivery_status: string
        product_name: string
        quantity: number
        price: number
        cost_price: number
        customer_name: string | null
      }[]

      const header = toCsvRow([
        'เลขที่ใบเสร็จ',
        'วันที่',
        'สินค้า',
        'จำนวน',
        'ราคาขาย',
        'ราคาทุน',
        'รวม',
        'กำไร',
        'วิธีชำระ',
        'จัดส่ง',
        'ลูกค้า'
      ])

      const deliveryLabels: Record<string, string> = {
        none: 'รับหน้าร้าน',
        waiting: 'รอจัดส่ง',
        shipped: 'จัดส่งแล้ว'
      }

      const rows = items.map((i) =>
        toCsvRow([
          i.sale_id,
          i.date,
          i.product_name,
          i.quantity,
          i.price,
          i.cost_price,
          Math.round(i.price * i.quantity * 100) / 100,
          Math.round((i.price - i.cost_price) * i.quantity * 100) / 100,
          paymentLabels[i.payment_type] ?? i.payment_type,
          deliveryLabels[i.delivery_status] ?? i.delivery_status,
          i.customer_name
        ])
      )

      const csv = [header, ...rows].join('\n')
      return saveCsvFile(csv, `รายละเอียดการขาย.csv`)
    }
  )

  // Export products
  ipcMain.handle(
    'export:products',
    async (_event, storeId?: number, options?: { status?: ProductListStatus }) => {
      const db = getDb()
      const conditions: string[] = []
      const params: unknown[] = []
      const status = normalizeProductStatus(options?.status)

      if (status === 'deleted') {
        conditions.push('p.is_deleted = 1')
      } else if (status === 'notDeleted') {
        conditions.push('p.is_deleted = 0')
      }

      if (storeId) {
        conditions.push('p.store_id = ?')
        params.push(storeId)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const products = db
        .prepare(
          `SELECT p.*, s.name as store_name
           FROM products p
           LEFT JOIN stores s ON s.id = p.store_id
           ${where}
           ORDER BY p.name`
        )
        .all(...params) as {
        id: number
        name: string
        description: string | null
        cost_price: number
        sale_price: number
        stock_on_hand: number
        exclude_from_profit: number
        is_deleted: number
        store_name: string | null
      }[]

      const header = toCsvRow([
        'รหัส',
        'ชื่อสินค้า',
        'รายละเอียด',
        'ราคาทุน',
        'ราคาขาย',
        'กำไรต่อชิ้น',
        'คงเหลือ',
        'มูลค่าคงเหลือ (ทุน)',
        'ร้านค้า',
        'สถานะ',
        'ไม่นับกำไร'
      ])

      const rows = products.map((p) =>
        toCsvRow([
          p.id,
          p.name,
          p.description,
          p.cost_price,
          p.sale_price,
          Math.round((p.sale_price - p.cost_price) * 100) / 100,
          p.stock_on_hand,
          Math.round(p.cost_price * p.stock_on_hand * 100) / 100,
          p.store_name,
          p.is_deleted ? 'ลบแล้ว' : 'ใช้งาน',
          p.exclude_from_profit ? 'ใช่' : ''
        ])
      )

      const csv = [header, ...rows].join('\n')
      return saveCsvFile(csv, `สินค้าทั้งหมด.csv`)
    }
  )

  // Export expenses
  ipcMain.handle(
    'export:expenses',
    async (_event, params: { dateFrom?: string; dateTo?: string }) => {
      const db = getDb()
      const conditions: string[] = []
      const whereParams: unknown[] = []

      if (params.dateFrom) {
        conditions.push('date >= ?')
        whereParams.push(params.dateFrom)
      }
      if (params.dateTo) {
        conditions.push('date <= ?')
        whereParams.push(params.dateTo)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const expenses = db
        .prepare(`SELECT * FROM expenses ${where} ORDER BY date DESC`)
        .all(...whereParams) as {
        id: number
        category: string
        amount: number
        description: string | null
        date: string
        created_by: string
      }[]

      const header = toCsvRow(['เลขที่', 'วันที่', 'หมวดหมู่', 'จำนวนเงิน', 'รายละเอียด', 'ผู้บันทึก'])
      const rows = expenses.map((e) =>
        toCsvRow([e.id, e.date, e.category, e.amount, e.description, e.created_by])
      )

      const csv = [header, ...rows].join('\n')
      return saveCsvFile(csv, `ค่าใช้จ่าย.csv`)
    }
  )

  // Export customer debt
  ipcMain.handle('export:customers', async () => {
    const db = getDb()

    const customers = db
      .prepare(
        `SELECT c.*,
          COALESCE(credit.total, 0) as total_credit,
          COALESCE(paid.total, 0) as total_paid,
          COALESCE(credit.total, 0) - COALESCE(paid.total, 0) as outstanding
        FROM customers c
        LEFT JOIN (
          SELECT customer_id, SUM(total_amount) as total
          FROM sales WHERE payment_type = 'credit'
          GROUP BY customer_id
        ) credit ON credit.customer_id = c.id
        LEFT JOIN (
          SELECT customer_id, SUM(amount) as total
          FROM customer_payments
          GROUP BY customer_id
        ) paid ON paid.customer_id = c.id
        ORDER BY c.name ASC`
      )
      .all() as {
      id: number
      name: string
      phone: string | null
      address: string | null
      total_credit: number
      total_paid: number
      outstanding: number
    }[]

    const header = toCsvRow([
      'รหัส',
      'ชื่อลูกค้า',
      'เบอร์โทร',
      'ที่อยู่',
      'ยอดเชื่อทั้งหมด',
      'ชำระแล้ว',
      'คงค้าง'
    ])
    const rows = customers.map((c) =>
      toCsvRow([
        c.id,
        c.name,
        c.phone,
        c.address,
        c.total_credit,
        c.total_paid,
        c.outstanding
      ])
    )

    const csv = [header, ...rows].join('\n')
    return saveCsvFile(csv, `ลูกค้าและหนี้.csv`)
  })
}
