import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerCustomerHandlers(): void {
  // List/search customers
  ipcMain.handle('customers:list', (_event, query?: string) => {
    const db = getDb()
    if (query && query.trim()) {
      const q = `%${query.trim()}%`
      return db
        .prepare('SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name ASC')
        .all(q, q)
    }
    return db.prepare('SELECT * FROM customers ORDER BY name ASC').all()
  })

  // Get single customer
  ipcMain.handle('customers:get', (_event, id: number) => {
    const db = getDb()
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(id) ?? null
  })

  // Create customer
  ipcMain.handle(
    'customers:create',
    (_event, input: { name: string; phone?: string; address?: string }) => {
      const name = input.name?.trim()
      if (!name) throw new Error('กรุณาระบุชื่อลูกค้า')

      const db = getDb()
      const result = db
        .prepare('INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)')
        .run(name, input.phone?.trim() || null, input.address?.trim() || null)

      return db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid)
    }
  )

  // Update customer
  ipcMain.handle(
    'customers:update',
    (_event, id: number, updates: { name?: string; phone?: string; address?: string }) => {
      const db = getDb()
      const fields: string[] = []
      const params: unknown[] = []

      if (updates.name !== undefined) {
        const name = updates.name.trim()
        if (!name) throw new Error('กรุณาระบุชื่อลูกค้า')
        fields.push('name = ?')
        params.push(name)
      }
      if (updates.phone !== undefined) {
        fields.push('phone = ?')
        params.push(updates.phone.trim() || null)
      }
      if (updates.address !== undefined) {
        fields.push('address = ?')
        params.push(updates.address.trim() || null)
      }

      if (fields.length === 0) throw new Error('ไม่มีข้อมูลที่ต้องอัปเดต')

      fields.push("updated_at = datetime('now')")
      params.push(id)

      db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`).run(...params)
      return db.prepare('SELECT * FROM customers WHERE id = ?').get(id)
    }
  )

  // Delete customer (only if no sales linked)
  ipcMain.handle('customers:delete', (_event, id: number) => {
    const db = getDb()
    const linked = db
      .prepare('SELECT COUNT(*) as count FROM sales WHERE customer_id = ?')
      .get(id) as { count: number }

    if (linked.count > 0) {
      return { success: false, error: 'ไม่สามารถลบลูกค้าที่มีประวัติการขายได้' }
    }

    db.prepare('DELETE FROM customer_payments WHERE customer_id = ?').run(id)
    db.prepare('DELETE FROM customers WHERE id = ?').run(id)
    return { success: true }
  })

  // Debt summary for one customer
  ipcMain.handle('customers:debt-summary', (_event, id: number) => {
    const db = getDb()

    const credit = db
      .prepare(
        "SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE customer_id = ? AND payment_type = 'credit'"
      )
      .get(id) as { total: number }

    const paid = db
      .prepare(
        'SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments WHERE customer_id = ?'
      )
      .get(id) as { total: number }

    return {
      total_credit: credit.total,
      total_paid: paid.total,
      outstanding: credit.total - paid.total
    }
  })

  // Purchase history for a customer
  ipcMain.handle(
    'customers:purchase-history',
    (_event, params: { customerId: number; page: number; pageSize: number }) => {
      const db = getDb()
      const { customerId, page, pageSize } = params

      const countResult = db
        .prepare('SELECT COUNT(*) as total FROM sales WHERE customer_id = ?')
        .get(customerId) as { total: number }

      const data = db
        .prepare(
          'SELECT * FROM sales WHERE customer_id = ? ORDER BY date DESC LIMIT ? OFFSET ?'
        )
        .all(customerId, pageSize, (page - 1) * pageSize)

      return { data, total: countResult.total, page, pageSize }
    }
  )

  // List all customers with debt info
  ipcMain.handle('customers:list-with-debt', (_event, query?: string) => {
    const db = getDb()

    let where = ''
    const params: unknown[] = []

    if (query && query.trim()) {
      where = 'WHERE c.name LIKE ? OR c.phone LIKE ?'
      const q = `%${query.trim()}%`
      params.push(q, q)
    }

    return db
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
        ${where}
        ORDER BY c.name ASC`
      )
      .all(...params)
  })

  // Record a debt repayment
  ipcMain.handle(
    'customer-payments:create',
    (_event, input: { customerId: number; amount: number; note?: string }) => {
      if (!input.amount || input.amount <= 0) throw new Error('จำนวนเงินต้องมากกว่า 0')

      const db = getDb()
      const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(input.customerId)
      if (!customer) throw new Error('ไม่พบลูกค้า')

      const result = db
        .prepare('INSERT INTO customer_payments (customer_id, amount, note) VALUES (?, ?, ?)')
        .run(input.customerId, input.amount, input.note?.trim() || null)

      return db
        .prepare('SELECT * FROM customer_payments WHERE id = ?')
        .get(result.lastInsertRowid)
    }
  )

  // List payments for a customer
  ipcMain.handle('customer-payments:list', (_event, customerId: number) => {
    const db = getDb()
    return db
      .prepare('SELECT * FROM customer_payments WHERE customer_id = ? ORDER BY date DESC')
      .all(customerId)
  })
}
