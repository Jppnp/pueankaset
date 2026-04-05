import React, { useState, useEffect, useCallback } from 'react'
import { SummaryCards } from '../components/dashboard/SummaryCards'
import { TopProductsTable } from '../components/dashboard/TopProductsTable'
import { LowStockAlerts } from '../components/dashboard/LowStockAlerts'
import { RevenueTrendChart } from '../components/dashboard/RevenueTrendChart'
import { useDashboard } from '../hooks/useDashboard'
import { todayRange, toISODate } from '../lib/format'
import type { Store } from '../lib/types'

const TREND_DAYS = 7

function getTrendRange(days: number): { from: string; to: string } {
  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - (days - 1))
  return {
    from: `${toISODate(from)} 00:00:00`,
    to: `${toISODate(today)} 23:59:59`
  }
}

export function DashboardPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<number | undefined>(undefined)
  const { summary, topProducts, lowStock, revenueTrend, loading, error, fetchDashboard } =
    useDashboard()

  useEffect(() => {
    window.api.getStores().then(setStores)
  }, [])

  const refresh = useCallback(() => {
    const today = todayRange()
    const trend = getTrendRange(TREND_DAYS)
    fetchDashboard({
      dateFrom: today.from,
      dateTo: today.to,
      trendFrom: trend.from,
      trendTo: trend.to,
      storeId: selectedStoreId
    })
  }, [fetchDashboard, selectedStoreId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 60_000)
    return () => clearInterval(interval)
  }, [refresh])

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">แดชบอร์ด</h1>
          <div className="flex items-center gap-3">
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
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
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

        {/* Summary cards */}
        {summary && <SummaryCards summary={summary} />}

        {/* Revenue trend */}
        <RevenueTrendChart data={revenueTrend} days={TREND_DAYS} />

        {/* Bottom row: top products + low stock */}
        <div className="grid grid-cols-2 gap-5">
          <TopProductsTable products={topProducts} />
          <LowStockAlerts products={lowStock} />
        </div>
      </div>
    </div>
  )
}
