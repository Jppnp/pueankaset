import React, { useState, useEffect, useCallback } from 'react'
import { MonthSelector } from '../components/report/MonthSelector'
import { MonthlySummaryCards } from '../components/report/MonthlySummaryCards'
import { TopProductsTable } from '../components/dashboard/TopProductsTable'
import { ExpenseBreakdown } from '../components/report/ExpenseBreakdown'
import { DebtSummaryCard } from '../components/report/DebtSummaryCard'
import { useMonthlyReport } from '../hooks/useMonthlyReport'
import type { Store } from '../lib/types'

export function MonthlyReportPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<number | undefined>(undefined)
  const { data, loading, error, fetchReport } = useMonthlyReport()

  useEffect(() => {
    window.api.getStores().then(setStores)
  }, [])

  const refresh = useCallback(() => {
    fetchReport(year, month, selectedStoreId)
  }, [fetchReport, year, month, selectedStoreId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleMonthChange = (y: number, m: number) => {
    setYear(y)
    setMonth(m)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">รายงานรายเดือน</h1>
          <div className="flex items-center gap-3">
            <MonthSelector year={year} month={month} onChange={handleMonthChange} />
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">ร้านค้า:</span>
              <select
                value={selectedStoreId ?? ''}
                onChange={(e) =>
                  setSelectedStoreId(e.target.value ? Number(e.target.value) : undefined)
                }
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">ทุกร้านค้า</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'กำลังโหลด...' : 'รีเฟรช'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-5 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
        )}

        {data && (
          <>
            {/* Summary cards with comparison */}
            <MonthlySummaryCards
              current={data.current}
              previous={data.previous}
              averageOrderValue={data.averageOrderValue}
              previousAverageOrderValue={data.previousAverageOrderValue}
            />

            {/* Bottom section: top products + expense breakdown + debt */}
            <div className="grid grid-cols-2 gap-5">
              <TopProductsTable products={data.topProducts} />
              <div className="space-y-5">
                <ExpenseBreakdown summary={data.expenseSummary} />
                <DebtSummaryCard
                  totalOutstanding={data.debtSummary.totalOutstanding}
                  customerCount={data.debtSummary.customerCount}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
