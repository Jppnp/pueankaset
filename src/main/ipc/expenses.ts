import { ipcMain } from 'electron'
import { getDb } from '../database'

function toStoreId(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 1
}

function validateStoreExists(storeId: number): void {
  const db = getDb()
  const store = db.prepare('SELECT id FROM stores WHERE id = ?').get(storeId)
  if (!store) throw new Error('ไม่พบร้านค้า')
}

export function registerExpenseHandlers(): void {
  // Create expense
  ipcMain.handle(
    'expenses:create',
    (
      _event,
      input: {
        category: string
        amount: number
        description?: string
        date?: string
        createdBy: string
        storeId?: number
      }
    ) => {
      if (!input.category?.trim()) throw new Error('กรุณาระบุหมวดหมู่')
      if (!input.amount || input.amount <= 0) throw new Error('จำนวนเงินต้องมากกว่า 0')

      const db = getDb()
      const dateValue = input.date || null
      const storeId = toStoreId(input.storeId)
      validateStoreExists(storeId)

      const result = db
        .prepare(
          dateValue
            ? 'INSERT INTO expenses (category, amount, description, date, created_by, store_id) VALUES (?, ?, ?, ?, ?, ?)'
            : "INSERT INTO expenses (category, amount, description, date, created_by, store_id) VALUES (?, ?, ?, datetime('now'), ?, ?)"
        )
        .run(
          input.category.trim(),
          input.amount,
          input.description?.trim() || null,
          ...(dateValue ? [dateValue, input.createdBy, storeId] : [input.createdBy, storeId])
        )

      return db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid)
    }
  )

  // List expenses (paginated)
  ipcMain.handle(
    'expenses:list',
    (
      _event,
      params: {
        page: number
        pageSize: number
        dateFrom?: string
        dateTo?: string
        category?: string
        storeId?: number
      }
    ) => {
      const db = getDb()
      const { page, pageSize, dateFrom, dateTo, category, storeId } = params

      const conditions: string[] = []
      const whereParams: unknown[] = []

      if (dateFrom) {
        conditions.push('e.date >= ?')
        whereParams.push(dateFrom)
      }
      if (dateTo) {
        conditions.push('e.date <= ?')
        whereParams.push(dateTo)
      }
      if (category) {
        conditions.push('e.category = ?')
        whereParams.push(category)
      }
      if (storeId) {
        conditions.push('e.store_id = ?')
        whereParams.push(storeId)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const countResult = db
        .prepare(`SELECT COUNT(*) as total FROM expenses e ${where}`)
        .get(...whereParams) as { total: number }

      const data = db
        .prepare(
          `SELECT e.*, s.name as store_name
           FROM expenses e
           LEFT JOIN stores s ON s.id = e.store_id
           ${where}
           ORDER BY e.date DESC
           LIMIT ? OFFSET ?`
        )
        .all(...whereParams, pageSize, (page - 1) * pageSize)

      return { data, total: countResult.total, page, pageSize }
    }
  )

  // Update expense
  ipcMain.handle(
    'expenses:update',
    (_event, id: number, updates: { category?: string; amount?: number; description?: string; date?: string; storeId?: number }) => {
      const db = getDb()
      const fields: string[] = []
      const params: unknown[] = []

      if (updates.category !== undefined) {
        if (!updates.category.trim()) throw new Error('กรุณาระบุหมวดหมู่')
        fields.push('category = ?')
        params.push(updates.category.trim())
      }
      if (updates.amount !== undefined) {
        if (updates.amount <= 0) throw new Error('จำนวนเงินต้องมากกว่า 0')
        fields.push('amount = ?')
        params.push(updates.amount)
      }
      if (updates.description !== undefined) {
        fields.push('description = ?')
        params.push(updates.description.trim() || null)
      }
      if (updates.date !== undefined) {
        fields.push('date = ?')
        params.push(updates.date)
      }
      if (updates.storeId !== undefined) {
        const storeId = toStoreId(updates.storeId)
        validateStoreExists(storeId)
        fields.push('store_id = ?')
        params.push(storeId)
      }

      if (fields.length === 0) return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id)

      params.push(id)
      db.prepare(`UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`).run(...params)
      return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id)
    }
  )

  // Delete expense
  ipcMain.handle('expenses:delete', (_event, id: number) => {
    const db = getDb()
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id)
    return { success: true }
  })

  // Expense summary for date range
  ipcMain.handle(
    'expenses:summary',
    (_event, params: { dateFrom: string; dateTo: string; storeId?: number }) => {
      const db = getDb()
      const conditions = ['date >= ?', 'date <= ?']
      const queryParams: unknown[] = [params.dateFrom, params.dateTo]

      if (params.storeId) {
        conditions.push('store_id = ?')
        queryParams.push(params.storeId)
      }

      const where = `WHERE ${conditions.join(' AND ')}`

      const total = db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) as total_expenses FROM expenses ${where}`
        )
        .get(...queryParams) as { total_expenses: number }

      const byCategory = db
        .prepare(
          `SELECT category, SUM(amount) as total FROM expenses ${where} GROUP BY category ORDER BY total DESC`
        )
        .all(...queryParams) as { category: string; total: number }[]

      return {
        total_expenses: total.total_expenses,
        by_category: byCategory
      }
    }
  )
}
