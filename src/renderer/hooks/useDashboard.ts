import { useState, useCallback } from 'react'
import type { ProfitSummary, TopProduct, LowStockProduct, RevenueTrendPoint } from '../lib/types'

export function useDashboard() {
  const [summary, setSummary] = useState<ProfitSummary | null>(null)
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([])
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrendPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(
    async (params: {
      dateFrom: string
      dateTo: string
      trendFrom: string
      trendTo: string
      storeId?: number
    }) => {
      setLoading(true)
      setError(null)
      try {
        const [summaryData, topData, lowData, trendData] = await Promise.all([
          window.api.getDashboardSummary(params.dateFrom, params.dateTo, params.storeId),
          window.api.getTopProducts(params.dateFrom, params.dateTo, 10, params.storeId),
          window.api.getLowStockProducts(10, params.storeId),
          window.api.getRevenueTrend(params.trendFrom, params.trendTo, params.storeId)
        ])
        setSummary(summaryData)
        setTopProducts(topData)
        setLowStock(lowData)
        setRevenueTrend(trendData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { summary, topProducts, lowStock, revenueTrend, loading, error, fetchDashboard }
}
