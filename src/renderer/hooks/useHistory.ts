import { useState, useCallback } from 'react'
import type { Sale, SaleWithItems, PaginatedResult, ProfitSummary } from '../lib/types'

export function useHistory() {
  const [sales, setSales] = useState<PaginatedResult<Sale>>({
    data: [],
    total: 0,
    page: 1,
    pageSize: 20
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profitSummary, setProfitSummary] = useState<ProfitSummary | null>(null)

  const fetchSales = useCallback(
    async (params: {
      page: number
      pageSize?: number
      dateFrom?: string
      dateTo?: string
      storeId?: number
    }) => {
      setLoading(true)
      setError(null)
      try {
        const result = await window.api.getSales({
          page: params.page,
          pageSize: params.pageSize ?? 20,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          storeId: params.storeId
        })
        setSales(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const fetchProfit = useCallback(async (dateFrom?: string, dateTo?: string, storeId?: number) => {
    try {
      const result = await window.api.getProfitSummary(dateFrom, dateTo, storeId)
      setProfitSummary(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูลกำไร')
    }
  }, [])

  const getSaleDetail = useCallback(async (id: number): Promise<SaleWithItems | null> => {
    return await window.api.getSaleDetail(id)
  }, [])

  return {
    sales,
    loading,
    error,
    profitSummary,
    fetchSales,
    fetchProfit,
    getSaleDetail
  }
}
