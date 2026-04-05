import { useState, useCallback } from 'react'
import { monthRange } from '../lib/format'
import type { ProfitSummary, TopProduct, ExpenseSummary, CustomerWithDebt } from '../lib/types'

export interface MonthlyReportData {
  current: ProfitSummary
  previous: ProfitSummary
  topProducts: TopProduct[]
  expenseSummary: ExpenseSummary
  debtSummary: { totalOutstanding: number; customerCount: number }
  averageOrderValue: number
  previousAverageOrderValue: number
}

export function useMonthlyReport() {
  const [data, setData] = useState<MonthlyReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = useCallback(async (year: number, month: number, storeId?: number) => {
    setLoading(true)
    setError(null)
    try {
      const current = monthRange(year, month)
      const prevMonth = month === 0 ? 11 : month - 1
      const prevYear = month === 0 ? year - 1 : year
      const previous = monthRange(prevYear, prevMonth)

      const [currentProfit, previousProfit, topProducts, expenseSummary, customers] =
        await Promise.all([
          window.api.getProfitSummary(current.from, current.to, storeId),
          window.api.getProfitSummary(previous.from, previous.to, storeId),
          window.api.getTopProducts(current.from, current.to, 10, storeId),
          window.api.getExpenseSummary(current.from, current.to),
          window.api.getCustomersWithDebt()
        ])

      const debtCustomers = (customers as CustomerWithDebt[]).filter((c) => c.outstanding > 0)

      setData({
        current: currentProfit,
        previous: previousProfit,
        topProducts,
        expenseSummary,
        debtSummary: {
          totalOutstanding: debtCustomers.reduce((sum, c) => sum + c.outstanding, 0),
          customerCount: debtCustomers.length
        },
        averageOrderValue:
          currentProfit.sale_count > 0 ? currentProfit.total_revenue / currentProfit.sale_count : 0,
        previousAverageOrderValue:
          previousProfit.sale_count > 0
            ? previousProfit.total_revenue / previousProfit.sale_count
            : 0
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, fetchReport }
}
