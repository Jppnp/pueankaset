import React, { useState, useEffect, useCallback } from 'react'
import { ExpenseList } from '../components/expense/ExpenseList'
import { ExpenseForm } from '../components/expense/ExpenseForm'
import { ExpenseSummaryPanel } from '../components/expense/ExpenseSummaryPanel'
import { Pagination } from '../components/shared/Pagination'
import { useRole } from '../contexts/RoleContext'
import { toISODate, thisMonthRange } from '../lib/format'
import type { Expense, ExpenseSummary, PaginatedResult } from '../lib/types'

export function ExpensePage() {
  const { role } = useRole()
  const [pageSize, setPageSize] = useState(20)
  const [expenses, setExpenses] = useState<PaginatedResult<Expense>>({
    data: [], total: 0, page: 1, pageSize: 20
  })
  const [summary, setSummary] = useState<ExpenseSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)

  // Default to current month
  const [dateFrom, setDateFrom] = useState(() => {
    const range = thisMonthRange()
    return range.from.split(' ')[0]
  })
  const [dateTo, setDateTo] = useState(() => {
    const range = thisMonthRange()
    return range.to.split(' ')[0]
  })

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const from = `${dateFrom} 00:00:00`
      const to = `${dateTo} 23:59:59`
      const [expenseData, summaryData] = await Promise.all([
        window.api.getExpenses({ page, pageSize, dateFrom: from, dateTo: to }),
        window.api.getExpenseSummary(from, to)
      ])
      setExpenses(expenseData)
      setSummary(summaryData)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, pageSize])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreate = () => {
    setEditExpense(null)
    setShowForm(true)
  }

  const handleEdit = (expense: Expense) => {
    setEditExpense(expense)
    setShowForm(true)
  }

  const handleDelete = useCallback(async (id: number) => {
    await window.api.deleteExpense(id)
    fetchData(expenses.page)
  }, [fetchData, expenses.page])

  const handleSaved = () => {
    fetchData(expenses.page)
  }

  const handleExport = useCallback(async () => {
    const from = `${dateFrom} 00:00:00`
    const to = `${dateTo} 23:59:59`
    const result = await window.api.exportExpenses({ dateFrom: from, dateTo: to })
    if (result.success) {
      alert(`บันทึกไฟล์สำเร็จ: ${result.path}`)
    }
  }, [dateFrom, dateTo])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">ค่าใช้จ่าย</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              ส่งออก Excel
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              + เพิ่มค่าใช้จ่าย
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-500">ตั้งแต่:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <label className="text-sm text-gray-500">ถึง:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left - Expense list */}
        <div className="w-96 border-r flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
            ) : (
              <ExpenseList
                expenses={expenses.data}
                selectedId={editExpense?.id ?? null}
                onSelect={handleEdit}
                onDelete={handleDelete}
              />
            )}
          </div>
          <div className="border-t px-4 py-2">
            <Pagination
              page={expenses.page}
              total={expenses.total}
              pageSize={expenses.pageSize}
              onPageChange={(p) => fetchData(p)}
              onPageSizeChange={(s) => setPageSize(s)}
            />
          </div>
        </div>

        {/* Right - Summary */}
        <div className="flex-1 overflow-y-auto">
          <ExpenseSummaryPanel summary={summary} />
        </div>
      </div>

      <ExpenseForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditExpense(null) }}
        expense={editExpense}
        onSave={handleSaved}
        createdBy={role ?? 'owner'}
      />
    </div>
  )
}
